// BYOK helper — returns the Anthropic API key to use for a given user.
//
// Order of precedence:
//   1. The user's stored profile.anthropic_api_key (when present + valid shape).
//   2. process.env.ANTHROPIC_API_KEY (platform fallback).
//   3. null (caller should fall back to Groq or refuse the request).
//
// We never log the key — pass the boolean `usedUserKey` to telemetry so cost
// dashboards can distinguish "Andrei paid" vs "user paid". The route is the
// single point that pulls the key, so misuse can't leak from N callsites.

import type { SupabaseClient } from '@supabase/supabase-js';

export interface ResolvedAnthropicKey {
  key: string | null;
  source: 'user' | 'platform' | 'none';
}

// Very loose sanity check — Anthropic keys start with sk-ant- but the format
// has changed in the past, so we only check length + the "sk-" prefix. The
// real validity is determined by the Anthropic API on first call.
function looksLikeAnthropicKey(s: string | null | undefined): s is string {
  if (!s) return false;
  return s.startsWith('sk-') && s.length >= 20 && s.length <= 256;
}

/**
 * Resolve the Anthropic key for a given user. Pass the admin client when
 * calling from cron / service-role contexts. Returns the source so the
 * caller can emit accurate cost telemetry.
 *
 * Falls through silently if the DB column doesn't exist yet (pre-migration).
 */
export async function getAnthropicKey(supabase: SupabaseClient, userId: string): Promise<ResolvedAnthropicKey> {
  let userKey: string | null = null;
  try {
    const { data } = await supabase
      .from('profiles')
      .select('anthropic_api_key')
      .eq('id', userId)
      .maybeSingle();
    const candidate = (data as { anthropic_api_key?: string | null } | null)?.anthropic_api_key;
    if (looksLikeAnthropicKey(candidate)) userKey = candidate;
  } catch {
    // Column doesn't exist yet — pre-0004 migration. Fall through to env.
  }

  if (userKey) return { key: userKey, source: 'user' };
  const env = process.env.ANTHROPIC_API_KEY;
  if (looksLikeAnthropicKey(env)) return { key: env, source: 'platform' };
  return { key: null, source: 'none' };
}

// Re-export the shape check for the save-profile route — validates BYOK input
// before persisting so the DB never carries garbage.
export const isAnthropicKeyShape = looksLikeAnthropicKey;
