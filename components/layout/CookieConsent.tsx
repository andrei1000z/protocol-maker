'use client';

// EU-compliant cookie consent banner. Wraps Vercel Analytics so it only
// mounts when the user has actively opted in. Essential cookies (Supabase
// session, theme/locale prefs) are not gated — they're either strictly
// necessary or pure first-party preference storage.
//
// Storage key: 'protocol:consent' = JSON.stringify({ analytics: bool, ts: number, v: 1 })
// Decision absence = render banner; presence = no banner, gate analytics by flag.

import { useSyncExternalStore } from 'react';
import { Cookie, X } from 'lucide-react';
import { Analytics } from '@vercel/analytics/react';

const CONSENT_KEY = 'protocol:consent';
const CONSENT_VERSION = 1;
const CONSENT_EVENT = 'protocol:consent-changed';

type Consent = { analytics: boolean; ts: number; v: number };

function readConsent(): Consent | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(CONSENT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Consent;
    if (parsed?.v !== CONSENT_VERSION) return null;
    return parsed;
  } catch { return null; }
}

function writeConsent(analytics: boolean): Consent {
  const consent: Consent = { analytics, ts: Date.now(), v: CONSENT_VERSION };
  try { localStorage.setItem(CONSENT_KEY, JSON.stringify(consent)); } catch { /* ignore */ }
  // Notify same-tab listeners + sibling components.
  try { window.dispatchEvent(new CustomEvent(CONSENT_EVENT, { detail: consent })); } catch { /* ignore */ }
  return consent;
}

function subscribe(callback: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  // Same-tab updates fire our custom event; other tabs fire 'storage'.
  window.addEventListener(CONSENT_EVENT, callback);
  window.addEventListener('storage', callback);
  return () => {
    window.removeEventListener(CONSENT_EVENT, callback);
    window.removeEventListener('storage', callback);
  };
}

// `undefined` is the SSR snapshot. Once we know the localStorage state we
// switch to either `null` (no decision yet → show banner) or a `Consent`.
function getServerSnapshot(): undefined { return undefined; }
function getClientSnapshot(): Consent | null { return readConsent(); }

export function CookieConsent() {
  const consent = useSyncExternalStore<Consent | null | undefined>(
    subscribe,
    getClientSnapshot,
    getServerSnapshot,
  );

  // Loading phase — render nothing. Analytics stays unmounted until consent is
  // explicitly granted. This matches "prior consent" under GDPR — the default
  // must be no tracking, not "consent assumed unless they reject".
  if (consent === undefined) return null;

  // User has chosen — render Analytics conditionally, no banner.
  if (consent !== null) {
    return consent.analytics ? <Analytics /> : null;
  }

  // No decision yet — render the banner.
  return (
    <div
      role="dialog"
      aria-labelledby="cookie-consent-title"
      aria-describedby="cookie-consent-body"
      className="fixed bottom-4 left-4 right-4 sm:left-1/2 sm:-translate-x-1/2 sm:max-w-xl z-50 animate-fade-in-up"
    >
      <div className="glass-card rounded-2xl p-4 sm:p-5 shadow-lg border-accent/25 flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-accent/10 border border-accent/25 flex items-center justify-center shrink-0">
          <Cookie className="w-5 h-5 text-accent" aria-hidden />
        </div>
        <div className="flex-1 min-w-0 space-y-2.5">
          <p id="cookie-consent-title" className="text-sm font-semibold">
            Cookie-uri & analytics
          </p>
          <p id="cookie-consent-body" className="text-xs text-muted-foreground leading-relaxed">
            Folosim cookie-uri esențiale pentru a-ți păstra sesiunea și preferințele.
            Cu acordul tău, adăugăm Vercel Analytics ca să vedem ce funcționează
            (anonim, fără profiling, fără third-party advertising). Poți schimba
            oricând din Setări.
          </p>
          <div className="flex flex-wrap gap-2 pt-1">
            <button
              onClick={() => writeConsent(true)}
              className="inline-flex items-center text-xs font-semibold px-3 py-1.5 rounded-lg bg-accent text-black hover:bg-accent-bright transition-colors"
            >
              Accept analytics
            </button>
            <button
              onClick={() => writeConsent(false)}
              className="inline-flex items-center text-xs font-semibold px-3 py-1.5 rounded-lg border border-card-border hover:bg-card transition-colors"
            >
              Doar esențiale
            </button>
            <a
              href="/privacy"
              className="inline-flex items-center text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1.5"
            >
              Detalii
            </a>
          </div>
        </div>
        <button
          onClick={() => writeConsent(false)}
          aria-label="Refuză cookie-urile non-esențiale"
          className="p-1 rounded-lg text-muted-foreground hover:text-foreground transition-colors shrink-0"
        >
          <X className="w-4 h-4" aria-hidden />
        </button>
      </div>
    </div>
  );
}

// Public helper for the Settings page — lets the user revisit their choice.
export function resetConsent() {
  try { localStorage.removeItem(CONSENT_KEY); } catch { /* ignore */ }
  try { window.dispatchEvent(new CustomEvent(CONSENT_EVENT, { detail: null })); } catch { /* ignore */ }
}
