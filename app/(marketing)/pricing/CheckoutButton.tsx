'use client';

import { useState } from 'react';
import { Loader2 } from 'lucide-react';

// Pro CTA — POSTs to /api/stripe/checkout and redirects to the hosted
// Stripe page. If the user isn't signed in, /api/stripe/checkout returns
// 401 and we send them to /login first with a return path baked in.

export function CheckoutButton() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const start = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          successPath: '/settings?subscription=success',
          cancelPath: '/pricing?canceled=1',
        }),
      });
      if (res.status === 401) {
        // Redirect through login first; preserve intent.
        window.location.assign('/login?return=/pricing');
        return;
      }
      const data = await res.json();
      if (!res.ok || !data.url) throw new Error(data.error || `HTTP ${res.status}`);
      window.location.assign(data.url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'A apărut o eroare');
      setLoading(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={start}
        disabled={loading}
        className="block w-full text-center px-4 py-3 rounded-xl bg-accent text-black text-sm font-semibold hover:bg-accent-bright disabled:opacity-50 transition-colors inline-flex items-center justify-center gap-2"
      >
        {loading && <Loader2 className="w-4 h-4 animate-spin" />}
        {loading ? 'Se redirecționează…' : 'Trec la Pro'}
      </button>
      {error && <p className="text-xs text-danger mt-2 text-center">{error}</p>}
    </>
  );
}
