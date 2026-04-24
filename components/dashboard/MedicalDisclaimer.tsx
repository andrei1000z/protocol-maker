'use client';

// Medical disclaimer band — shown right under the dashboard hero. Makes the
// lifestyle-optimization-vs-medical-diagnosis line unambiguous for every
// reader who lands on the page: user, someone they shared with, a doctor.
//
// Two deliberate design choices:
//
// 1. Dismissible PER SESSION (sessionStorage), not permanent. Forgetting you
//    dismissed it once doesn't mean the app gets to stop disclosing.
//    A doctor who opens the shared dashboard still sees it fresh every time.
//
// 2. "Citește mai mult" does NOT navigate — it expands inline. Navigating
//    to /terms is a user-flow dead-end on a page where they're in the middle
//    of something (reviewing their plan). Expanding keeps context.

import { useEffect, useState } from 'react';
import { AlertCircle, ChevronDown, ChevronUp, X } from 'lucide-react';

const DISMISS_KEY = 'protocol:dashboard-disclaimer-dismissed:v1';

export function MedicalDisclaimer() {
  const [dismissed, setDismissed] = useState(false);
  const [expanded, setExpanded] = useState(false);
  // Hydrate dismiss state from sessionStorage. Avoid SSR flicker by mounting
  // the component optimistically and letting the effect hide it if needed.
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      if (sessionStorage.getItem(DISMISS_KEY) === '1') setDismissed(true);
    } catch { /* ignore — sessionStorage can be blocked */ }
    setHydrated(true);
  }, []);

  const handleDismiss = () => {
    setDismissed(true);
    try { sessionStorage.setItem(DISMISS_KEY, '1'); } catch { /* ignore */ }
  };

  if (!hydrated || dismissed) return null;

  return (
    <div className="rounded-2xl border border-amber-500/25 bg-amber-500/5 p-3 sm:p-4 flex items-start gap-3 animate-fade-in">
      <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" aria-hidden="true" />
      <div className="flex-1 min-w-0">
        <p className="text-xs sm:text-sm font-semibold text-amber-400">
          Asta e optimizare de lifestyle, nu diagnostic medical
        </p>
        <p className="text-xs text-foreground/85 leading-relaxed mt-1">
          Protocolul nu înlocuiește consultul la medic. Dacă ai simptome acute (durere în piept, respirație dificilă, gânduri suicidare), sună la <strong className="text-foreground">112</strong> sau mergi la spital.
        </p>
        {expanded && (
          <div className="mt-2 space-y-2 text-xs text-foreground/80 leading-relaxed border-t border-amber-500/20 pt-2">
            <p>
              Recomandările sunt generate pe baza datelor tale de laborator + stil de viață și referințe din literatura de longevitate. Nu suntem cabinet medical, nu diagnosticăm boli, și nu poți substitui controalele de specialitate cu un protocol AI.
            </p>
            <p>
              Pentru orice medicament, modificare de dozaj, supliment cu interacțiuni cunoscute, sau schimbare semnificativă în dietă când ai deja o condiție medicală — consultă medicul tău înainte să aplici recomandarea.
            </p>
            <p className="text-muted-foreground">
              Termenii și condițiile complete sunt la <a href="/terms" className="text-accent hover:underline">/terms</a>.
            </p>
          </div>
        )}
        <button
          type="button"
          onClick={() => setExpanded(e => !e)}
          className="mt-2 inline-flex items-center gap-1 text-xs text-amber-400 hover:text-amber-300 transition-colors"
        >
          {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          {expanded ? 'Mai puțin' : 'Citește mai mult'}
        </button>
      </div>
      <button
        type="button"
        onClick={handleDismiss}
        aria-label="Ascunde avertismentul"
        className="shrink-0 p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-amber-500/10 transition-colors"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
