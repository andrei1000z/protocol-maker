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
import { logger } from '@/lib/logger';
import { getChatActionRateLimit, checkRateLimit } from '@/lib/rate-limit';

export const runtime = 'nodejs';

// ─────────────────────────────────────────────────────────────────────────────
// Action schemas — each maps to one DB write. Keep these tight.
// ─────────────────────────────────────────────────────────────────────────────
// Direct columns on profiles that chat can mutate. Narrow by design — writes
// outside this set (ages, medication arrays, etc.) need a full regen flow.
const PROFILE_DIRECT_KEYS = new Set([
  'height_cm', 'weight_kg', 'activity_level', 'sleep_hours_avg',
  'cardio_minutes_per_week', 'strength_sessions_per_week',
  'alcohol_drinks_per_week', 'caffeine_mg_per_day', 'smoker',
]);

// Passthrough schema — accepts any key, then the handler partitions into
// direct-column writes (when the key is in PROFILE_DIRECT_KEYS) vs. an
// onboarding_data jsonb merge (everything else, including AI-invented keys
// like goal_weight_kg / targetSleepHours / idealBodyFatPct). Prevents
// 'Invalid action' rejections every time the AI proposes a new field name.
const UpdateProfileSchema = z.object({
  type: z.literal('update_profile'),
  payload: z.record(z.string(), z.unknown())
    .refine(o => Object.keys(o).length > 0, 'must change at least one field'),
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
// supplements/biomarkers (those need a full regenerate). Expanded based on
// paths the AI actually emits in conversation (cardio minutes, vegetable
// servings, protein grams, etc.) — originally too narrow and chat actions
// were bouncing off "Invalid action" for common suggestions.
const ALLOWED_PROTOCOL_ROOTS = new Set([
  // Sleep
  'sleep.targetBedtime', 'sleep.targetWakeTime', 'sleep.idealBedtime', 'sleep.idealWakeTime',
  'sleep.targetHours', 'sleep.caffeineLimit', 'sleep.morningLightMinutes',
  'sleep.windDownStart', 'sleep.screenCutoff',
  // Nutrition
  'nutrition.eatingWindow', 'nutrition.dailyCalories',
  'nutrition.macros.protein', 'nutrition.macros.carbs', 'nutrition.macros.fat',
  'nutrition.proteinGrams', 'nutrition.fiberGrams', 'nutrition.waterLitersPerDay',
  'nutrition.vegetableServingsPerDay', 'nutrition.fruitServingsPerDay',
  'nutrition.mealsPerDay', 'nutrition.alcoholDrinksPerWeek', 'nutrition.caffeineCutoffTime',
  // Exercise — the AI most frequently wants to adjust these
  'exercise.dailyStepsTarget', 'exercise.zone2Target', 'exercise.zone2MinutesPerWeek',
  'exercise.strengthSessions', 'exercise.strengthSessionsPerWeek',
  'exercise.hiitSessions', 'exercise.hiitMinutesPerWeek',
  'exercise.cardioMinutesPerWeek', 'exercise.cardioSessions',
  'exercise.yogaMobilityMinutes', 'exercise.restDays',
  // Stress / recovery
  'mindset.meditationMinutes', 'mindset.breathworkMinutes', 'mindset.saunaMinutes',
  'mindset.coldExposureMinutes',
  // Daily briefing
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

// PostgREST error codes that indicate the atomic RPC hasn't been migrated yet.
// When the schema cache can't find the function (PGRST202) or the SQL function
// itself doesn't exist (42883), fall back to the legacy read-merge-write path
// so features keep working until the user runs scripts/upgrade.sql.
function isRpcMissing(err: { code?: string; message?: string } | null | undefined): boolean {
  if (!err) return false;
  if (err.code === 'PGRST202' || err.code === '42883') return true;
  const msg = err.message?.toLowerCase() ?? '';
  return msg.includes('could not find the function')
      || msg.includes('schema cache')
      || (msg.includes('function') && msg.includes('does not exist'));
}

// Legacy deep-set — kept only for the RPC-missing fallback path on adjust_protocol.
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

    // Rate limit: 60/hour — blocks chip-apply loops (each chat message can
    // yield multiple actions; chat itself caps at 30/h, so 60 is 2× worst-case).
    const { allowed, reset } = await checkRateLimit(getChatActionRateLimit(), user.id, user.email);
    if (!allowed) {
      const resetIn = reset ? Math.max(1, Math.ceil((reset - Date.now()) / 60000)) : 60;
      return NextResponse.json({ error: `Too many actions applied. Try again in ${resetIn}m.`, rateLimited: true }, { status: 429 });
    }

    const body = await request.json();
    const parsed = ActionSchema.safeParse(body);
    if (!parsed.success) {
      // Log which path / field the AI emitted that didn't fit. Most common case:
      // an adjust_protocol path outside ALLOWED_PROTOCOL_ROOTS. Logging both
      // lets us grow the allowlist from real traffic instead of guesswork.
      const probe = body as { type?: string; payload?: { path?: string } };
      const rejectedPath = typeof probe?.payload?.path === 'string' ? probe.payload.path : undefined;
      logger.warn('chat_action.schema_reject', {
        userId: user.id,
        type: String(probe?.type || 'unknown'),
        rejectedPath,
        issuePaths: parsed.error.issues.slice(0, 5).map(i => i.path.join('.')),
      });
      // User-facing hint: name the path so the retry decision is obvious.
      const hint = rejectedPath
        ? `Path '${rejectedPath}' isn't adjustable from chat — try a full Refresh protocol instead.`
        : 'This action can\'t be applied — try asking differently.';
      return NextResponse.json({ error: hint, details: parsed.error.issues }, { status: 400 });
    }
    const action = parsed.data;

    if (action.type === 'update_profile') {
      // Partition: keys that match a known profiles column go in directFields,
      // everything else (including explicit 'onboarding_data_patch' nested by
      // the AI) gets merged into odPatch. Applies per-field range sanity on
      // the direct columns so a hallucinated weight=5000 doesn't land in DB.
      const raw = action.payload;
      const directFields: Record<string, unknown> = {};
      const odPatch: Record<string, unknown> = {};

      // If the AI nested under onboarding_data_patch explicitly, unwrap it.
      const nestedPatch = raw.onboarding_data_patch;
      if (nestedPatch && typeof nestedPatch === 'object' && !Array.isArray(nestedPatch)) {
        for (const [k, v] of Object.entries(nestedPatch as Record<string, unknown>)) odPatch[k] = v;
      }

      for (const [k, v] of Object.entries(raw)) {
        if (k === 'onboarding_data_patch') continue;
        if (PROFILE_DIRECT_KEYS.has(k)) {
          directFields[k] = v;
        } else {
          // AI-invented field — store in jsonb so it's preserved + visible in
          // the next prompt (the master prompt serializes onboardingData).
          odPatch[k] = v;
        }
      }

      // Sanity-bound direct fields. Any value outside the bound goes to odPatch
      // as a "claimed_..." key so we preserve the signal without corrupting the
      // typed column. Silent out-of-bound is worse than explicit annotation.
      const checkBound = (key: string, val: unknown, min: number, max: number, int = false): number | null => {
        const n = typeof val === 'number' ? val : Number(val);
        if (!Number.isFinite(n)) return null;
        if (int && !Number.isInteger(n)) return null;
        if (n < min || n > max) return null;
        return n;
      };
      const bounded: Record<string, unknown> = {};
      if ('height_cm' in directFields)                  bounded.height_cm                  = checkBound('height_cm', directFields.height_cm, 50, 260, true);
      if ('weight_kg' in directFields)                  bounded.weight_kg                  = checkBound('weight_kg', directFields.weight_kg, 20, 400);
      if ('activity_level' in directFields)             bounded.activity_level             = checkBound('activity_level', directFields.activity_level, 0, 4, true);
      if ('sleep_hours_avg' in directFields)            bounded.sleep_hours_avg            = checkBound('sleep_hours_avg', directFields.sleep_hours_avg, 0, 14);
      if ('cardio_minutes_per_week' in directFields)    bounded.cardio_minutes_per_week    = checkBound('cardio_minutes_per_week', directFields.cardio_minutes_per_week, 0, 2000, true);
      if ('strength_sessions_per_week' in directFields) bounded.strength_sessions_per_week = checkBound('strength_sessions_per_week', directFields.strength_sessions_per_week, 0, 14, true);
      if ('alcohol_drinks_per_week' in directFields)    bounded.alcohol_drinks_per_week    = checkBound('alcohol_drinks_per_week', directFields.alcohol_drinks_per_week, 0, 60, true);
      if ('caffeine_mg_per_day' in directFields)        bounded.caffeine_mg_per_day        = checkBound('caffeine_mg_per_day', directFields.caffeine_mg_per_day, 0, 2000, true);
      if ('smoker' in directFields)                     bounded.smoker                     = typeof directFields.smoker === 'boolean' ? directFields.smoker : null;

      // Atomic RPC — applies only non-null args via COALESCE and merges the
      // onboarding_data jsonb server-side. No read-before-write, so this can
      // safely race against cron or another tab without losing writes.
      const { error } = await supabase.rpc('apply_profile_patch', {
        p_user_id: user.id,
        p_height_cm: (bounded.height_cm as number | null) ?? null,
        p_weight_kg: (bounded.weight_kg as number | null) ?? null,
        p_activity_level: (bounded.activity_level as number | null) ?? null,
        p_sleep_hours_avg: (bounded.sleep_hours_avg as number | null) ?? null,
        p_cardio_minutes_per_week: (bounded.cardio_minutes_per_week as number | null) ?? null,
        p_strength_sessions_per_week: (bounded.strength_sessions_per_week as number | null) ?? null,
        p_alcohol_drinks_per_week: (bounded.alcohol_drinks_per_week as number | null) ?? null,
        p_caffeine_mg_per_day: (bounded.caffeine_mg_per_day as number | null) ?? null,
        p_smoker: (bounded.smoker as boolean | null) ?? null,
        p_od_patch: odPatch,
      });

      if (error && isRpcMissing(error)) {
        // Pre-migration fallback — racey but functional until upgrade.sql runs.
        let mergedOd: Record<string, unknown> | undefined;
        if (Object.keys(odPatch).length > 0) {
          const { data: existing } = await supabase.from('profiles').select('onboarding_data').eq('id', user.id).single();
          const existingOd = (existing?.onboarding_data || {}) as Record<string, unknown>;
          mergedOd = { ...existingOd, ...odPatch };
        }
        const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
        for (const [k, v] of Object.entries(bounded)) {
          if (v !== null && v !== undefined) update[k] = v;
        }
        if (mergedOd) update.onboarding_data = mergedOd;
        const { error: legacyErr } = await supabase.from('profiles').update(update).eq('id', user.id);
        if (legacyErr) throw new Error(legacyErr.message);
      } else if (error) {
        throw new Error(error.message);
      }

      const changedCount = Object.values(bounded).filter(v => v !== null && v !== undefined).length
        + Object.keys(odPatch).length;
      return NextResponse.json({ ok: true, applied: 'profile', changed: changedCount });
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

      if (error && isRpcMissing(error)) {
        // Pre-migration fallback.
        const { data: existing } = await supabase.from('daily_metrics').select('*').eq('user_id', user.id).eq('date', date).maybeSingle();
        const merged = { ...(existing || {}), ...patch, user_id: user.id, date };
        const { error: legacyErr } = await supabase.from('daily_metrics').upsert(merged, { onConflict: 'user_id,date' });
        if (legacyErr) throw new Error(legacyErr.message);
      } else if (error) {
        throw new Error(error.message);
      }

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

      if (error && isRpcMissing(error)) {
        // Pre-migration fallback — read, deepSet, write. Loses concurrent edits.
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
          .update({ protocol_json: json })
          .eq('id', protocol.id);
        if (updErr) throw new Error(updErr.message);
      } else if (error) {
        throw new Error(error.message);
      }

      return NextResponse.json({ ok: true, applied: 'protocol', path });
    }

    return NextResponse.json({ error: 'unhandled action type' }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
