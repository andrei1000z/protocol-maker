'use client';

// Subscription status card in Settings.
//
// Shows the current tier ('Free' or 'Pro'), period end if on Pro, and CTA:
//   - Free → "Trec la Pro" link to /pricing
//   - Pro  → "Gestionează abonamentul" opens Stripe Customer Portal
//
// Both fail gracefully when Stripe isn't configured server-side (returns 501
// from the route; we surface a clear "Tarife nu sunt încă active" message).

import { useState } from 'react';
import Link from 'next/link';
import { Crown, ExternalLink } from 'lucide-react';

export interface SubscriptionCardProps {
  status?: string | null;          // active | trialing | past_due | canceled | null
  tier?: string | null;            // 'pro' | null
  periodEnd?: string | null;       // ISO timestamp
  hasCustomerId: boolean;
}

const PAID_STATUSES = new Set(['active', 'trialing']);

export function SubscriptionCard({ status, tier, periodEnd, hasCustomerId }: SubscriptionCardProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isPaid = !!status && PAID_STATUSES.has(status);
  const isTrial = status === 'trialing';
  const isPastDue = status === 'past_due';

  const openPortal = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/stripe/portal', { method: 'POST' });
      if (res.status === 501) throw new Error('Stripe nu e configurat pe acest deploy. Owner-ul trebuie să adauge cheile.');
      const data = await res.json();
      if (!res.ok || !data.url) throw new Error(data.error || `HTTP ${res.status}`);
      window.location.assign(data.url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'A apărut o eroare');
      setLoading(false);
    }
  };

  const periodEndDate = periodEnd ? new Date(periodEnd).toLocaleDateString('ro-RO', { day: 'numeric', month: 'long', year: 'numeric' }) : null;

  return (
    <div className="glass-card rounded-2xl p-5 space-y-3.5 animate-fade-in-up">
      <div className="flex items-start gap-3">
        <div className={`w-10 h-10 rounded-xl border flex items-center justify-center shrink-0 ${
          isPaid ? 'bg-accent/10 border-accent/25 text-accent' : 'bg-surface-3 border-card-border text-muted-foreground'
        }`}>
          <Crown className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-semibold">Abonament</p>
            <span className={`inline-flex items-center text-xs font-mono px-2 py-0.5 rounded-full border ${
              isPaid ? 'bg-accent/10 text-accent border-accent/25'
              : isPastDue ? 'bg-red-500/10 text-danger border-red-500/25'
              : 'bg-surface-3 text-muted border-card-border'
            }`}>
              {isPaid ? (isTrial ? 'TRIAL' : 'PRO') : isPastDue ? 'NEPLĂTIT' : 'GRATUIT'}
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
            {isPaid && periodEndDate && (
              isTrial
                ? `Trial-ul tău se încheie pe ${periodEndDate}.`
                : `Următoarea încasare în jurul datei ${periodEndDate}.`
            )}
            {!isPaid && !isPastDue && 'Folosești planul gratuit. Treci la Pro pentru limite mai mari și acces prioritar la Claude.'}
            {isPastDue && 'Ultima plată a eșuat. Actualizează metoda de plată din portal ca să eviți downgrade-ul automat la gratuit.'}
          </p>
        </div>
      </div>

      {error && (
        <p className="text-xs text-danger">{error}</p>
      )}

      <div className="flex flex-wrap gap-2">
        {!isPaid ? (
          <Link
            href="/pricing"
            className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-accent text-black font-semibold hover:bg-accent-bright transition-colors"
          >
            <Crown className="w-3.5 h-3.5" />
            Vezi tarifele
          </Link>
        ) : (
          <button
            onClick={openPortal}
            disabled={loading || !hasCustomerId}
            className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-surface-2 border border-card-border text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            {loading ? 'Se deschide…' : 'Gestionează abonamentul'}
          </button>
        )}
      </div>
    </div>
  );
}
