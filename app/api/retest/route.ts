import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

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

    const body = await request.json().catch(() => ({}));
    const newBiomarkers = body.biomarkers;

    if (!Array.isArray(newBiomarkers) || newBiomarkers.length === 0) {
      return NextResponse.json({ error: 'biomarkers[] required (code, value, unit per item)' }, { status: 400 });
    }

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
    console.error('retest error:', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
