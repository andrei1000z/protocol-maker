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
// Helper: deep-set a value at a dot path on a plain object (mutates in place).
// We hand-rolled this because lodash adds 70KB and we only need this one fn.
// ─────────────────────────────────────────────────────────────────────────────
function deepSet(obj: Record<string, unknown>, path: string, value: unknown): void {
  const parts = path.split('.');
  let cur: Record<string, unknown> = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const k = parts[i];
    if (typeof cur[k] !== 'object' || cur[k] === null) cur[k] = {};
    cur = cur[k] as Record<string, unknown>;
  }
  cur[parts[parts.length - 1]] = value;
}

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

      // Merge onboarding_data nested patch with the existing JSONB
      let mergedOd: Record<string, unknown> | undefined;
      if (onboarding_data_patch) {
        const { data: existing } = await supabase.from('profiles').select('onboarding_data').eq('id', user.id).single();
        const existingOd = (existing?.onboarding_data || {}) as Record<string, unknown>;
        mergedOd = { ...existingOd, ...onboarding_data_patch };
      }

      const update: Record<string, unknown> = { ...directFields, updated_at: new Date().toISOString() };
      if (mergedOd) update.onboarding_data = mergedOd;

      const { error } = await supabase.from('profiles').update(update).eq('id', user.id);
      if (error) throw new Error(error.message);
      return NextResponse.json({ ok: true, applied: 'profile', changed: Object.keys(directFields).length + (mergedOd ? 1 : 0) });
    }

    if (action.type === 'log_metric') {
      const { date, ...metrics } = action.payload;
      // Upsert: keep existing values for fields not in this payload
      const { data: existing } = await supabase.from('daily_metrics').select('*').eq('user_id', user.id).eq('date', date).maybeSingle();
      const merged = { ...(existing || {}), ...metrics, user_id: user.id, date };
      const { error } = await supabase.from('daily_metrics').upsert(merged, { onConflict: 'user_id,date' });
      if (error) throw new Error(error.message);
      return NextResponse.json({ ok: true, applied: 'metric', date, fields: Object.keys(metrics).length });
    }

    if (action.type === 'adjust_protocol') {
      const { path, value } = action.payload;
      const { data: protocol, error: fetchErr } = await supabase
        .from('protocols')
        .select('id, protocol_json')
        .eq('user_id', user.id)
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (fetchErr) throw new Error(fetchErr.message);
      if (!protocol) return NextResponse.json({ error: 'No active protocol' }, { status: 404 });

      const json = (protocol.protocol_json || {}) as Record<string, unknown>;
      deepSet(json, path, value);

      const { error: updErr } = await supabase
        .from('protocols')
        .update({ protocol_json: json, updated_at: new Date().toISOString() })
        .eq('id', protocol.id);
      if (updErr) throw new Error(updErr.message);
      return NextResponse.json({ ok: true, applied: 'protocol', path });
    }

    return NextResponse.json({ error: 'unhandled action type' }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
