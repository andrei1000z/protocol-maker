// WHOOP Web API integration — pulls recovery, sleep, cycle (strain), and
// workout data into daily_metrics. WHOOP's flagship signal is HRV (they
// sample it continuously during sleep), so this integration is especially
// valuable for the wearable-refinement layer.
//
// Docs: https://developer.whoop.com/
// Register at the same URL → "Create App" → grab client_id + client_secret.
// Redirect URI to register: https://<your-domain>/api/integrations/whoop/callback

import { buildRedirectUrl, type TokenResult } from './base';

const AUTH_URL  = 'https://api.prod.whoop.com/oauth/oauth2/auth';
const TOKEN_URL = 'https://api.prod.whoop.com/oauth/oauth2/token';
const API_BASE  = 'https://api.prod.whoop.com/developer/v1';

// WHOOP scopes — pick ones that map to daily_metrics columns. `offline` is
// what lets us refresh the token later; without it, we'd have to re-prompt.
export const WHOOP_SCOPES = [
  'offline',
  'read:recovery',
  'read:sleep',
  'read:cycles',
  'read:workout',
  'read:profile',
] as const;

export function isConfigured(): boolean {
  return !!process.env.WHOOP_CLIENT_ID && !!process.env.WHOOP_CLIENT_SECRET;
}

export function buildAuthorizeUrl(state: string): string {
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: process.env.WHOOP_CLIENT_ID || '',
    redirect_uri: buildRedirectUrl('whoop'),
    scope: WHOOP_SCOPES.join(' '),
    state,
  });
  return `${AUTH_URL}?${params.toString()}`;
}

async function postForm(body: Record<string, string>): Promise<TokenResult> {
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(body).toString(),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`WHOOP token call failed (${res.status}): ${text.slice(0, 200)}`);
  }
  const j = await res.json() as {
    access_token: string; refresh_token?: string; token_type: string;
    expires_in: number; scope?: string;
  };
  return {
    accessToken: j.access_token,
    refreshToken: j.refresh_token,
    tokenType: j.token_type,
    expiresIn: j.expires_in,
    scope: j.scope,
  };
}

export async function exchangeCodeForTokens(code: string): Promise<TokenResult> {
  return postForm({
    grant_type: 'authorization_code',
    code,
    redirect_uri: buildRedirectUrl('whoop'),
    client_id: process.env.WHOOP_CLIENT_ID || '',
    client_secret: process.env.WHOOP_CLIENT_SECRET || '',
  });
}

export async function refreshAccessToken(refreshToken: string): Promise<TokenResult> {
  return postForm({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
    client_id: process.env.WHOOP_CLIENT_ID || '',
    client_secret: process.env.WHOOP_CLIENT_SECRET || '',
  });
}

async function whoopGet<T>(path: string, token: string, query: Record<string, string> = {}): Promise<T | null> {
  const q = new URLSearchParams(query).toString();
  const url = `${API_BASE}${path}${q ? `?${q}` : ''}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (res.status === 404) return null;
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`WHOOP ${path} (${res.status}): ${text.slice(0, 200)}`);
  }
  return res.json() as Promise<T>;
}

// WHOOP splits days by "cycle" (wake-to-wake) rather than calendar date.
// For each recovery record, the `created_at` date is our "day bucket".

interface RecoveryResp {
  records: Array<{
    cycle_id: number;
    sleep_id?: number;
    created_at: string;            // ISO timestamp
    updated_at?: string;
    score_state: string;
    score?: {
      recovery_score?: number;     // 0-100
      resting_heart_rate?: number; // bpm
      hrv_rmssd_milli?: number;    // ms
      spo2_percentage?: number;
      skin_temp_celsius?: number;  // NOT a deviation — absolute celsius
    };
  }>;
}
interface SleepResp {
  records: Array<{
    id: number;
    start: string;
    end: string;
    score?: {
      stage_summary?: {
        total_in_bed_time_milli?: number;
        total_awake_time_milli?: number;
        total_light_sleep_time_milli?: number;
        total_slow_wave_sleep_time_milli?: number;
        total_rem_sleep_time_milli?: number;
        sleep_performance_percentage?: number;
      };
    };
  }>;
}
interface WorkoutResp {
  records: Array<{
    created_at: string;
    start: string;
    end: string;
    score?: {
      strain?: number;
      kilojoule?: number;
      average_heart_rate?: number;
      max_heart_rate?: number;
    };
  }>;
}

export interface WhoopDailySnapshot {
  date: string;
  hrv_sleep_avg?: number;
  resting_hr?: number;
  energy_score?: number;         // WHOOP calls it "recovery" — we store under energy_score
  blood_oxygen_avg_sleep?: number;
  sleep_hours?: number;
  deep_sleep_min?: number;
  light_sleep_min?: number;
  rem_sleep_min?: number;
  awake_min?: number;
  sleep_score?: number;
  avg_heart_rate?: number;
  max_heart_rate?: number;
  active_time_min?: number;
  activity_calories?: number;
}

const msToMin = (ms?: number) => (typeof ms === 'number' ? Math.round(ms / 60_000) : undefined);
const msToHours = (ms?: number) => (typeof ms === 'number' ? Math.round(ms / 3600_000 * 100) / 100 : undefined);

function toDate(iso: string): string { return iso.slice(0, 10); }

export async function fetchDailySnapshots(
  token: string,
  startDate: string,
  endDate: string,
): Promise<WhoopDailySnapshot[]> {
  // WHOOP API uses ISO timestamps for start/end query params.
  const q = {
    start: `${startDate}T00:00:00.000Z`,
    end: `${endDate}T23:59:59.999Z`,
    limit: '25',  // max per request
  };

  const [recRes, sleepRes, workoutRes] = await Promise.allSettled([
    whoopGet<RecoveryResp>('/recovery', token, q),
    whoopGet<SleepResp>('/activity/sleep', token, q),
    whoopGet<WorkoutResp>('/activity/workout', token, q),
  ]);

  const byDate = new Map<string, WhoopDailySnapshot>();
  const ensure = (date: string): WhoopDailySnapshot => {
    let s = byDate.get(date);
    if (!s) { s = { date }; byDate.set(date, s); }
    return s;
  };

  if (recRes.status === 'fulfilled' && recRes.value) {
    for (const r of recRes.value.records) {
      if (!r.score) continue;
      const s = ensure(toDate(r.created_at));
      if (typeof r.score.hrv_rmssd_milli === 'number')    s.hrv_sleep_avg = Math.round(r.score.hrv_rmssd_milli);
      if (typeof r.score.resting_heart_rate === 'number') s.resting_hr = r.score.resting_heart_rate;
      if (typeof r.score.recovery_score === 'number')     s.energy_score = r.score.recovery_score;
      if (typeof r.score.spo2_percentage === 'number')    s.blood_oxygen_avg_sleep = r.score.spo2_percentage;
    }
  }

  if (sleepRes.status === 'fulfilled' && sleepRes.value) {
    // One user can have multiple sleep rows per day (naps); keep the longest.
    const mainByDate = new Map<string, SleepResp['records'][number]>();
    for (const r of sleepRes.value.records) {
      const day = toDate(r.start);
      const prev = mainByDate.get(day);
      const dur = r.score?.stage_summary?.total_in_bed_time_milli ?? 0;
      const prevDur = prev?.score?.stage_summary?.total_in_bed_time_milli ?? 0;
      if (!prev || dur > prevDur) mainByDate.set(day, r);
    }
    for (const [day, r] of mainByDate) {
      const st = r.score?.stage_summary;
      if (!st) continue;
      const s = ensure(day);
      s.sleep_hours = msToHours(st.total_in_bed_time_milli);
      s.awake_min = msToMin(st.total_awake_time_milli);
      s.light_sleep_min = msToMin(st.total_light_sleep_time_milli);
      s.deep_sleep_min = msToMin(st.total_slow_wave_sleep_time_milli);
      s.rem_sleep_min = msToMin(st.total_rem_sleep_time_milli);
      if (typeof st.sleep_performance_percentage === 'number') s.sleep_score = Math.round(st.sleep_performance_percentage);
    }
  }

  if (workoutRes.status === 'fulfilled' && workoutRes.value) {
    // Accumulate per-day workout minutes + calories across multiple sessions.
    const dayAgg = new Map<string, { minutes: number; cals: number; maxHr: number; avgHrSum: number; avgHrCount: number }>();
    for (const w of workoutRes.value.records) {
      const day = toDate(w.start);
      const minutes = (new Date(w.end).getTime() - new Date(w.start).getTime()) / 60_000;
      const cals = w.score?.kilojoule ? w.score.kilojoule / 4.184 : 0;  // kJ → kcal
      const maxHr = w.score?.max_heart_rate ?? 0;
      const avgHr = w.score?.average_heart_rate ?? 0;
      const prev = dayAgg.get(day) || { minutes: 0, cals: 0, maxHr: 0, avgHrSum: 0, avgHrCount: 0 };
      prev.minutes += minutes;
      prev.cals += cals;
      prev.maxHr = Math.max(prev.maxHr, maxHr);
      if (avgHr > 0) { prev.avgHrSum += avgHr; prev.avgHrCount++; }
      dayAgg.set(day, prev);
    }
    for (const [day, agg] of dayAgg) {
      const s = ensure(day);
      if (agg.minutes > 0) s.active_time_min = Math.round(agg.minutes);
      if (agg.cals > 0)    s.activity_calories = Math.round(agg.cals);
      if (agg.maxHr > 0)   s.max_heart_rate = agg.maxHr;
      if (agg.avgHrCount > 0) s.avg_heart_rate = Math.round(agg.avgHrSum / agg.avgHrCount);
    }
  }

  return Array.from(byDate.values()).sort((a, b) => a.date.localeCompare(b.date));
}
