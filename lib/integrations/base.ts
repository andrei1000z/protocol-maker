// Shared helpers for every wearable OAuth integration. Keeps the
// provider-specific modules small — each one only has to implement the
// URL-, scope-, and data-mapping specifics.
//
// Three providers use this today: Oura (separate module — predates the base),
// Fitbit, Withings. Same shape would drop in for WHOOP / Polar / Google Fit.

import type { SupabaseClient } from '@supabase/supabase-js';
import { randomBytes } from 'node:crypto';
import { NextResponse } from 'next/server';
import { SITE_URL } from '@/lib/config';

export type ProviderKey = 'oura' | 'fitbit' | 'withings' | 'whoop' | 'google_fit' | 'polar';

// Stash a CSRF state cookie before redirecting to a provider's authorize URL.
// Same pattern as Oura — named per-provider so two OAuth flows open in the
// same window don't stomp each other's state.
export function stateCookieName(provider: ProviderKey): string {
  return `${provider}_oauth_state`;
}

export function generateState(): string {
  return randomBytes(32).toString('hex');
}

// Build the redirect URI registered with each provider. Providers want an
// exact match — env override for edge cases (staging domains, custom paths).
export function buildRedirectUrl(provider: ProviderKey): string {
  const override = process.env[`${provider.toUpperCase()}_REDIRECT_URL`];
  return override || `${SITE_URL}/api/integrations/${provider}/callback`;
}

// Extract the state cookie from a Request header. Returns null if missing.
export function readStateCookie(request: Request, provider: ProviderKey): string | null {
  const name = stateCookieName(provider);
  const re = new RegExp(`${name}=([^;]+)`);
  return request.headers.get('cookie')?.match(re)?.[1] ?? null;
}

export function setStateCookie(res: NextResponse, provider: ProviderKey, state: string): NextResponse {
  res.cookies.set(stateCookieName(provider), state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 600,
  });
  return res;
}

export function clearStateCookie(res: NextResponse, provider: ProviderKey): NextResponse {
  res.cookies.set(stateCookieName(provider), '', { path: '/', maxAge: 0 });
  return res;
}

// Redirect helpers — Settings page reads ?integration=X&connected=1|&error=Y
export function redirectOk(provider: ProviderKey): NextResponse {
  return NextResponse.redirect(`${SITE_URL}/settings?integration=${provider}&connected=1`);
}
export function redirectErr(provider: ProviderKey, reason: string): NextResponse {
  return NextResponse.redirect(`${SITE_URL}/settings?integration=${provider}&error=${encodeURIComponent(reason)}`);
}

// Common shape for all provider token responses. Each provider module
// adapts their raw JSON into this before calling upsertConnection.
export interface TokenResult {
  accessToken: string;
  refreshToken?: string | null;
  tokenType?: string;
  expiresIn?: number;           // seconds
  scope?: string;
  providerUserId?: string;      // whichever field the provider uses
}

// Upsert tokens into oauth_connections. Always service-role (admin client)
// because the table's RLS is SELECT-only for owners by design.
export async function upsertConnection(
  admin: SupabaseClient,
  userId: string,
  provider: ProviderKey,
  tokens: TokenResult,
): Promise<void> {
  const expiresAt = tokens.expiresIn
    ? new Date(Date.now() + tokens.expiresIn * 1000).toISOString()
    : null;

  const { error } = await admin.from('oauth_connections').upsert({
    user_id: userId,
    provider,
    access_token: tokens.accessToken,
    refresh_token: tokens.refreshToken ?? null,
    token_type: tokens.tokenType || 'Bearer',
    expires_at: expiresAt,
    scopes: tokens.scope || null,
    provider_user_id: tokens.providerUserId || null,
    updated_at: new Date().toISOString(),
    last_sync_error: null,
  }, { onConflict: 'user_id,provider' });

  if (error) throw new Error(`oauth_connections upsert (${provider}): ${error.message}`);
}

// Generic "load connection + refresh if expiring soon" helper used by every
// provider's sync endpoint. Takes a refresher function specific to the
// provider's token endpoint.
export interface LoadedConnection {
  accessToken: string;
  refreshToken: string | null;
  refreshed: boolean;
}

export async function loadAndRefresh(
  admin: SupabaseClient,
  userId: string,
  provider: ProviderKey,
  refresher: (refreshToken: string) => Promise<TokenResult>,
): Promise<LoadedConnection | null> {
  const { data: row, error } = await admin
    .from('oauth_connections')
    .select('access_token, refresh_token, expires_at')
    .eq('user_id', userId)
    .eq('provider', provider)
    .maybeSingle();
  if (error) throw new Error(`oauth_connections read (${provider}): ${error.message}`);
  if (!row) return null;

  const expiresAt = row.expires_at ? new Date(row.expires_at).getTime() : 0;
  const needsRefresh = expiresAt && expiresAt - Date.now() < 60_000;
  if (!needsRefresh || !row.refresh_token) {
    return { accessToken: row.access_token, refreshToken: row.refresh_token, refreshed: false };
  }

  try {
    const t = await refresher(row.refresh_token);
    const newExpires = t.expiresIn ? new Date(Date.now() + t.expiresIn * 1000).toISOString() : null;
    await admin.from('oauth_connections')
      .update({
        access_token: t.accessToken,
        refresh_token: t.refreshToken ?? row.refresh_token,
        expires_at: newExpires,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId).eq('provider', provider);
    return { accessToken: t.accessToken, refreshToken: t.refreshToken ?? row.refresh_token, refreshed: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await admin.from('oauth_connections')
      .update({ last_sync_error: `refresh failed: ${msg.slice(0, 300)}`, updated_at: new Date().toISOString() })
      .eq('user_id', userId).eq('provider', provider);
    throw err;
  }
}

// Mark a successful sync (clear any stale error). Called by each provider's
// sync helper at the end of a clean run.
export async function markSynced(
  admin: SupabaseClient,
  userId: string,
  provider: ProviderKey,
): Promise<void> {
  await admin.from('oauth_connections')
    .update({
      last_synced_at: new Date().toISOString(),
      last_sync_error: null,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId).eq('provider', provider);
}

// Mark a failed sync (for the Settings UI banner).
export async function markSyncError(
  admin: SupabaseClient,
  userId: string,
  provider: ProviderKey,
  error: string,
): Promise<void> {
  await admin.from('oauth_connections')
    .update({ last_sync_error: error.slice(0, 500), updated_at: new Date().toISOString() })
    .eq('user_id', userId).eq('provider', provider);
}
