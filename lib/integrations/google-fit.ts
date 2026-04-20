// Google Fit REST API integration — the catch-all for Android-connected
// wearables that don't have a direct OAuth (Wear OS, some Chinese brands,
// MiBand via third-party syncs). Users enable Fit → their device writes into
// Fit → we read from Fit. Well-trodden path.
//
// Docs: https://developers.google.com/fit/rest/v1/reference
// Google OAuth setup: console.cloud.google.com → new project → enable
// Fitness API → OAuth consent + credentials. Add
//   https://<your-domain>/api/integrations/google_fit/callback
// to the authorized redirect URIs.
//
// Note: Google Fit is being deprecated in favor of Android Health Connect,
// but the REST API keeps working for the foreseeable future. When Google
// flips it off we'll need to migrate to the Health Connect equivalent
// (currently Android-only, no web API yet).

import { buildRedirectUrl, type TokenResult } from './base';

const AUTH_URL  = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';

// Scopes: read-only, one per data-type family we map.
export const GOOGLE_FIT_SCOPES = [
  'https://www.googleapis.com/auth/fitness.activity.read',
  'https://www.googleapis.com/auth/fitness.heart_rate.read',
  'https://www.googleapis.com/auth/fitness.sleep.read',
  'https://www.googleapis.com/auth/fitness.body.read',
  'https://www.googleapis.com/auth/fitness.oxygen_saturation.read',
] as const;

export function isConfigured(): boolean {
  return !!process.env.GOOGLE_FIT_CLIENT_ID && !!process.env.GOOGLE_FIT_CLIENT_SECRET;
}

export function buildAuthorizeUrl(state: string): string {
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: process.env.GOOGLE_FIT_CLIENT_ID || '',
    redirect_uri: buildRedirectUrl('google_fit'),
    scope: GOOGLE_FIT_SCOPES.join(' '),
    state,
    access_type: 'offline',        // gives us a refresh_token
    prompt: 'consent',             // force re-consent so we always get a refresh_token
    include_granted_scopes: 'true',
  });
  return `${AUTH_URL}?${params.toString()}`;
}

async function postToken(body: Record<string, string>): Promise<TokenResult> {
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(body).toString(),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Google token call failed (${res.status}): ${text.slice(0, 200)}`);
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
  return postToken({
    grant_type: 'authorization_code',
    code,
    redirect_uri: buildRedirectUrl('google_fit'),
    client_id: process.env.GOOGLE_FIT_CLIENT_ID || '',
    client_secret: process.env.GOOGLE_FIT_CLIENT_SECRET || '',
  });
}

export async function refreshAccessToken(refreshToken: string): Promise<TokenResult> {
  return postToken({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
    client_id: process.env.GOOGLE_FIT_CLIENT_ID || '',
    client_secret: process.env.GOOGLE_FIT_CLIENT_SECRET || '',
  });
}

// Aggregate API — pulls one datatype across a date range in 1-day buckets.
interface AggregateReq {
  aggregateBy: Array<{ dataTypeName: string }>;
  bucketByTime: { durationMillis: number };
  startTimeMillis: number;
  endTimeMillis: number;
}
interface AggregateResp {
  bucket?: Array<{
    startTimeMillis: string;
    endTimeMillis: string;
    dataset?: Array<{
      dataSourceId: string;
      point?: Array<{
        startTimeNanos?: string;
        endTimeNanos?: string;
        value?: Array<{ intVal?: number; fpVal?: number }>;
      }>;
    }>;
  }>;
}

async function aggregate(token: string, body: AggregateReq): Promise<AggregateResp | null> {
  const res = await fetch('https://www.googleapis.com/fitness/v1/users/me/dataset:aggregate', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (res.status === 404) return null;
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Google Fit aggregate (${res.status}): ${text.slice(0, 200)}`);
  }
  return res.json();
}

export interface GoogleFitDailySnapshot {
  date: string;
  steps?: number;
  active_time_min?: number;
  activity_calories?: number;
  resting_hr?: number;
  avg_heart_rate?: number;
  weight_kg?: number;
  blood_oxygen_avg_sleep?: number;
  sleep_hours?: number;
}

function dateBucketKey(startMs: string): string {
  return new Date(parseInt(startMs, 10)).toISOString().slice(0, 10);
}

// Reducers — collapse a bucket's point array into one number per day.
function sumInts(agg: AggregateResp | null): Map<string, number> {
  const out = new Map<string, number>();
  if (!agg?.bucket) return out;
  for (const b of agg.bucket) {
    const day = dateBucketKey(b.startTimeMillis);
    let total = 0;
    for (const ds of b.dataset || []) {
      for (const p of ds.point || []) {
        for (const v of p.value || []) {
          total += v.intVal ?? 0;
        }
      }
    }
    if (total > 0) out.set(day, (out.get(day) || 0) + total);
  }
  return out;
}
function sumFloats(agg: AggregateResp | null): Map<string, number> {
  const out = new Map<string, number>();
  if (!agg?.bucket) return out;
  for (const b of agg.bucket) {
    const day = dateBucketKey(b.startTimeMillis);
    let total = 0;
    for (const ds of b.dataset || []) {
      for (const p of ds.point || []) {
        for (const v of p.value || []) total += v.fpVal ?? 0;
      }
    }
    if (total > 0) out.set(day, (out.get(day) || 0) + total);
  }
  return out;
}
function avgFloats(agg: AggregateResp | null): Map<string, number> {
  const out = new Map<string, number>();
  if (!agg?.bucket) return out;
  for (const b of agg.bucket) {
    const day = dateBucketKey(b.startTimeMillis);
    let sum = 0, count = 0;
    for (const ds of b.dataset || []) {
      for (const p of ds.point || []) {
        for (const v of p.value || []) {
          if (typeof v.fpVal === 'number') { sum += v.fpVal; count++; }
        }
      }
    }
    if (count > 0) out.set(day, sum / count);
  }
  return out;
}

export async function fetchDailySnapshots(
  token: string,
  startDate: string,
  endDate: string,
): Promise<GoogleFitDailySnapshot[]> {
  const start = new Date(startDate).getTime();
  const end = new Date(endDate).getTime() + 86_400_000;
  const DAY_MS = 86_400_000;
  const makeReq = (dataTypeName: string): AggregateReq => ({
    aggregateBy: [{ dataTypeName }],
    bucketByTime: { durationMillis: DAY_MS },
    startTimeMillis: start,
    endTimeMillis: end,
  });

  const [steps, activeMs, cals, hr, weight, spo2] = await Promise.allSettled([
    aggregate(token, makeReq('com.google.step_count.delta')),
    aggregate(token, makeReq('com.google.active_minutes')),
    aggregate(token, makeReq('com.google.calories.expended')),
    aggregate(token, makeReq('com.google.heart_rate.bpm')),
    aggregate(token, makeReq('com.google.weight')),
    aggregate(token, makeReq('com.google.oxygen_saturation')),
  ]);

  const stepsByDay = steps.status === 'fulfilled' ? sumInts(steps.value) : new Map();
  const activeByDay = activeMs.status === 'fulfilled' ? sumInts(activeMs.value) : new Map();
  const calsByDay = cals.status === 'fulfilled' ? sumFloats(cals.value) : new Map();
  const hrByDay = hr.status === 'fulfilled' ? avgFloats(hr.value) : new Map();
  const weightByDay = weight.status === 'fulfilled' ? avgFloats(weight.value) : new Map();
  const spo2ByDay = spo2.status === 'fulfilled' ? avgFloats(spo2.value) : new Map();

  const allDays = new Set([
    ...stepsByDay.keys(), ...activeByDay.keys(), ...calsByDay.keys(),
    ...hrByDay.keys(), ...weightByDay.keys(), ...spo2ByDay.keys(),
  ]);
  const out: GoogleFitDailySnapshot[] = [];
  for (const day of allDays) {
    const s: GoogleFitDailySnapshot = { date: day };
    if (stepsByDay.has(day))  s.steps = stepsByDay.get(day);
    if (activeByDay.has(day)) s.active_time_min = activeByDay.get(day);
    if (calsByDay.has(day))   s.activity_calories = Math.round(calsByDay.get(day)!);
    if (hrByDay.has(day))     s.avg_heart_rate = Math.round(hrByDay.get(day)!);
    if (weightByDay.has(day)) s.weight_kg = Math.round(weightByDay.get(day)! * 10) / 10;
    if (spo2ByDay.has(day))   s.blood_oxygen_avg_sleep = Math.round(spo2ByDay.get(day)! * 10) / 10;
    out.push(s);
  }
  return out.sort((a, b) => a.date.localeCompare(b.date));
}
