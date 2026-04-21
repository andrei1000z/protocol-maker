import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { logger, describeError } from '@/lib/logger';
import { getSaveProfileRateLimit, checkRateLimit } from '@/lib/rate-limit';
import { trackServer } from '@/lib/analytics';
import { OnboardingDataSchema } from '@/lib/engine/schemas';

// Validates profile inputs at the API boundary. Ranges are sanity checks —
// the DB has its own CHECK constraints as defense in depth. All fields are
// optional because partial saves (per-step onboarding) are normal.
const ProfileSchema = z.object({
  age: z.number().int().min(5).max(120).optional().nullable(),
  sex: z.enum(['male', 'female', 'intersex']).optional().nullable(),
  heightCm: z.number().min(50).max(260).optional().nullable(),
  weightKg: z.number().min(20).max(400).optional().nullable(),
  ethnicity: z.string().max(60).optional().nullable(),
  latitude: z.number().min(-90).max(90).optional().nullable(),
  occupation: z.string().max(80).optional().nullable(),
  activityLevel: z.string().max(20).optional().nullable(),
  sleepHoursAvg: z.number().min(0).max(14).optional().nullable(),
  sleepQuality: z.number().int().min(1).max(10).optional().nullable(),
  dietType: z.string().max(40).optional().nullable(),
  alcoholDrinksPerWeek: z.number().int().min(0).max(100).optional().nullable(),
  caffeineMgPerDay: z.number().int().min(0).max(2000).optional().nullable(),
  smoker: z.boolean().optional().nullable(),
  cardioMinutesPerWeek: z.number().int().min(0).max(2000).optional().nullable(),
  strengthSessionsPerWeek: z.number().int().min(0).max(14).optional().nullable(),
  conditions: z.array(z.string().max(80)).max(40).optional().nullable(),
  medications: z.array(z.unknown()).max(40).optional().nullable(),
  currentSupplements: z.array(z.string().max(120)).max(60).optional().nullable(),
  allergies: z.array(z.string().max(80)).max(40).optional().nullable(),
  goals: z.array(z.string().max(80)).max(20).optional().nullable(),
  timeBudgetMin: z.number().int().min(0).max(600).optional().nullable(),
  monthlyBudgetRon: z.number().int().min(0).max(100000).optional().nullable(),
  experimentalOpenness: z.enum(['otc_only', 'open_rx', 'open_experimental']).optional().nullable(),
  onboardingCompleted: z.boolean().optional(),
  onboardingStep: z.number().int().min(0).max(10).optional(),
  // Typed onboarding blob. Passthrough tolerates unknown keys (future steps,
  // client-side scratch fields) while validating the shape of what we know.
  onboardingData: OnboardingDataSchema.optional(),
  // Notification prefs — 4 independent opt-ins; booleans persist to narrow
  // columns on the profile row. All default off except protocol regen
  // alerts, which users expect out of the box.
  notifWeeklyDigest:     z.boolean().optional(),
  notifProtocolRegen:    z.boolean().optional(),
  notifRetestReminders:  z.boolean().optional(),
  notifStreakMilestones: z.boolean().optional(),
}).passthrough();  // extra fields are dropped; Zod ignores them during .passthrough

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    // Rate limit: 20/hour — onboarding saves per-step + occasional settings
    // edits are fine; blocks writestorms from a broken client loop.
    const { allowed, reset } = await checkRateLimit(getSaveProfileRateLimit(), user.id, user.email);
    if (!allowed) {
      const resetIn = reset ? Math.max(1, Math.ceil((reset - Date.now()) / 60000)) : 60;
      return NextResponse.json({ error: `Too many saves. Try again in ${resetIn}m.`, rateLimited: true }, { status: 429 });
    }

    const raw = await request.json().catch(() => null);
    const parsed = ProfileSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid profile', issues: parsed.error.flatten() }, { status: 400 });
    }
    const body = parsed.data;

    // Detect onboarding_complete transition so we track it ONCE per user,
    // not every subsequent settings save. One extra cheap read keyed by id.
    let wasOnboarded = false;
    if (body.onboardingCompleted) {
      const { data: prev } = await supabase.from('profiles').select('onboarding_completed').eq('id', user.id).maybeSingle();
      wasOnboarded = !!prev?.onboarding_completed;
    }

    // Build a partial update so sending just `{ notifWeeklyDigest: true }`
    // from settings doesn't null out the user's age. Keys absent from the
    // incoming body are left untouched on the row. Onboarding still sends
    // everything in one go, so the full-save behaviour is preserved.
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    const mapping: Array<[keyof typeof body, string]> = [
      ['age', 'age'],
      ['sex', 'sex'],
      ['heightCm', 'height_cm'],
      ['weightKg', 'weight_kg'],
      ['ethnicity', 'ethnicity'],
      ['latitude', 'latitude'],
      ['occupation', 'occupation'],
      ['activityLevel', 'activity_level'],
      ['sleepHoursAvg', 'sleep_hours_avg'],
      ['sleepQuality', 'sleep_quality'],
      ['dietType', 'diet_type'],
      ['alcoholDrinksPerWeek', 'alcohol_drinks_per_week'],
      ['caffeineMgPerDay', 'caffeine_mg_per_day'],
      ['smoker', 'smoker'],
      ['cardioMinutesPerWeek', 'cardio_minutes_per_week'],
      ['strengthSessionsPerWeek', 'strength_sessions_per_week'],
      ['conditions', 'conditions'],
      ['medications', 'medications'],
      ['currentSupplements', 'current_supplements'],
      ['allergies', 'allergies'],
      ['goals', 'goals'],
      ['timeBudgetMin', 'time_budget_min'],
      ['monthlyBudgetRon', 'monthly_budget_ron'],
      ['experimentalOpenness', 'experimental_openness'],
      ['onboardingCompleted', 'onboarding_completed'],
      ['onboardingStep', 'onboarding_step'],
      ['onboardingData', 'onboarding_data'],
      ['notifWeeklyDigest', 'notif_weekly_digest'],
      ['notifProtocolRegen', 'notif_protocol_regen'],
      ['notifRetestReminders', 'notif_retest_reminders'],
      ['notifStreakMilestones', 'notif_streak_milestones'],
    ];
    for (const [k, col] of mapping) {
      if (k in body) updates[col] = body[k];
    }

    const { error } = await supabase.from('profiles').update(updates).eq('id', user.id);

    if (error) {
      logger.error('save_profile.db_failed', { userId: user.id, errorMessage: error.message });
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    // Fire once, on the false→true transition. Subsequent saves (settings
    // edits where the flag stays true) don't re-fire.
    if (body.onboardingCompleted && !wasOnboarded) {
      trackServer('onboarding_complete');
    }
    return NextResponse.json({ success: true });
  } catch (err) {
    logger.error('save_profile.handler_failed', { errorMessage: describeError(err) });
    return NextResponse.json({ error: describeError(err) }, { status: 500 });
  }
}
