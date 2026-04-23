'use client';

import { createBrowserClient } from '@supabase/ssr';

let client: ReturnType<typeof createBrowserClient> | null = null;

export function createClient() {
  if (client) return client;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error('Supabase env vars missing');
  }

  client = createBrowserClient(url, key, {
    auth: {
      // Pass these explicitly so a future Supabase version flipping the
      // defaults doesn't silently sign users out when they reload.
      persistSession: true,
      autoRefreshToken: true,
      // Needed for magic-link email callbacks that pass the token back
      // in the URL hash fragment.
      detectSessionInUrl: true,
      // PKCE keeps the refresh token server-only — recommended flow for
      // SSR apps and lower XSS risk than implicit.
      flowType: 'pkce',
    },
  });
  return client;
}
