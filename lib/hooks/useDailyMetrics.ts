'use client';

import { useState, useEffect, useCallback } from 'react';

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

export function useDailyMetrics(date: string) {
  const [metrics, setMetrics] = useState<DailyMetrics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/daily-metrics?date=${date}`)
      .then(r => r.json())
      .then(d => { setMetrics(d.metrics || { date }); setLoading(false); })
      .catch(() => setLoading(false));
  }, [date]);

  const save = useCallback(async (updates: Partial<DailyMetrics>) => {
    const merged = { ...metrics, ...updates, date };
    setMetrics(merged);
    await fetch('/api/daily-metrics', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(merged),
    });
  }, [date, metrics]);

  return { metrics: metrics || { date }, loading, save };
}

export function useDailyMetricsRange(startDate: string, endDate: string) {
  const [metrics, setMetrics] = useState<DailyMetrics[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/daily-metrics?startDate=${startDate}&endDate=${endDate}`)
      .then(r => r.json())
      .then(d => { setMetrics(d.metrics || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [startDate, endDate]);

  return { metrics, loading };
}
