'use client';

// Thin transparency band surfaced when the current protocol was NOT produced
// by Claude (primary model). Users deserve to know when they received a
// lower-tier result + offered a free regen.
//
// Two tones:
//   - "groq"     = Claude was momentarily unavailable; Groq Llama filled in.
//                   Quality is close; still worth a re-try later.
//   - "fallback" = both AI paths failed; the deterministic engine ran.
//                   Lower fidelity — user should definitely re-generate.

import { useState } from 'react';
import { RefreshCw, AlertCircle } from 'lucide-react';
import { invalidate } from '@/lib/hooks/useApiData';
import { toast } from '@/lib/toast';

export function FallbackBanner({ source }: { source: 'groq' | 'fallback' }) {
  const [regenerating, setRegenerating] = useState(false);

  const handleRegen = async () => {
    if (regenerating) return;
    setRegenerating(true);
    try {
      const res = await fetch('/api/generate-protocol', { method: 'POST' });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        if (res.status === 429) {
          throw new Error(j.error || 'Ai atins limita zilnică. Încearcă mâine.');
        }
        throw new Error(j.error || `Regenerare eșuată (${res.status})`);
      }
      invalidate.myData();
      invalidate.liveScores();
      invalidate.protocolHistory();
      toast({ tone: 'success', title: 'Protocol regenerat', description: 'Acum e produs de modelul premium.' });
    } catch (e) {
      toast({ tone: 'error', title: 'Regenerare eșuată', description: e instanceof Error ? e.message : 'Încearcă din nou.' });
    } finally {
      setRegenerating(false);
    }
  };

  const copy = source === 'groq'
    ? {
        headline: 'Modelul premium era ocupat — am folosit motorul de rezervă',
        body: 'Rezultatul e apropiat calitativ dar nu identic. Poți regenera gratuit când vrei.',
      }
    : {
        headline: 'AI-ul nu a răspuns — ai protocolul generat de engine-ul nostru',
        body: 'Mai puțin detaliat decât varianta AI. Regenerează acum dacă vrei versiunea completă.',
      };

  const tone = source === 'fallback'
    ? 'bg-amber-500/5 border-amber-500/25 text-amber-400'
    : 'bg-accent/5 border-accent/25 text-accent';

  return (
    <div className={`rounded-2xl border p-3 sm:p-4 flex items-start gap-3 ${tone}`}>
      <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
      <div className="flex-1 min-w-0">
        <p className="text-xs sm:text-sm font-semibold">{copy.headline}</p>
        <p className="text-xs text-foreground/85 leading-relaxed mt-0.5">{copy.body}</p>
      </div>
      <button
        type="button"
        onClick={handleRegen}
        disabled={regenerating}
        className="shrink-0 inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-accent text-black hover:bg-accent-bright disabled:opacity-50 transition-colors"
      >
        {regenerating ? (
          <>
            <span className="w-3 h-3 border-2 border-black/40 border-t-black rounded-full animate-spin" />
            Regenerez…
          </>
        ) : (
          <>
            <RefreshCw className="w-3 h-3" />
            Regenerează
          </>
        )}
      </button>
    </div>
  );
}
