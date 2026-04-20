// Withings Web API integration — powers the only publicly-documented path
// to pull SMART SCALE body composition onto the web. Covers:
//   • Body+ / Body Comp / Body Scan scales → weight, body_fat_pct,
//     muscle_mass_kg, body_water_pct, bone_mass_kg, visceral_fat, bmr_kcal
//   • ScanWatch / Pulse / BPM Core → sleep stages, HRV, BP, SpO₂
//
// Docs: https://developer.withings.com/api-reference
// Register an app at https://account.withings.com/partner/dashboard_oauth2
// Callback URL to register: https://<your-domain>/api/integrations/withings/callback

import { buildRedirectUrl, type TokenResult } from './base';

const AUTH_URL  = 'https://account.withings.com/oauth2_user/authorize2';
const TOKEN_URL = 'https://wbsapi.withings.net/v2/oauth2';
const API_BASE  = 'https://wbsapi.withings.net';

// Scopes cover measurements (scale readings), activity (step counts), and
// sleep (if the user owns a ScanWatch). The user picks which to grant.
export const WITHINGS_SCOPES = ['user.info', 'user.metrics', 'user.activity', 'user.sleepevents'] as const;

export function isConfigured(): boolean {
  return !!process.env.WITHINGS_CLIENT_ID && !!process.env.WITHINGS_CLIENT_SECRET;
}

export function buildAuthorizeUrl(state: string): string {
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: process.env.WITHINGS_CLIENT_ID || '',
    redirect_uri: buildRedirectUrl('withings'),
    scope: WITHINGS_SCOPES.join(','),   // Withings expects comma-separated, not space
    state,
  });
  return `${AUTH_URL}?${params.toString()}`;
}

// Withings wraps every API response in { status, body } where status === 0
// means success; non-zero is a provider-specific error code.
interface WithingsEnvelope<T> { status: number; body?: T; error?: string; }

async function withingsPost<T>(body: Record<string, string>): Promise<T> {
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(body).toString(),
  });
  const j = await res.json() as WithingsEnvelope<T>;
  if (j.status !== 0) {
    throw new Error(`Withings token call failed (status ${j.status}): ${j.error || '(no error)'}`);
  }
  if (!j.body) throw new Error(`Withings token response had no body`);
  return j.body;
}

// Unlike most OAuth 2.0 servers, Withings requires `action=requesttoken` on
// BOTH the initial exchange and the refresh. Everything goes through the
// same /v2/oauth2 endpoint.
export async function exchangeCodeForTokens(code: string): Promise<TokenResult> {
  const body = await withingsPost<{ access_token: string; refresh_token?: string; expires_in: number; token_type?: string; scope?: string; userid?: number }>({
    action: 'requesttoken',
    grant_type: 'authorization_code',
    client_id: process.env.WITHINGS_CLIENT_ID || '',
    client_secret: process.env.WITHINGS_CLIENT_SECRET || '',
    code,
    redirect_uri: buildRedirectUrl('withings'),
  });
  return {
    accessToken: body.access_token,
    refreshToken: body.refresh_token,
    tokenType: body.token_type || 'Bearer',
    expiresIn: body.expires_in,
    scope: body.scope,
    providerUserId: body.userid != null ? String(body.userid) : undefined,
  };
}

export async function refreshAccessToken(refreshToken: string): Promise<TokenResult> {
  const body = await withingsPost<{ access_token: string; refresh_token?: string; expires_in: number; token_type?: string; scope?: string; userid?: number }>({
    action: 'requesttoken',
    grant_type: 'refresh_token',
    client_id: process.env.WITHINGS_CLIENT_ID || '',
    client_secret: process.env.WITHINGS_CLIENT_SECRET || '',
    refresh_token: refreshToken,
  });
  return {
    accessToken: body.access_token,
    refreshToken: body.refresh_token,
    tokenType: body.token_type || 'Bearer',
    expiresIn: body.expires_in,
    scope: body.scope,
    providerUserId: body.userid != null ? String(body.userid) : undefined,
  };
}

// Measure types we care about — Withings' numeric enum.
// Full list: https://developer.withings.com/api-reference/#tag/measure
const MEASURE = {
  WEIGHT_KG:     1,  // kg
  BODY_FAT_PCT:  6,  // %
  MUSCLE_MASS:  76,  // kg
  BODY_WATER:   77,  // % (hydration)
  BONE_MASS:    88,  // kg
  VISC_FAT:    170,  // (unitless, Tanita-style)
  BMR_KCAL:     82,  // kcal/day
} as const;

async function apiPost<T>(path: string, token: string, body: Record<string, string>): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams(body).toString(),
  });
  const j = await res.json() as WithingsEnvelope<T>;
  if (j.status !== 0) throw new Error(`Withings ${path} failed (status ${j.status}): ${j.error || ''}`);
  if (!j.body) throw new Error(`Withings ${path}: empty body`);
  return j.body;
}

interface MeasureGroupResp {
  measuregrps: Array<{
    date: number;  // unix seconds
    measures: Array<{ value: number; type: number; unit: number }>;
  }>;
}

export interface WithingsDailySnapshot {
  date: string;
  weight_kg?: number;
  body_fat_pct?: number;
  muscle_mass_kg?: number;
  body_water_pct?: number;
  bone_mass_kg?: number;
  visceral_fat?: number;
  bmr_kcal?: number;
}

// Withings returns value * 10^unit (integers), so we convert to real numbers.
function valueOf(raw: { value: number; unit: number }): number {
  return raw.value * Math.pow(10, raw.unit);
}

function isoDate(d: number | Date): string {
  const date = typeof d === 'number' ? new Date(d * 1000) : d;
  return date.toISOString().slice(0, 10);
}

export async function fetchDailySnapshots(
  token: string,
  startDate: string,
  endDate: string,
): Promise<WithingsDailySnapshot[]> {
  const start = Math.floor(new Date(startDate).getTime() / 1000);
  const end = Math.floor((new Date(endDate).getTime() + 86_400_000) / 1000);  // inclusive end-of-day
  const meastypes = Object.values(MEASURE).join(',');

  let data: MeasureGroupResp;
  try {
    data = await apiPost<MeasureGroupResp>('/measure', token, {
      action: 'getmeas',
      meastypes,
      category: '1',  // real measurements, not user-entered objectives
      startdate: String(start),
      enddate: String(end),
    });
  } catch {
    return [];
  }

  // Group measurements by day. Multiple scale weigh-ins per day happen — we
  // keep the LAST (most recent) value per field that day, matching how the
  // rest of the app treats "today's weight" as the most recent reading.
  const byDate = new Map<string, WithingsDailySnapshot>();
  for (const grp of data.measuregrps.sort((a, b) => a.date - b.date)) {
    const date = isoDate(grp.date);
    const snap = byDate.get(date) || { date };
    for (const m of grp.measures) {
      const v = valueOf(m);
      switch (m.type) {
        case MEASURE.WEIGHT_KG:    snap.weight_kg       = Math.round(v * 10) / 10; break;
        case MEASURE.BODY_FAT_PCT: snap.body_fat_pct    = Math.round(v * 10) / 10; break;
        case MEASURE.MUSCLE_MASS:  snap.muscle_mass_kg  = Math.round(v * 10) / 10; break;
        case MEASURE.BODY_WATER:   snap.body_water_pct  = Math.round(v * 10) / 10; break;
        case MEASURE.BONE_MASS:    snap.bone_mass_kg    = Math.round(v * 10) / 10; break;
        case MEASURE.VISC_FAT:     snap.visceral_fat    = Math.round(v); break;
        case MEASURE.BMR_KCAL:     snap.bmr_kcal        = Math.round(v); break;
      }
    }
    byDate.set(date, snap);
  }

  return Array.from(byDate.values()).sort((a, b) => a.date.localeCompare(b.date));
}
