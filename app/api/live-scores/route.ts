// Live refinement endpoint — runs the deterministic engine (no AI calls)
// against the user's CURRENT profile + latest bloodwork + last 30 days of
// daily_metrics, and returns the refined scores that would come out of a
// fresh regen. Used by the dashboard to show "live" numbers next to the
// "locked-in" ones from the last regen, so tracking a new metric updates
// the visible score immediately — without spending AI tokens on every log.
//
// Costs ~1 RPC + 2 SELECTs per call. SWR dedupes on the client; cron writes
// don't invalidate this (it's already fresh by definition).
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  classifyAll, calculateLongevityScore,
  estimateBiologicalAge, estimateAgingPace,
} from '@/lib/engine/classifier';
import { computeOrganSystems } from '@/lib/engine/lifestyle-diagnostics';
import {
  summarizeRecentMetrics, refineAgingPace, refineBiologicalAge,
  refineLongevityScore, type RecentMetricRow,
} from '@/lib/engine/wearable-refinement';
import type { BiomarkerValue, UserProfile } from '@/lib/types';

export const runtime = 'nodejs';
// Short-lived cache — the dashboard polls this on mount + after every
// tracking log. The real cost is Supabase latency; engine calls are ~1ms.
export const revalidate = 0;

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 30);
    const cutoffStr = cutoff.toISOString().slice(0, 10);

    // Three reads in parallel — profile, latest blood panel, last 30d metrics.
    const [profileRes, bloodRes, metricsRes] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', user.id).is('deleted_at', null).maybeSingle(),
      supabase.from('blood_tests').select('biomarkers').eq('user_id', user.id).is('deleted_at', null).order('taken_at', { ascending: false }).limit(1).maybeSingle(),
      supabase.from('daily_metrics')
        .select('resting_hr, hrv, hrv_sleep_avg, sleep_hours, sleep_score, steps, active_time_min, stress_level, stress_level_avg, bp_systolic_morning, body_fat_pct, body_score')
        .eq('user_id', user.id)
        .gte('date', cutoffStr)
        .order('date', { ascending: false })
        .limit(60),
    ]);

    const dbProfile = profileRes.data;
    if (!dbProfile) {
      return NextResponse.json({ configured: false, reason: 'no_profile' });
    }

    // Same shape the generate-protocol route flattens into UserProfile — inline
    // here so /live-scores doesn't depend on the heavier protocol handler.
    const od = (dbProfile.onboarding_data || {}) as Record<string, unknown>;
    const profile: UserProfile & Record<string, unknown> = {
      ...od,
      age: dbProfile.age, sex: dbProfile.sex,
      heightCm: dbProfile.height_cm, weightKg: dbProfile.weight_kg,
      ethnicity: dbProfile.ethnicity, occupation: dbProfile.occupation,
      activityLevel: dbProfile.activity_level,
      sleepHoursAvg: dbProfile.sleep_hours_avg, sleepQuality: dbProfile.sleep_quality,
      dietType: dbProfile.diet_type,
      alcoholDrinksPerWeek: dbProfile.alcohol_drinks_per_week,
      caffeineMgPerDay: dbProfile.caffeine_mg_per_day,
      smoker: dbProfile.smoker,
      cardioMinutesPerWeek: dbProfile.cardio_minutes_per_week,
      strengthSessionsPerWeek: dbProfile.strength_sessions_per_week,
      conditions: dbProfile.conditions || [],
      medications: dbProfile.medications || [],
      currentSupplements: dbProfile.current_supplements || [],
      allergies: dbProfile.allergies || [],
      goals: dbProfile.goals || [],
      timeBudgetMin: dbProfile.time_budget_min,
      monthlyBudgetRon: dbProfile.monthly_budget_ron,
      experimentalOpenness: dbProfile.experimental_openness,
      onboardingCompleted: !!dbProfile.onboarding_completed,
      onboardingData: od,
    } as UserProfile & Record<string, unknown>;

    const biomarkers: BiomarkerValue[] = Array.isArray(bloodRes.data?.biomarkers)
      ? (bloodRes.data!.biomarkers as BiomarkerValue[])
      : [];
    const classified = classifyAll(biomarkers);

    // Deterministic baselines — no AI.
    const chronoAge = Number(profile.age) || 35;
    const baseScore  = calculateLongevityScore(classified, profile);
    const baseBioAge = estimateBiologicalAge(profile, classified);
    const basePace   = estimateAgingPace(profile, classified);

    // Apply the SAME refinement the AI path uses so the "live" number tracks
    // what a full regen would produce (within the ±caps in wearable-refinement).
    const recent = summarizeRecentMetrics(
      (metricsRes.data || []) as RecentMetricRow[],
      { age: chronoAge, sex: String(profile.sex || 'male') },
    );
    const longevityScore = refineLongevityScore(baseScore, recent);
    const biologicalAge  = refineBiologicalAge(baseBioAge, chronoAge, recent);
    const agingPace      = refineAgingPace(basePace, recent);

    // Organ scores — lifestyle + classified biomarker blend. Deterministic.
    const organs = computeOrganSystems(profile, classified);
    const organScores: Record<string, number> = {};
    for (const o of organs) organScores[o.key] = o.score;

    return NextResponse.json({
      configured: true,
      chronoAge,
      longevityScore,
      biologicalAge,
      agingPace,
      wearableSignalDays: recent.days,
      organScores,
      hasBiomarkers: classified.length > 0,
      biomarkerCount: classified.length,
    }, {
      headers: {
        // Private — per-user data. Short max-age lets rapid page nav reuse
        // the response; the client also invalidates on tracking save.
        'Cache-Control': 'private, max-age=5, stale-while-revalidate=30',
      },
    });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
