import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { logger, describeError } from '@/lib/logger';

export const runtime = 'nodejs';

// Health bridge endpoint — accepts metric dumps from native health stores
// that the web can't reach directly (Apple HealthKit, Android Health Connect).
//
// Intended flow:
//   1. User installs an Apple Shortcut or Android Tasker action that runs
//      every morning, reads sleep/HR/HRV/steps from HealthKit / Health
//      Connect, POSTs to this endpoint with a personal token.
//   2. We accept a flat JSON object keyed by ISO date, map known fields
//      into daily_metrics, and ignore unknown fields.
//
// Auth: cookie session OR a per-user bridge_token (future column on
// profiles). For now we accept cookie-only — the user installs the
// Shortcut while logged in, and the cookie carries through if they paste
// the URL into the Shortcut's "Get Contents of URL" action.
//
// This is a stepping stone toward F2 (full HealthKit / Health Connect)
// that doesn't require a native app shell. Owner can ship a one-pager
// guide with the Shortcut template + URL.

// Allowed keys mirror daily_metrics columns. Unknown keys are dropped
// silently so a noisy Shortcut payload doesn't reject the whole entry.
const MetricSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  weight_kg: z.number().min(20).max(400).optional(),
  sleep_hours: z.number().min(0).max(14).optional(),
  sleep_quality: z.number().int().min(1).max(10).optional(),
  hrv: z.number().min(0).max(500).optional(),
  resting_hr: z.number().min(20).max(220).optional(),
  steps: z.number().int().min(0).max(200_000).optional(),
  workout_minutes: z.number().int().min(0).max(720).optional(),
  workout_done: z.boolean().optional(),
}).passthrough();

const BodySchema = z.union([
  // Single-day shorthand.
  MetricSchema,
  // Multi-day: array of MetricSchema entries.
  z.object({ entries: z.array(MetricSchema).min(1).max(31) }),
]);

const ALLOWED_KEYS = new Set([
  'weight_kg', 'sleep_hours', 'sleep_quality', 'hrv', 'resting_hr',
  'steps', 'workout_minutes', 'workout_done',
]);

function sanitize(entry: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = { date: entry.date };
  for (const [k, v] of Object.entries(entry)) {
    if (k === 'date') continue;
    if (!ALLOWED_KEYS.has(k)) continue;
    if (v === null || v === undefined) continue;
    out[k] = v;
  }
  return out;
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const raw = await request.json().catch(() => null);
    const parsed = BodySchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid body', issues: parsed.error.flatten() }, { status: 400 });
    }

    // Normalize to an array of entries regardless of input shape.
    // The union discriminates on the presence of `entries`; we widen here
    // so map/filter work cleanly without a tighter narrowing helper.
    const entries: Record<string, unknown>[] = 'entries' in parsed.data
      ? (parsed.data.entries as Record<string, unknown>[])
      : [parsed.data as Record<string, unknown>];

    const rows = entries
      .map((e) => sanitize(e))
      .map((e) => ({ ...e, user_id: user.id }));

    // Upsert by (user_id, date) so re-syncing the same day overwrites in
    // place rather than creating duplicates.
    const { error } = await supabase.from('daily_metrics').upsert(rows, { onConflict: 'user_id,date' });
    if (error) {
      logger.error('health_bridge.upsert_failed', { userId: user.id, errorMessage: error.message });
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, applied: rows.length });
  } catch (err) {
    logger.error('health_bridge.handler_failed', { errorMessage: describeError(err) });
    return NextResponse.json({ error: describeError(err) }, { status: 500 });
  }
}
