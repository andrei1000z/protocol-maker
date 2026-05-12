'use client';

// Settings card surfacing the user's current cookie/analytics decision and
// letting them revisit it without clearing site data. Pairs with the
// CookieConsent component mounted in app/layout.tsx — same storage key,
// same event broadcast so resetting from here re-shows the banner.

import { useSyncExternalStore } from 'react';
import { Cookie, RotateCcw } from 'lucide-react';
import { resetConsent } from '@/components/layout/CookieConsent';

const CONSENT_KEY = 'protocol:consent';
const CONSENT_EVENT = 'protocol:consent-changed';

type Consent = { analytics: boolean; ts: number; v: number };

function readConsent(): Consent | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(CONSENT_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as Consent;
  } catch { return null; }
}

function subscribe(cb: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  window.addEventListener(CONSENT_EVENT, cb);
  window.addEventListener('storage', cb);
  return () => {
    window.removeEventListener(CONSENT_EVENT, cb);
    window.removeEventListener('storage', cb);
  };
}

export function PrivacyControls() {
  const consent = useSyncExternalStore<Consent | null | undefined>(
    subscribe,
    () => readConsent(),
    () => undefined,
  );

  // SSR snapshot — render a stable shell so hydration matches.
  if (consent === undefined) {
    return (
      <div className="glass-card rounded-2xl p-5 space-y-3 animate-fade-in-up">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-accent/10 border border-accent/25 flex items-center justify-center">
            <Cookie className="w-5 h-5 text-accent" />
          </div>
          <div>
            <p className="text-sm font-semibold">Confidențialitate</p>
            <p className="text-xs text-muted-foreground">Se încarcă preferințele…</p>
          </div>
        </div>
      </div>
    );
  }

  const status = consent === null
    ? 'Nicio alegere salvată — la următoarea vizită vei vedea bannerul.'
    : consent.analytics
      ? 'Analytics acceptat. Vercel Analytics e activ.'
      : 'Doar cookie-uri esențiale. Analytics e dezactivat.';
  const statusTone = consent === null
    ? 'text-amber-400'
    : consent.analytics ? 'text-accent' : 'text-muted-foreground';

  return (
    <div className="glass-card rounded-2xl p-5 space-y-4 animate-fade-in-up">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-accent/10 border border-accent/25 flex items-center justify-center shrink-0">
          <Cookie className="w-5 h-5 text-accent" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold">Confidențialitate & cookie-uri</p>
          <p className={`text-xs mt-0.5 leading-relaxed ${statusTone}`}>{status}</p>
          <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
            Detalii complete despre prelucrare, sub-procesatori (Anthropic, Groq, Supabase, Vercel, Stripe) și drepturile tale găsești pe{' '}
            <a href="/privacy" className="text-accent hover:underline">pagina de confidențialitate</a>.
          </p>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={resetConsent}
          className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-surface-2 border border-card-border text-muted-foreground hover:text-foreground hover:border-accent/30 transition-colors"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          Schimbă preferințele cookie
        </button>
      </div>
    </div>
  );
}
