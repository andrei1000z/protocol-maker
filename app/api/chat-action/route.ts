// Chat-action endpoint — applies one of three structured actions the AI suggests
// during a chat conversation. The AI emits inline markers like `[[ACTION:...]]`
// in its reply, the frontend parses them as confirmation chips, and on user
// approval the chip POSTs here.
//
// We keep the surface small + auditable: only 3 action types, each with a
// strict payload schema. Anything outside those bounds is rejected.
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

// ─────────────────────────────────────────────────────────────────────────────
// Action schemas — each maps to one DB write. Keep these tight.
// ─────────────────────────────────────────────────────────────────────────────
const UpdateProfileSchema = z.object({
  type: z.literal('update_profile'),
  payload: z.object({
    // Only these top-level columns are mutable from chat. Adding more requires explicit allowlist.
    height_cm: z.number().int().min(50).max(260).optional(),
    weight_kg: z.number().min(20).max(400).optional(),
    activity_level: z.number().int().min(0).max(4).optional(),
    sleep_hours_avg: z.number().min(0).max(14).optional(),
    cardio_minutes_per_week: z.number().int().min(0).max(2000).optional(),
    strength_sessions_per_week: z.number().int().min(0).max(14).optional(),
    alcohol_drinks_per_week: z.number().int().min(0).max(60).optional(),
    caffeine_mg_per_day: z.number().int().min(0).max(2000).optional(),
    smoker: z.boolean().optional(),
    // Onboarding-data merge: nested fields the AI commonly needs to touch
    onboarding_data_patch: z.record(z.string(), z.unknown()).optional(),
  }).refine(o => Object.keys(o).length > 0, 'must change at least one field'),
});

const LogMetricSchema = z.object({
  type: z.literal('log_metric'),
  payload: z.object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    sleep_hours: z.number().min(0).max(14).nullable().optional(),
    sleep_quality: z.number().int().min(1).max(10).nullable().optional(),
    sleep_score: z.number().int().min(0).max(100).nullable().optional(),
    deep_sleep_min: z.number().int().min(0).max(600).nullable().optional(),
    rem_sleep_min: z.number().int().min(0).max(600).nullable().optional(),
    resting_hr: z.number().int().min(20).max(200).nullable().optional(),
    hrv: z.number().int().min(0).max(400).nullable().optional(),
    bp_systolic_morning: z.number().int().min(60).max(260).nullable().optional(),
    bp_diastolic_morning: z.number().int().min(30).max(180).nullable().optional(),
    steps: z.number().int().min(0).max(80000).nullable().optional(),
    active_time_min: z.number().int().min(0).max(1000).nullable().optional(),
    mood: z.number().int().min(1).max(10).nullable().optional(),
    energy: z.number().int().min(1).max(10).nullable().optional(),
    stress_level: z.number().int().min(1).max(10).nullable().optional(),
    weight_kg: z.number().min(20).max(400).nullable().optional(),
  }).refine(o => Object.keys(o).filter(k => k !== 'date').length > 0, 'must include at least one metric value'),
});

// Adjust-protocol uses a tiny dot-path setter against protocols.protocol_json.
// Allowed path roots are intentionally limited to "soft" sections — never
// supplements/biomarkers (those need a full regenerate).
const ALLOWED_PROTOCOL_ROOTS = new Set([
  'sleep.targetBedtime', 'sleep.targetWakeTime', 'sleep.idealBedtime', 'sleep.idealWakeTime',
  'sleep.caffeineLimit', 'sleep.morningLightMinutes',
  'nutrition.eatingWindow', 'nutrition.dailyCalories',
  'nutrition.macros.protein', 'nutrition.macros.carbs', 'nutrition.macros.fat',
  'exercise.dailyStepsTarget', 'exercise.zone2Target', 'exercise.strengthSessions', 'exercise.hiitSessions',
  'dailyBriefing.morningPriorities', 'dailyBriefing.eveningReview',
]);

const AdjustProtocolSchema = z.object({
  type: z.literal('adjust_protocol'),
  payload: z.object({
    path: z.string().refine(p => ALLOWED_PROTOCOL_ROOTS.has(p), 'path not in allowlist'),
    value: z.unknown(),  // type-checked downstream by the path's expected shape
  }),
});

const ActionSchema = z.discriminatedUnion('type', [
  UpdateProfileSchema,
  LogMetricSchema,
  AdjustProtocolSchema,
]);

// ─────────────────────────────────────────────────────────────────────────────
export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const body = await request.json();
    const parsed = ActionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid action', details: parsed.error.issues }, { status: 400 });
    }
    const action = parsed.data;

    if (action.type === 'update_profile') {
      const { onboarding_data_patch, ...directFields } = action.payload;

      // Atomic RPC — applies only non-null args via COALESCE and merges the
      // onboarding_data jsonb server-side. No read-before-write, so this can
      // safely race against cron or another tab without losing writes.
      const { error } = await supabase.rpc('apply_profile_patch', {
        p_user_id: user.id,
        p_height_cm: directFields.height_cm ?? null,
        p_weight_kg: directFields.weight_kg ?? null,
        p_activity_level: directFields.activity_level ?? null,
        p_sleep_hours_avg: directFields.sleep_hours_avg ?? null,
        p_cardio_minutes_per_week: directFields.cardio_minutes_per_week ?? null,
        p_strength_sessions_per_week: directFields.strength_sessions_per_week ?? null,
        p_alcohol_drinks_per_week: directFields.alcohol_drinks_per_week ?? null,
        p_caffeine_mg_per_day: directFields.caffeine_mg_per_day ?? null,
        p_smoker: directFields.smoker ?? null,
        p_od_patch: onboarding_data_patch ?? {},
      });
      if (error) throw new Error(error.message);
      return NextResponse.json({ ok: true, applied: 'profile', changed: Object.keys(directFields).length + (onboarding_data_patch ? 1 : 0) });
    }

    if (action.type === 'log_metric') {
      const { date, ...metrics } = action.payload;
      // Strip null/undefined so the RPC's COALESCE treats "not mentioned in
      // this chat turn" as "don't touch" rather than "clear". Matches the
      // original merge semantic without the race.
      const patch: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(metrics)) {
        if (v !== null && v !== undefined) patch[k] = v;
      }
      // Atomic RPC — only keys in `patch` get written; everything else
      // (including fields set by another tab between reads) stays intact.
      const { error } = await supabase.rpc('apply_daily_metric_patch', {
        p_user_id: user.id,
        p_date: date,
        p_patch: patch,
      });
      if (error) throw new Error(error.message);
      return NextResponse.json({ ok: true, applied: 'metric', date, fields: Object.keys(patch).length });
    }

    if (action.type === 'adjust_protocol') {
      const { path, value } = action.payload;
      // Atomic jsonb_set server-side — no read-modify-write window. The RPC
      // picks the user's latest active protocol under the hood.
      const { error } = await supabase.rpc('apply_protocol_adjust', {
        p_user_id: user.id,
        p_path: path,
        p_value: value,
      });
      if (error) throw new Error(error.message);
      return NextResponse.json({ ok: true, applied: 'protocol', path });
    }

    return NextResponse.json({ error: 'unhandled action type' }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
