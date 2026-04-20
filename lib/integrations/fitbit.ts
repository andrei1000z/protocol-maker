// Fitbit Web API integration — covers Fitbit watches (Sense, Versa, Charge,
// Inspire, Luxe), Fitbit Aria (smart scale), and any Google Pixel Watch
// running Fitbit OS. Same OAuth 2.0 flow pattern as Oura with PKCE optional.
//
// Scopes chosen to cover every daily_metrics field Fitbit exposes:
//   activity   → steps, active minutes, calories
//   heartrate  → resting HR, min/max/avg, HRV (via activities/heart/intraday or sleep)
//   sleep      → sleep duration + stages
//   weight     → Aria scale readings
//   oxygen_saturation → SpO₂ (overnight)
//   temperature → skin temp deviation (Sense 2, Charge 5+)
//
// Register at https://dev.fitbit.com/apps/new — "Server" type app, then put
// https://<your-domain>/api/integrations/fitbit/callback as the callback.

import { buildRedirectUrl, type TokenResult } from './base';

const AUTH_URL   = 'https://www.fitbit.com/oauth2/authorize';
const TOKEN_URL  = 'https://api.fitbit.com/oauth2/token';
const API_BASE   = 'https://api.fitbit.com/1/user/-';
const API_BASE_V1_2 = 'https://api.fitbit.com/1.2/user/-';

export const FITBIT_SCOPES = [
  'activity', 'heartrate', 'sleep', 'weight',
  'oxygen_saturation', 'temperature',
] as const;

export function isConfigured(): boolean {
  return !!process.env.FITBIT_CLIENT_ID && !!process.env.FITBIT_CLIENT_SECRET;
}

export function buildAuthorizeUrl(state: string): string {
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: process.env.FITBIT_CLIENT_ID || '',
    redirect_uri: buildRedirectUrl('fitbit'),
    scope: FITBIT_SCOPES.join(' '),
    state,
    expires_in: '604800',  // 7-day access tokens (max)
  });
  return `${AUTH_URL}?${params.toString()}`;
}

// Fitbit uses HTTP Basic auth on the token endpoint (client_id:client_secret
// b64-encoded), not client_id in the body. Easy to get wrong — keep it here.
function basicAuthHeader(): string {
  const id = process.env.FITBIT_CLIENT_ID || '';
  const secret = process.env.FITBIT_CLIENT_SECRET || '';
  return 'Basic ' + Buffer.from(`${id}:${secret}`).toString('base64');
}

async function postToken(body: Record<string, string>): Promise<TokenResult> {
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: {
      Authorization: basicAuthHeader(),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams(body).toString(),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Fitbit token call failed (${res.status}): ${text.slice(0, 200)}`);
  }
  const j = await res.json() as {
    access_token: string; refresh_token?: string; token_type: string;
    expires_in: number; scope?: string; user_id?: string;
  };
  return {
    accessToken: j.access_token,
    refreshToken: j.refresh_token,
    tokenType: j.token_type,
    expiresIn: j.expires_in,
    scope: j.scope,
    providerUserId: j.user_id,
  };
}

export async function exchangeCodeForTokens(code: string): Promise<TokenResult> {
  return postToken({
    grant_type: 'authorization_code',
    code,
    redirect_uri: buildRedirectUrl('fitbit'),
  });
}

export async function refreshAccessToken(refreshToken: string): Promise<TokenResult> {
  return postToken({ grant_type: 'refresh_token', refresh_token: refreshToken });
}

async function fitbitGet<T>(path: string, token: string, base = API_BASE): Promise<T | null> {
  const res = await fetch(`${base}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (res.status === 404) return null;  // no data for that day — common
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Fitbit ${path} (${res.status}): ${text.slice(0, 200)}`);
  }
  return res.json();
}

export interface FitbitDailySnapshot {
  date: string;
  sleep_hours?: number;
  sleep_score?: number;
  deep_sleep_min?: number;
  light_sleep_min?: number;
  rem_sleep_min?: number;
  awake_min?: number;
  resting_hr?: number;
  steps?: number;
  active_time_min?: number;
  activity_calories?: number;
  weight_kg?: number;
  blood_oxygen_avg_sleep?: number;
  skin_temp_deviation?: number;
  skin_temp_deviation_min?: number;
  skin_temp_deviation_max?: number;
}

// Response shape fragments. Fitbit endpoints are individually documented;
// we only keep the fields we actually map.
interface SleepLogV1_2 {
  sleep?: Array<{
    dateOfSleep: string;
    isMainSleep: boolean;
    duration: number;              // ms
    efficiency?: number;           // 0-100
    levels?: { summary?: { deep?: { minutes: number }; light?: { minutes: number }; rem?: { minutes: number }; wake?: { minutes: number } } };
  }>;
}
interface ActivitySummary {
  summary?: {
    steps?: number;
    veryActiveMinutes?: number;
    fairlyActiveMinutes?: number;
    lightlyActiveMinutes?: number;
    activityCalories?: number;
    restingHeartRate?: number;
  };
}
interface WeightLog {
  weight?: Array<{ date: string; weight: number; bmi?: number; fat?: number }>;
}
interface Spo2Daily {
  value?: { avg?: number; min?: number; max?: number };
  dateTime?: string;
}
interface TempSkin {
  tempSkin?: Array<{ dateTime: string; value: { nightlyRelative: number } }>;
}

function isoDate(d: Date): string { return d.toISOString().slice(0, 10); }

// Fetch one day's snapshot across 5 Fitbit endpoints. Each call is parallel;
// any individual endpoint failing (most commonly: no data for that day) is
// logged but the rest of the snapshot still builds.
export async function fetchDailySnapshot(token: string, date: string): Promise<FitbitDailySnapshot> {
  const s: FitbitDailySnapshot = { date };

  const [sleep, activity, weight, spo2, temp] = await Promise.allSettled([
    fitbitGet<SleepLogV1_2>(`/sleep/date/${date}.json`, token, API_BASE_V1_2),
    fitbitGet<ActivitySummary>(`/activities/date/${date}.json`, token),
    fitbitGet<WeightLog>(`/body/log/weight/date/${date}.json`, token),
    fitbitGet<Spo2Daily>(`/spo2/date/${date}.json`, token),
    fitbitGet<TempSkin>(`/temp/skin/date/${date}.json`, token),
  ]);

  // Sleep — pick the main sleep record (there can be naps too)
  if (sleep.status === 'fulfilled' && sleep.value?.sleep?.length) {
    const main = sleep.value.sleep.find(x => x.isMainSleep) || sleep.value.sleep[0];
    if (main) {
      if (main.duration) s.sleep_hours = Math.round(main.duration / 1000 / 36) / 100;
      if (typeof main.efficiency === 'number') s.sleep_score = main.efficiency;
      const lv = main.levels?.summary;
      if (lv?.deep?.minutes !== undefined) s.deep_sleep_min = lv.deep.minutes;
      if (lv?.light?.minutes !== undefined) s.light_sleep_min = lv.light.minutes;
      if (lv?.rem?.minutes !== undefined) s.rem_sleep_min = lv.rem.minutes;
      if (lv?.wake?.minutes !== undefined) s.awake_min = lv.wake.minutes;
    }
  }

  // Activity summary
  if (activity.status === 'fulfilled' && activity.value?.summary) {
    const a = activity.value.summary;
    if (typeof a.steps === 'number') s.steps = a.steps;
    if (typeof a.activityCalories === 'number') s.activity_calories = a.activityCalories;
    const active = (a.veryActiveMinutes || 0) + (a.fairlyActiveMinutes || 0) + (a.lightlyActiveMinutes || 0);
    if (active > 0) s.active_time_min = active;
    if (typeof a.restingHeartRate === 'number') s.resting_hr = a.restingHeartRate;
  }

  // Weight log (Aria scale) — pick the most recent reading that day
  if (weight.status === 'fulfilled' && weight.value?.weight?.length) {
    const latest = weight.value.weight[weight.value.weight.length - 1];
    if (typeof latest.weight === 'number') s.weight_kg = Math.round(latest.weight * 10) / 10;
  }

  // SpO2 (overnight average)
  if (spo2.status === 'fulfilled' && spo2.value?.value) {
    const v = spo2.value.value;
    if (typeof v.avg === 'number') s.blood_oxygen_avg_sleep = v.avg;
  }

  // Skin temperature deviation
  if (temp.status === 'fulfilled' && temp.value?.tempSkin?.length) {
    const samples = temp.value.tempSkin.map(t => t.value?.nightlyRelative).filter((n): n is number => typeof n === 'number');
    if (samples.length > 0) {
      s.skin_temp_deviation_min = Math.min(...samples);
      s.skin_temp_deviation_max = Math.max(...samples);
      s.skin_temp_deviation = samples.reduce((a, b) => a + b, 0) / samples.length;
      s.skin_temp_deviation = Math.round(s.skin_temp_deviation * 100) / 100;
    }
  }

  return s;
}

export async function fetchDailySnapshots(
  token: string,
  startDate: string,
  endDate: string,
): Promise<FitbitDailySnapshot[]> {
  const out: FitbitDailySnapshot[] = [];
  const start = new Date(startDate);
  const end = new Date(endDate);
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    try {
      const snap = await fetchDailySnapshot(token, isoDate(d));
      out.push(snap);
    } catch {
      // Individual day failures are common (rate limits, missing data) —
      // skip rather than abandon the whole sync.
    }
  }
  return out;
}
