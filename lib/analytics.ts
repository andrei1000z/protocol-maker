// Thin wrapper around @vercel/analytics' server `track()`.
//
// Why go through a wrapper instead of importing `track` directly at each call
// site:
//   1. Swallow all failures. The analytics endpoint is fire-and-forget — a
//      network blip should never surface as an exception in a user flow.
//   2. Single place to add common props (env, app version) later.
//   3. Silent no-op in dev (NODE_ENV !== 'production') so local runs don't
//      spam the dashboard or burn quota.
//
// Call from server actions / route handlers only. Client-side call sites
// should import `track` from '@vercel/analytics/react' — the payload shape
// is identical, but the transport is different.

import { track as vercelTrack } from '@vercel/analytics/server';

type AllowedValue = string | number | boolean | null | undefined;

/** Server-side analytics event. Fire-and-forget, never throws. */
export function trackServer(event: string, props?: Record<string, AllowedValue>): void {
  // Dev runs: skip to avoid noise + quota burn. Flip VERCEL_ANALYTICS_DEV=1 to
  // force emit locally for debugging.
  if (process.env.NODE_ENV !== 'production' && process.env.VERCEL_ANALYTICS_DEV !== '1') {
    return;
  }
  try {
    // No await — the fire-and-forget semantic matters: analytics must never
    // delay the response to the user.
    void vercelTrack(event, props ?? {});
  } catch { /* swallow — analytics must never break a flow */ }
}
