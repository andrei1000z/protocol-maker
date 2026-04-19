import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { logger, describeError } from '@/lib/logger';

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
  onboardingData: z.record(z.string(), z.unknown()).optional(),
}).passthrough();  // extra fields are dropped; Zod ignores them during .passthrough

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const raw = await request.json().catch(() => null);
    const parsed = ProfileSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid profile', issues: parsed.error.flatten() }, { status: 400 });
    }
    const body = parsed.data;

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

    if (error) {
      logger.error('save_profile.db_failed', { userId: user.id, errorMessage: error.message });
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ success: true });
  } catch (err) {
    logger.error('save_profile.handler_failed', { errorMessage: describeError(err) });
    return NextResponse.json({ error: describeError(err) }, { status: 500 });
  }
}
