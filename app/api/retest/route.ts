import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { logger, describeError } from '@/lib/logger';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const RetestSchema = z.object({
  biomarkers: z.array(z.object({
    code: z.string().min(1).max(40),
    value: z.number().finite().min(-1000).max(100000),
    unit: z.string().max(20).optional().default(''),
  })).min(1).max(60),
  takenAt: z.string().regex(ISO_DATE).optional().nullable(),
  labName: z.string().max(100).optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
});

export const runtime = 'nodejs';
export const maxDuration = 120;

/**
 * Retest flow — the "feedback loop" endpoint.
 *
 * Accepts either:
 *   - Raw biomarkers array (for users typing values manually)
 *   - PDF file (delegates parse to /api/parse-bloodwork)
 *
 * Then:
 *   1. Saves new blood_tests row
 *   2. Calls /api/generate-protocol internally with the user's profile + new biomarkers
 *   3. Returns the new protocol ID + a diff summary against the previous protocol
 *
 * Dashboard shows a banner "Protocol v2 — N changes from v1" when the user
 * returns, powered by protocol_json.diagnostic.previousProtocolId.
 */
export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const raw = await request.json().catch(() => null);
    const parsed = RetestSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid retest payload', issues: parsed.error.flatten() }, { status: 400 });
    }
    const body = parsed.data;
    const newBiomarkers = body.biomarkers;

    // 1) Save new blood test
    const { data: insertedTest, error: btErr } = await supabase.from('blood_tests').insert({
      user_id: user.id,
      taken_at: body.takenAt || new Date().toISOString().split('T')[0],
      biomarkers: newBiomarkers,
      lab_name: body.labName || null,
      notes: body.notes || null,
    }).select('id').single();
    if (btErr) return NextResponse.json({ error: `Blood test save failed: ${btErr.message}` }, { status: 500 });

    // 2) Load profile + pass to generate-protocol internally
    const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single();
    if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 });

    // Reshape profile → UserProfile shape expected by generate-protocol
    const profilePayload = {
      age: profile.age,
      sex: profile.sex,
      heightCm: profile.height_cm,
      weightKg: profile.weight_kg,
      ethnicity: profile.ethnicity,
      occupation: profile.occupation,
      activityLevel: profile.activity_level,
      sleepHoursAvg: profile.sleep_hours_avg,
      sleepQuality: profile.sleep_quality,
      dietType: profile.diet_type,
      alcoholDrinksPerWeek: profile.alcohol_drinks_per_week,
      caffeineMgPerDay: profile.caffeine_mg_per_day,
      smoker: profile.smoker,
      cardioMinutesPerWeek: profile.cardio_minutes_per_week,
      strengthSessionsPerWeek: profile.strength_sessions_per_week,
      conditions: profile.conditions || [],
      medications: profile.medications || [],
      currentSupplements: profile.current_supplements || [],
      allergies: profile.allergies || [],
      goals: profile.goals || [],
      timeBudgetMin: profile.time_budget_min,
      monthlyBudgetRon: profile.monthly_budget_ron,
      experimentalOpenness: profile.experimental_openness,
      onboardingData: profile.onboarding_data || {},
      onboardingCompleted: true,
      onboardingStep: 5,
    };

    // 3) Internal fetch to generate-protocol with cookies forwarded (same session)
    const cookie = request.headers.get('cookie') || '';
    const origin = new URL(request.url).origin;
    const genRes = await fetch(`${origin}/api/generate-protocol`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', cookie },
      body: JSON.stringify({ profile: profilePayload, biomarkers: newBiomarkers }),
    });

    if (!genRes.ok) {
      const err = await genRes.json().catch(() => ({}));
      return NextResponse.json({ error: err.error || `Regeneration failed (${genRes.status})` }, { status: 500 });
    }
    const genResult = await genRes.json();

    return NextResponse.json({
      success: true,
      bloodTestId: insertedTest.id,
      biologicalAge: genResult.biologicalAge,
      longevityScore: genResult.longevityScore,
      agingPace: genResult.agingPace,
    });
  } catch (err) {
    logger.error('retest.failed', { errorMessage: describeError(err) });
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
