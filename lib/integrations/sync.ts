// Unified sync dispatcher — one entry point that picks the right provider
// module based on `provider`. Keeps the API routes + cron loop simple:
//   await syncProvider(admin, userId, 'fitbit', { lookbackDays: 14 })
//
// Each provider's `fetchDailySnapshots` returns a different shape (Oura has
// skin-temp range fields Fitbit doesn't, Withings only has body comp, etc.)
// but they all map into subsets of daily_metrics columns, so the upsert
// path is identical: apply_daily_metric_patch with the non-null keys.

import type { SupabaseClient } from '@supabase/supabase-js';
import { loadAndRefresh, markSynced, markSyncError, type ProviderKey } from './base';
import { logger, describeError } from '@/lib/logger';

import * as oura from './oura';
import * as fitbit from './fitbit';
import * as withings from './withings';
import * as whoop from './whoop';
import * as googleFit from './google-fit';

// Refreshers aren't all compatible with base.ts's TokenResult shape, so we
// adapt them here. Oura's shape predates the base module.
import { refreshAccessToken as ouraRefresh } from './oura';

export interface SyncResult {
  ok: boolean;
  provider: ProviderKey;
  daysFetched: number;
  rowsWritten: number;
  refreshedToken: boolean;
  error?: string;
}

// One row with provider-agnostic non-null keys → apply_daily_metric_patch.
async function upsertSnapshot(
  admin: SupabaseClient,
  userId: string,
  snap: { date: string } & Record<string, unknown>,
): Promise<boolean> {
  const patch: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(snap)) {
    if (k === 'date') continue;
    if (v === null || v === undefined) continue;
    patch[k] = v;
  }
  if (Object.keys(patch).length === 0) return false;

  const { error } = await admin.rpc('apply_daily_metric_patch', {
    p_user_id: userId,
    p_date: snap.date,
    p_patch: patch,
  });
  if (error && /does not exist|schema cache|PGRST202|42883/i.test(error.message || error.code || '')) {
    // Pre-migration fallback — racy but functional.
    const { data: existing } = await admin.from('daily_metrics').select('*')
      .eq('user_id', userId).eq('date', snap.date).maybeSingle();
    const merged = { ...(existing || {}), ...patch, user_id: userId, date: snap.date };
    const { error: legacyErr } = await admin.from('daily_metrics').upsert(merged, { onConflict: 'user_id,date' });
    if (legacyErr) throw new Error(`daily_metrics upsert: ${legacyErr.message}`);
    return true;
  }
  if (error) throw new Error(`apply_daily_metric_patch: ${error.message}`);
  return true;
}

export async function syncProvider(
  admin: SupabaseClient,
  userId: string,
  provider: ProviderKey,
  opts: { lookbackDays?: number } = {},
): Promise<SyncResult> {
  const lookback = Math.max(1, Math.min(60, opts.lookbackDays ?? 7));
  const today = new Date();
  const start = new Date(today); start.setDate(today.getDate() - lookback);
  const endDate = today.toISOString().slice(0, 10);
  const startDate = start.toISOString().slice(0, 10);

  // Per-provider token refresh: adapt each one's refresh-token function
  // into the base's TokenResult-returning shape.
  const refresher = (() => {
    if (provider === 'oura') return async (rt: string) => {
      const t = await ouraRefresh(rt);
      return {
        accessToken: t.access_token,
        refreshToken: t.refresh_token,
        tokenType: t.token_type,
        expiresIn: t.expires_in,
        scope: t.scope,
      };
    };
    if (provider === 'fitbit') return fitbit.refreshAccessToken;
    if (provider === 'withings') return withings.refreshAccessToken;
    if (provider === 'whoop') return whoop.refreshAccessToken;
    if (provider === 'google_fit') return googleFit.refreshAccessToken;
    throw new Error(`sync not implemented for provider ${provider}`);
  })();

  const conn = await loadAndRefresh(admin, userId, provider, refresher);
  if (!conn) {
    return { ok: false, provider, daysFetched: 0, rowsWritten: 0, refreshedToken: false, error: 'not_connected' };
  }

  // Each provider returns a typed snapshot shape; at this layer we only need
  // `{ date }` + arbitrary string-keyed fields, so widen via unknown.
  let snapshots: Array<{ date: string } & Record<string, unknown>> = [];
  try {
    if (provider === 'oura') snapshots = await oura.fetchDailySnapshots(conn.accessToken, startDate, endDate) as unknown as typeof snapshots;
    else if (provider === 'fitbit') snapshots = await fitbit.fetchDailySnapshots(conn.accessToken, startDate, endDate) as unknown as typeof snapshots;
    else if (provider === 'withings') snapshots = await withings.fetchDailySnapshots(conn.accessToken, startDate, endDate) as unknown as typeof snapshots;
    else if (provider === 'whoop') snapshots = await whoop.fetchDailySnapshots(conn.accessToken, startDate, endDate) as unknown as typeof snapshots;
    else if (provider === 'google_fit') snapshots = await googleFit.fetchDailySnapshots(conn.accessToken, startDate, endDate) as unknown as typeof snapshots;
  } catch (err) {
    const msg = describeError(err);
    await markSyncError(admin, userId, provider, msg);
    logger.warn(`${provider}.fetch_failed`, { userId, errorMessage: msg });
    return { ok: false, provider, daysFetched: 0, rowsWritten: 0, refreshedToken: conn.refreshed, error: msg };
  }

  let rowsWritten = 0;
  for (const snap of snapshots) {
    try {
      if (await upsertSnapshot(admin, userId, snap)) rowsWritten++;
    } catch (err) {
      logger.warn(`${provider}.upsert_failed`, { userId, date: snap.date, errorMessage: describeError(err) });
    }
  }

  await markSynced(admin, userId, provider);
  logger.info(`${provider}.sync_done`, { userId, daysFetched: snapshots.length, rowsWritten, refreshedToken: conn.refreshed });
  return { ok: true, provider, daysFetched: snapshots.length, rowsWritten, refreshedToken: conn.refreshed };
}
