'use client';

// Service worker registration + aggressive update check.
//
// On every page load we re-register and explicitly call .update() so a
// client that's been running an older SW for days picks up new versions
// without needing a hard-reload. When the new SW reaches "installed"
// state we trigger SKIP_WAITING so it activates immediately instead of
// hanging in the standby queue until every tab closes.
//
// Why the aggressive update: the SW cache was previously storing 307
// redirect responses keyed by auth-gated URLs (e.g. /dashboard).  When
// the session cookie expired, the cached 307 would serve to the browser
// with stale Set-Cookie + Location, putting Chrome in a state where it
// would show "This page couldn't load" instead of following through to
// /login. Phase 16's sw.js v4 stops caching those responses; this file
// makes sure the new sw.js reaches users on their next visit.

import { useEffect } from 'react';

export function SWRegister() {
  useEffect(() => {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
    if (process.env.NODE_ENV !== 'production') return;

    let cancelled = false;

    (async () => {
      try {
        const registration = await navigator.serviceWorker.register('/sw.js');
        if (cancelled) return;

        // Force an immediate update check — Chrome usually checks every 24h
        // by default, which is way too slow when a hotfix needs to land.
        registration.update().catch(() => undefined);

        // When a new SW reaches "installed" state, tell it to skip waiting
        // so it activates without requiring all tabs to close.
        const promoteWaiting = () => {
          if (registration.waiting) {
            registration.waiting.postMessage({ type: 'SKIP_WAITING' });
          }
        };
        promoteWaiting();
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          if (!newWorker) return;
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              promoteWaiting();
            }
          });
        });
      } catch {
        // SW registration failed (offline, blocked, etc.) — non-fatal.
      }
    })();

    return () => { cancelled = true; };
  }, []);

  return null;
}
