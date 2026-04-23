'use client';

import { useCallback } from 'react';
import useSWR, { mutate as globalMutate } from 'swr';

export interface DailyMetrics {
  date: string;
  weight_kg?: number | null;
  sleep_hours?: number | null;
  sleep_quality?: number | null;
  mood?: number | null;
  energy?: number | null;
  hrv?: number | null;
  resting_hr?: number | null;
  steps?: number | null;
  workout_done?: boolean;
  workout_minutes?: number | null;
  workout_intensity?: string | null;
  stress_level?: number | null;          // midday snapshot — "right now"
  stress_level_avg?: number | null;      // evening self-report — avg across the day
  stress_bedtime?: number | null;        // night self-report — right before bed
  habits_completed?: string[];
  notes?: string | null;

  // Wearable-grade metrics (Galaxy Watch, Oura, WHOOP, Apple Watch, Garmin)
  sleep_hours_planned?: number | null;
  sleep_score?: number | null;
  deep_sleep_min?: number | null;
  light_sleep_min?: number | null;
  rem_sleep_min?: number | null;
  awake_min?: number | null;
  blood_oxygen_avg_sleep?: number | null;
  skin_temp_deviation?: number | null;
  skin_temp_deviation_min?: number | null;    // lowest delta vs 30d avg
  skin_temp_deviation_max?: number | null;    // highest delta vs 30d avg
  hrv_sleep_avg?: number | null;
  bp_systolic_morning?: number | null;
  bp_diastolic_morning?: number | null;
  bp_systolic_evening?: number | null;
  bp_diastolic_evening?: number | null;
  avg_heart_rate?: number | null;
  min_heart_rate?: number | null;
  max_heart_rate?: number | null;
  avg_respiratory_rate?: number | null;
  energy_score?: number | null;
  active_time_min?: number | null;
  activity_calories?: number | null;
  antioxidant_index?: number | null;

  // ── MORNING FASTED measurements — do AFTER waking, BEFORE food/water ──
  // These are lowest-noise when fasted. Weight has zero food+water artifact;
  // body-fat impedance readings are most accurate on dehydrated morning tissue;
  // basal body temp is the cleanest metabolic/cycle signal pre-activity.
  body_fat_pct?: number | null;           // smart scale
  muscle_mass_kg?: number | null;         // smart scale
  visceral_fat?: number | null;           // 1-60 Tanita scale rating
  body_water_pct?: number | null;         // smart scale
  bone_mass_kg?: number | null;           // smart scale
  bmr_kcal?: number | null;               // smart scale (estimate)
  basal_body_temp_c?: number | null;      // oral/forehead thermometer on waking
  body_score?: number | null;             // smart scale composite 0-100 (Withings / Renpho / Xiaomi)
}

interface SingleResponse { metrics: DailyMetrics | null; }
interface RangeResponse  { metrics: DailyMetrics[]; }

// ─────────────────────────────────────────────────────────────────────────────
// Single-day metrics with optimistic local updates.
// Same date key across pages hits the SWR cache — no re-fetch on nav.
// ─────────────────────────────────────────────────────────────────────────────
export function useDailyMetrics(date: string) {
  const key = `/api/daily-metrics?date=${date}`;
  const { data, error, isLoading, mutate } = useSWR<SingleResponse>(date ? key : null);

  const metrics = data?.metrics || ({ date } as DailyMetrics);

  const save = useCallback(async (updates: Partial<DailyMetrics>) => {
    const merged = { ...metrics, ...updates, date };
    // Optimistic update — UI reflects instantly, rollback if server errors
    await mutate(
      async () => {
        const res = await fetch('/api/daily-metrics', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(merged),
        });
        if (!res.ok) throw new Error(`Save failed: HTTP ${res.status}`);
        return { metrics: merged };
      },
      {
        optimisticData: { metrics: merged },
        rollbackOnError: true,
        populateCache: true,
        revalidate: false,
      }
    );
    // Invalidate dependent caches (stats page, insights) so they re-read
    globalMutate('/api/statistics');
  }, [date, metrics, mutate]);

  return { metrics, loading: isLoading, error, save };
}

// ─────────────────────────────────────────────────────────────────────────────
// Range metrics — single SWR key per range, cached & deduped across pages.
// ─────────────────────────────────────────────────────────────────────────────
export function useDailyMetricsRange(startDate: string, endDate: string) {
  const key = startDate && endDate ? `/api/daily-metrics?startDate=${startDate}&endDate=${endDate}` : null;
  const { data, error, isLoading } = useSWR<RangeResponse>(key);
  return {
    metrics: data?.metrics || [],
    loading: isLoading,
    error,
  };
}
