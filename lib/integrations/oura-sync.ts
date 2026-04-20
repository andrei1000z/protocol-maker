// Server-side Oura → daily_metrics sync. Used by both the on-demand manual
// sync endpoint + the daily cron. Takes an admin Supabase client so it can
// write tokens (refresh) + rows (daily_metrics patches) bypassing RLS — this
// code path is already authenticated upstream.

import type { SupabaseClient } from '@supabase/supabase-js';
import { fetchDailySnapshots, refreshAccessToken, type OuraDailySnapshot } from './oura';
import { logger, describeError } from '@/lib/logger';

export interface OuraSyncResult {
  ok: boolean;
  daysFetched: number;
  rowsWritten: number;
  refreshedToken: boolean;
  error?: string;
}

// Load the user's Oura connection, refreshing the access token if it's
// within 60s of expiry. Returns null if the user isn't connected.
async function loadAndRefreshConnection(
  admin: SupabaseClient,
  userId: string,
): Promise<{ accessToken: string; refreshed: boolean } | null> {
  const { data: row, error } = await admin
    .from('oauth_connections')
    .select('access_token, refresh_token, expires_at')
    .eq('user_id', userId)
    .eq('provider', 'oura')
    .maybeSingle();
  if (error) throw new Error(`oauth_connections read: ${error.message}`);
  if (!row) return null;

  const expiresAt = row.expires_at ? new Date(row.expires_at).getTime() : 0;
  const needsRefresh = expiresAt && expiresAt - Date.now() < 60_000;
  if (!needsRefresh || !row.refresh_token) {
    return { accessToken: row.access_token, refreshed: false };
  }

  try {
    const t = await refreshAccessToken(row.refresh_token);
    const newExpires = t.expires_in ? new Date(Date.now() + t.expires_in * 1000).toISOString() : null;
    await admin.from('oauth_connections')
      .update({
        access_token: t.access_token,
        refresh_token: t.refresh_token ?? row.refresh_token,
        expires_at: newExpires,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId).eq('provider', 'oura');
    return { accessToken: t.access_token, refreshed: true };
  } catch (err) {
    // If refresh fails (e.g. revoked on Oura side), mark the row so the UI
    // can prompt reconnect instead of silently retrying forever.
    await admin.from('oauth_connections')
      .update({ last_sync_error: `refresh failed: ${describeError(err).slice(0, 300)}`, updated_at: new Date().toISOString() })
      .eq('user_id', userId).eq('provider', 'oura');
    throw err;
  }
}

// Upsert one snapshot into daily_metrics using the atomic patch RPC. Falls
// back to read-merge-write if the RPC hasn't been migrated yet — same graceful
// degradation pattern as chat-action.
async function upsertSnapshot(
  admin: SupabaseClient,
  userId: string,
  snap: OuraDailySnapshot,
): Promise<boolean> {
  const { date, ...patch } = snap;
  // Drop undefined values — COALESCE only wants the keys that have real data.
  const cleaned: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(patch)) {
    if (v !== null && v !== undefined) cleaned[k] = v;
  }
  if (Object.keys(cleaned).length === 0) return false;

  const { error } = await admin.rpc('apply_daily_metric_patch', {
    p_user_id: userId,
    p_date: date,
    p_patch: cleaned,
  });
  if (error && /does not exist|schema cache|PGRST202|42883/i.test(error.message || error.code || '')) {
    // Pre-migration fallback — same semantic, racy but workable.
    const { data: existing } = await admin.from('daily_metrics').select('*')
      .eq('user_id', userId).eq('date', date).maybeSingle();
    const merged = { ...(existing || {}), ...cleaned, user_id: userId, date };
    const { error: legacyErr } = await admin.from('daily_metrics').upsert(merged, { onConflict: 'user_id,date' });
    if (legacyErr) throw new Error(`daily_metrics upsert: ${legacyErr.message}`);
    return true;
  }
  if (error) throw new Error(`apply_daily_metric_patch: ${error.message}`);
  return true;
}

// Pull Oura data for `lookbackDays` up to today, patch into daily_metrics.
export async function syncOuraForUser(
  admin: SupabaseClient,
  userId: string,
  opts: { lookbackDays?: number } = {},
): Promise<OuraSyncResult> {
  const lookback = Math.max(1, Math.min(60, opts.lookbackDays ?? 7));

  const conn = await loadAndRefreshConnection(admin, userId);
  if (!conn) return { ok: false, daysFetched: 0, rowsWritten: 0, refreshedToken: false, error: 'not_connected' };

  const today = new Date();
  const start = new Date(today); start.setDate(today.getDate() - lookback);
  const endDate = today.toISOString().slice(0, 10);
  const startDate = start.toISOString().slice(0, 10);

  let snapshots: OuraDailySnapshot[] = [];
  try {
    snapshots = await fetchDailySnapshots(conn.accessToken, startDate, endDate);
  } catch (err) {
    const msg = describeError(err);
    await admin.from('oauth_connections')
      .update({ last_sync_error: msg.slice(0, 500), updated_at: new Date().toISOString() })
      .eq('user_id', userId).eq('provider', 'oura');
    logger.warn('oura.fetch_failed', { userId, errorMessage: msg });
    return { ok: false, daysFetched: 0, rowsWritten: 0, refreshedToken: conn.refreshed, error: msg };
  }

  let rowsWritten = 0;
  for (const snap of snapshots) {
    try {
      if (await upsertSnapshot(admin, userId, snap)) rowsWritten++;
    } catch (err) {
      logger.warn('oura.upsert_failed', { userId, date: snap.date, errorMessage: describeError(err) });
    }
  }

  await admin.from('oauth_connections')
    .update({
      last_synced_at: new Date().toISOString(),
      last_sync_error: null,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId).eq('provider', 'oura');

  logger.info('oura.sync_done', { userId, daysFetched: snapshots.length, rowsWritten, refreshedToken: conn.refreshed });
  return { ok: true, daysFetched: snapshots.length, rowsWritten, refreshedToken: conn.refreshed };
}
