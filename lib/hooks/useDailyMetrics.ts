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
  stress_level?: number | null;
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
  ages_index?: number | null;
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
