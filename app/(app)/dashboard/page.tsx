// Server-component shell for /dashboard.
//
// Role: pre-fetch profile + latest protocol + blood tests on the server,
// hand them down to <DashboardClient /> as initialMyData so the first
// render hydrates from cache instead of paying for a browser-side
// /api/my-data round-trip (~150-300 ms on cold DNS).
//
// Failure mode: any error in the server fetch falls through to passing
// `null` — DashboardClient then renders exactly as before, with SWR
// fetching on mount. Server failure must never hide the page.

import { createClient } from '@/lib/supabase/server';
import DashboardClient from './DashboardClient';

export const dynamic = 'force-dynamic';

async function fetchInitialData() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    // Mirrors GET /api/my-data (lean shape) so the SWR cache key
    // '/api/my-data' resolves to the exact payload the route handler
    // would have returned.
    const [profileRes, protocolRes, bloodTestsRes] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', user.id).single(),
      supabase
        .from('protocols')
        .select('*')
        .eq('user_id', user.id)
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from('blood_tests')
        .select('id, taken_at, biomarkers, lab_name')
        .eq('user_id', user.id)
        .is('deleted_at', null)
        .order('taken_at', { ascending: false }),
    ]);

    // Redact the BYOK column (matches /api/my-data behavior — never ship
    // the raw Anthropic key to the client bundle).
    const profile = profileRes.data as Record<string, unknown> | null;
    const profileSafe = profile
      ? (() => {
          const { anthropic_api_key, ...rest } = profile as {
            anthropic_api_key?: string | null;
          } & Record<string, unknown>;
          return { ...rest, hasAnthropicKey: !!anthropic_api_key };
        })()
      : null;

    return {
      profile: profileSafe,
      protocol: protocolRes.data,
      bloodTests: bloodTestsRes.data || [],
    };
  } catch {
    // Server-side fetch failure should never break the page. Return null
    // so the client falls back to its existing /api/my-data SWR call.
    return null;
  }
}

export default async function DashboardPage() {
  const initialMyData = await fetchInitialData();
  return <DashboardClient initialMyData={initialMyData} />;
}
