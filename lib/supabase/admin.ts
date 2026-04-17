import { createClient } from '@supabase/supabase-js';

/**
 * Service-role Supabase client — bypasses RLS.
 * Use ONLY from trusted server-side contexts (cron jobs, admin routes).
 * Never expose to the browser or pass to client components.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error('Supabase admin env vars missing (NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY)');
  }

  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
