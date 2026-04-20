// Oura OAuth + data-sync client.
//
// Why a dedicated module: Oura's API is a 4-endpoint graphql-like REST surface
// (daily_sleep, daily_activity, daily_readiness, daily_spo2). The mapping into
// our daily_metrics columns is opinionated (which value wins on overlap, how to
// flatten deep/light/rem when Oura returns nested objects). Keeping it here
// means the cron and on-demand endpoints share the same rules.
//
// Configuration is env-var driven:
//   OURA_CLIENT_ID, OURA_CLIENT_SECRET — from https://cloud.ouraring.com/oauth/applications
//   OURA_REDIRECT_URL (optional) — defaults to `${SITE_URL}/api/integrations/oura/callback`
//
// If OURA_CLIENT_ID is unset, `isConfigured()` returns false and the Settings
// UI gracefully shows a "not yet configured" state instead of a broken button.

import { SITE_URL } from '@/lib/config';

const OURA_AUTHORIZE_URL = 'https://cloud.ouraring.com/oauth/authorize';
const OURA_TOKEN_URL = 'https://api.ouraring.com/oauth/token';
const OURA_API_BASE = 'https://api.ouraring.com/v2/usercollection';

// Scopes we need for the daily-metric columns we populate. email is requested
// only for account linking / disambiguation; we don't store it.
export const OURA_SCOPES = [
  'email',
  'personal',
  'daily',
  'heartrate',
  'workout',
  'session',
  'spo2Daily',
] as const;

export function isConfigured(): boolean {
  return !!process.env.OURA_CLIENT_ID && !!process.env.OURA_CLIENT_SECRET;
}

export function getRedirectUrl(): string {
  return process.env.OURA_REDIRECT_URL || `${SITE_URL}/api/integrations/oura/callback`;
}

// Build the authorize URL the user gets redirected to.
// `state` is a CSRF + round-trip payload — a random token we verify on callback.
export function buildAuthorizeUrl(state: string): string {
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: process.env.OURA_CLIENT_ID || '',
    redirect_uri: getRedirectUrl(),
    scope: OURA_SCOPES.join(' '),
    state,
  });
  return `${OURA_AUTHORIZE_URL}?${params.toString()}`;
}

export interface OuraTokenResponse {
  access_token: string;
  refresh_token?: string;
  token_type: string;
  expires_in: number;
  scope?: string;
}

async function postForm(url: string, body: Record<string, string>): Promise<Response> {
  return fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(body).toString(),
  });
}

export async function exchangeCodeForTokens(code: string): Promise<OuraTokenResponse> {
  const res = await postForm(OURA_TOKEN_URL, {
    grant_type: 'authorization_code',
    code,
    redirect_uri: getRedirectUrl(),
    client_id: process.env.OURA_CLIENT_ID || '',
    client_secret: process.env.OURA_CLIENT_SECRET || '',
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Oura token exchange failed (${res.status}): ${text.slice(0, 200)}`);
  }
  return res.json();
}

export async function refreshAccessToken(refreshToken: string): Promise<OuraTokenResponse> {
  const res = await postForm(OURA_TOKEN_URL, {
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
    client_id: process.env.OURA_CLIENT_ID || '',
    client_secret: process.env.OURA_CLIENT_SECRET || '',
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Oura refresh failed (${res.status}): ${text.slice(0, 200)}`);
  }
  return res.json();
}

async function ouraGet(path: string, token: string, query: Record<string, string> = {}): Promise<unknown> {
  const q = new URLSearchParams(query).toString();
  const url = `${OURA_API_BASE}/${path}${q ? `?${q}` : ''}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    const err: Error & { status?: number } = new Error(`Oura ${path} failed (${res.status}): ${text.slice(0, 200)}`);
    err.status = res.status;
    throw err;
  }
  return res.json();
}

// Response shapes — kept narrow to only the fields we actually consume.
interface OuraDailySleep {
  day: string;          // YYYY-MM-DD
  score?: number;       // 0–100
}
interface OuraSleepRow {
  day: string;
  total_sleep_duration?: number;      // seconds
  deep_sleep_duration?: number;
  light_sleep_duration?: number;
  rem_sleep_duration?: number;
  awake_time?: number;
  average_heart_rate?: number;
  lowest_heart_rate?: number;
  average_hrv?: number;
  average_breath?: number;
}
interface OuraDailyActivity {
  day: string;
  steps?: number;
  active_calories?: number;
  average_met_minutes?: number;
  high_activity_time?: number;  // seconds
  medium_activity_time?: number;
}
interface OuraDailyReadiness {
  day: string;
  score?: number;                          // 0-100
  temperature_deviation?: number;          // °C vs personal baseline
  temperature_trend_deviation?: number;
}
interface OuraDailySpo2 {
  day: string;
  spo2_percentage?: { average?: number };
}
interface OuraList<T> { data?: T[]; next_token?: string; }

// One-day normalized snapshot — what we upsert into daily_metrics.
export interface OuraDailySnapshot {
  date: string;
  sleep_score?: number;
  sleep_hours?: number;
  deep_sleep_min?: number;
  light_sleep_min?: number;
  rem_sleep_min?: number;
  awake_min?: number;
  avg_heart_rate?: number;
  min_heart_rate?: number;
  hrv_sleep_avg?: number;
  avg_respiratory_rate?: number;
  steps?: number;
  active_time_min?: number;
  activity_calories?: number;
  energy_score?: number;
  skin_temp_deviation?: number;
  skin_temp_deviation_min?: number;
  skin_temp_deviation_max?: number;
  blood_oxygen_avg_sleep?: number;
}

const secToMin = (s?: number) => (typeof s === 'number' ? Math.round(s / 60) : undefined);
const secToHours = (s?: number) => (typeof s === 'number' ? Math.round(s / 36) / 100 : undefined);

// Fetch + merge the 4 daily endpoints for the given date range. Returns one
// snapshot per day that has at least one piece of data.
export async function fetchDailySnapshots(
  token: string,
  startDate: string,
  endDate: string,
): Promise<OuraDailySnapshot[]> {
  const q = { start_date: startDate, end_date: endDate };

  const [sleepRes, sleepDailyRes, activityRes, readinessRes, spo2Res] = await Promise.allSettled([
    ouraGet('sleep', token, q),
    ouraGet('daily_sleep', token, q),
    ouraGet('daily_activity', token, q),
    ouraGet('daily_readiness', token, q),
    ouraGet('daily_spo2', token, q),
  ]);

  const byDate = new Map<string, OuraDailySnapshot>();
  const ensure = (date: string): OuraDailySnapshot => {
    let s = byDate.get(date);
    if (!s) { s = { date }; byDate.set(date, s); }
    return s;
  };

  // daily_sleep → sleep_score
  if (sleepDailyRes.status === 'fulfilled') {
    for (const d of ((sleepDailyRes.value as OuraList<OuraDailySleep>).data || [])) {
      if (!d.day) continue;
      const s = ensure(d.day);
      if (typeof d.score === 'number') s.sleep_score = d.score;
    }
  }
  // sleep (detailed per-period rows — pick the longest one per day as "main sleep")
  if (sleepRes.status === 'fulfilled') {
    const rowsByDate = new Map<string, OuraSleepRow>();
    for (const r of ((sleepRes.value as OuraList<OuraSleepRow>).data || [])) {
      if (!r.day) continue;
      const prev = rowsByDate.get(r.day);
      if (!prev || (r.total_sleep_duration || 0) > (prev.total_sleep_duration || 0)) {
        rowsByDate.set(r.day, r);
      }
    }
    for (const [day, r] of rowsByDate.entries()) {
      const s = ensure(day);
      s.sleep_hours = secToHours(r.total_sleep_duration);
      s.deep_sleep_min = secToMin(r.deep_sleep_duration);
      s.light_sleep_min = secToMin(r.light_sleep_duration);
      s.rem_sleep_min = secToMin(r.rem_sleep_duration);
      s.awake_min = secToMin(r.awake_time);
      s.avg_heart_rate = r.average_heart_rate;
      s.min_heart_rate = r.lowest_heart_rate;
      s.hrv_sleep_avg = r.average_hrv;
      s.avg_respiratory_rate = r.average_breath;
    }
  }
  // daily_activity → steps / active minutes / calories
  if (activityRes.status === 'fulfilled') {
    for (const a of ((activityRes.value as OuraList<OuraDailyActivity>).data || [])) {
      if (!a.day) continue;
      const s = ensure(a.day);
      if (typeof a.steps === 'number') s.steps = a.steps;
      if (typeof a.active_calories === 'number') s.activity_calories = a.active_calories;
      const activeSec = (a.high_activity_time || 0) + (a.medium_activity_time || 0);
      if (activeSec > 0) s.active_time_min = Math.round(activeSec / 60);
    }
  }
  // daily_readiness → readiness score + skin temp deviation
  if (readinessRes.status === 'fulfilled') {
    for (const r of ((readinessRes.value as OuraList<OuraDailyReadiness>).data || [])) {
      if (!r.day) continue;
      const s = ensure(r.day);
      if (typeof r.score === 'number') s.energy_score = r.score;
      if (typeof r.temperature_deviation === 'number') {
        s.skin_temp_deviation = Math.round(r.temperature_deviation * 100) / 100;
        // Oura exposes a single daily reading — populate the range's min AND
        // max with the same value so the range-aware classifier still works.
        s.skin_temp_deviation_min = s.skin_temp_deviation;
        s.skin_temp_deviation_max = s.skin_temp_deviation;
      }
    }
  }
  // daily_spo2 → average overnight SpO2
  if (spo2Res.status === 'fulfilled') {
    for (const d of ((spo2Res.value as OuraList<OuraDailySpo2>).data || [])) {
      if (!d.day) continue;
      const avg = d.spo2_percentage?.average;
      if (typeof avg === 'number') ensure(d.day).blood_oxygen_avg_sleep = avg;
    }
  }

  return Array.from(byDate.values()).sort((a, b) => a.date.localeCompare(b.date));
}
