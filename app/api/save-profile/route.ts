import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const body = await request.json();
    const { error } = await supabase.from('profiles').update({
      age: body.age,
      sex: body.sex,
      height_cm: body.heightCm,
      weight_kg: body.weightKg,
      ethnicity: body.ethnicity,
      latitude: body.latitude,
      occupation: body.occupation,
      activity_level: body.activityLevel,
      sleep_hours_avg: body.sleepHoursAvg,
      sleep_quality: body.sleepQuality,
      diet_type: body.dietType,
      alcohol_drinks_per_week: body.alcoholDrinksPerWeek,
      caffeine_mg_per_day: body.caffeineMgPerDay,
      smoker: body.smoker,
      cardio_minutes_per_week: body.cardioMinutesPerWeek,
      strength_sessions_per_week: body.strengthSessionsPerWeek,
      conditions: body.conditions,
      medications: body.medications,
      current_supplements: body.currentSupplements,
      allergies: body.allergies,
      goals: body.goals,
      time_budget_min: body.timeBudgetMin,
      monthly_budget_ron: body.monthlyBudgetRon,
      experimental_openness: body.experimentalOpenness,
      onboarding_completed: body.onboardingCompleted ?? false,
      onboarding_step: body.onboardingStep ?? 0,
      onboarding_data: body.onboardingData ?? {},
    }).eq('id', user.id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
