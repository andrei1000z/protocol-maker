'use client';

// ============================================================================
// SWR-backed typed hooks for every app API.
// ----------------------------------------------------------------------------
// Why this exists: pages used to call `fetch('/api/my-data')` inside useEffect
// on EVERY navigation. That meant a full roundtrip every time the user clicked
// Dashboard → Settings → Tracking. SWR dedupes the in-flight request, caches
// the response across routes, and revalidates in the background. Net effect:
// most page transitions feel instant because the data is already in memory.
//
// Global provider sits in app/providers.tsx with a shared fetcher,
// dedupingInterval, and focus-revalidation. These hooks just key off endpoints.
// ============================================================================

import useSWR, { SWRConfiguration, mutate as globalMutate } from 'swr';

// ─────────────────────────────────────────────────────────────────────────────
// Types — loose enough to match current backend shapes without overspecifying
// ─────────────────────────────────────────────────────────────────────────────
export interface ProtocolRow {
  id: string;
  created_at: string;
  longevity_score: number | null;
  biological_age: number | null;
  biological_age_decimal: number | null;
  aging_pace: number | null;
  protocol_json: Record<string, unknown>;
  model_used: string | null;
  generation_source: string | null;
}

export interface ProfileRow {
  id: string;
  age?: number | null;
  sex?: string | null;
  height_cm?: number | null;
  weight_kg?: number | null;
  ethnicity?: string | null;
  occupation?: string | null;
  activity_level?: string | null;
  sleep_hours_avg?: number | null;
  sleep_quality?: number | null;
  diet_type?: string | null;
  alcohol_drinks_per_week?: number | null;
  caffeine_mg_per_day?: number | null;
  smoker?: boolean | null;
  cardio_minutes_per_week?: number | null;
  strength_sessions_per_week?: number | null;
  conditions?: string[] | null;
  medications?: Array<{ name: string; dose: string; frequency: string }> | null;
  current_supplements?: string[] | null;
  allergies?: string[] | null;
  goals?: unknown[] | null;
  time_budget_min?: number | null;
  monthly_budget_ron?: number | null;
  experimental_openness?: string | null;
  onboarding_completed?: boolean | null;
  onboarding_step?: number | null;
  onboarding_data?: Record<string, unknown> | null;
}

export interface BloodTestRow {
  id: string;
  taken_at: string;
  biomarkers: Array<{ code: string; value: number; unit: string }>;
}

interface MyDataResponse {
  profile: ProfileRow | null;
  protocol: ProtocolRow | null;
  bloodTests: BloodTestRow[];
}

interface StatisticsResponse {
  metrics: Array<Record<string, unknown>>;
  protocolStartedAt: string | null;
}

interface ProtocolHistoryResponse {
  protocols: ProtocolRow[];
}

interface ComplianceLog { item_type: string; item_name: string; date: string; completed: boolean; }
interface ComplianceTodayResponse { logs: ComplianceLog[]; }
interface ComplianceHistoryResponse { history: Array<{ date: string; completed: number; total: number; pct: number }>; }

// ─────────────────────────────────────────────────────────────────────────────
// Common options
// ─────────────────────────────────────────────────────────────────────────────
const fastCache: SWRConfiguration = {
  revalidateOnFocus: false,   // don't refetch every focus — data is already good
  revalidateOnReconnect: true,
  dedupingInterval: 30_000,   // same key within 30s = cached
  keepPreviousData: true,     // avoid layout flicker during revalidation
};

const realtimeish: SWRConfiguration = {
  revalidateOnFocus: true,
  revalidateOnReconnect: true,
  dedupingInterval: 5_000,
  keepPreviousData: true,
};

// ─────────────────────────────────────────────────────────────────────────────
// Hooks — one per endpoint
// ─────────────────────────────────────────────────────────────────────────────

/** Profile + latest protocol + blood tests. The workhorse — used by nearly every page. */
export function useMyData() {
  return useSWR<MyDataResponse>('/api/my-data', fastCache);
}

// Live-scores response — deterministic refined numbers computed on every
// call. Dashboard shows these alongside the "locked in" protocol scores so
// a new tracking log updates the visible number instantly.
interface LiveScoresResponse {
  configured: boolean;
  reason?: string;
  chronoAge?: number;
  longevityScore?: number;
  biologicalAge?: number;
  agingPace?: number;
  wearableSignalDays?: number;
  organScores?: Record<string, number>;
  hasBiomarkers?: boolean;
  biomarkerCount?: number;
}

/** Deterministic refinement of bio-age / pace / longevity score. Cheap —
 *  no AI. Re-reads on every tracking save via invalidate.liveScores(). */
export function useLiveScores() {
  return useSWR<LiveScoresResponse>('/api/live-scores', realtimeish);
}

export function useStatistics() {
  return useSWR<StatisticsResponse>('/api/statistics', fastCache);
}

export function useProtocolHistory() {
  return useSWR<ProtocolHistoryResponse>('/api/protocol-history', fastCache);
}

interface ProtocolDiffResponse {
  diff: null | {
    currentId: string;
    previousId: string;
    currentDate: string;
    previousDate: string;
    daysBetween: number;
    score: { prev: number | null; curr: number | null; delta: number };
    bioAge: { prev: number | null; curr: number | null; delta: number };
    agingPace: { prev: number | null; curr: number | null; delta: number };
    supplements: { added: string[]; removed: string[]; kept: string[]; addedCount: number; removedCount: number; keptCount: number };
    totalChanges: number;
  };
}

/** Latest vs previous protocol diff — drives the v1→v2 banner on the dashboard. */
export function useProtocolDiff() {
  return useSWR<ProtocolDiffResponse>('/api/protocol-history/diff', fastCache);
}

export function useComplianceToday(date: string) {
  return useSWR<ComplianceTodayResponse>(date ? `/api/compliance?date=${date}` : null, realtimeish);
}

export function useComplianceHistory(startDate: string, endDate: string) {
  return useSWR<ComplianceHistoryResponse>(
    startDate && endDate ? `/api/compliance/history?startDate=${startDate}&endDate=${endDate}` : null,
    fastCache
  );
}

interface MealRowPartial {
  id: string;
  eaten_at: string;
  source: 'photo' | 'text' | 'photo_with_text';
  user_text: string | null;
  title: string;
  description: string | null;
  ingredients: string[];
  calories: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  fiber_g: number | null;
  verdict: 'good' | 'mixed' | 'bad' | null;
  verdict_reasons: string[];
  ai_model: string | null;
  created_at: string;
}
interface MealsResponse { meals: MealRowPartial[]; days: number; }

/** Recent meal log — 7-day window by default. Invalidated after every save. */
export function useMeals(days = 7) {
  return useSWR<MealsResponse>(`/api/meals?days=${days}`, realtimeish);
}

// ─────────────────────────────────────────────────────────────────────────────
// Cache invalidators — call after mutations that change server state
// ─────────────────────────────────────────────────────────────────────────────
export const invalidate = {
  myData:           () => globalMutate('/api/my-data'),
  statistics:       () => globalMutate('/api/statistics'),
  protocolHistory:  () => globalMutate('/api/protocol-history'),
  liveScores:       () => globalMutate('/api/live-scores'),
  compliance:       () => globalMutate((key) => typeof key === 'string' && key.startsWith('/api/compliance')),
  dailyMetrics:     () => globalMutate((key) => typeof key === 'string' && key.startsWith('/api/daily-metrics')),
  meals:            () => globalMutate((key) => typeof key === 'string' && key.startsWith('/api/meals')),
  all:              () => globalMutate(() => true),
};
