'use client';

// 4-step modal tour that shows ONCE on a real user's first dashboard visit.
// Explains the four things that most confuse a new user:
//   1. The longevity score — what number + what it means
//   2. Biological age vs chronological age
//   3. Organ scores and what low means
//   4. How to keep scrolling for the full plan
//
// Rules:
//   - Skipped entirely in demo mode (user hasn't signed up yet; we don't want
//     to burn the tour budget on a tire-kicker).
//   - One-shot via localStorage flag. Dismiss = never again.
//   - Escape + outside click close it (same semantics as a modal).
//   - Copy is RO — this is the moment the non-technical user meets the
//     product, and English here kills trust.

import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Sparkles, X } from 'lucide-react';

const SEEN_KEY = 'protocol:dashboard-tour-seen:v1';

interface Step {
  title: string;
  body: string;
}

const STEPS: Step[] = [
  {
    title: 'Scorul tău de longevitate',
    body: 'Numărul mare din 100 îți arată cât de bine stai față de un profil optim. 90+ = ritm Bryan Johnson. 70-85 = bine, ai loc de îmbunătățire. <60 = prioritate mare de adresat.',
  },
  {
    title: 'Vârsta biologică vs cea reală',
    body: 'Vârsta biologică e estimată din analize + stil de viață — poate fi mai mică sau mai mare decât vârsta ta reală. Fiecare "kg gras" în plus, noapte prost dormită, sau biomarker inflamat te îmbătrânește biologic.',
  },
  {
    title: 'Organele tale — scor pe fiecare sistem',
    body: 'Graficul radar îți spune ce sistem e cel mai slab. Un cardiovascular la 50/100 e prima prioritate. Click pe fiecare organ pentru detalii și ce poți schimba.',
  },
  {
    title: 'Plan complet — scroll în jos',
    body: 'Sub diagnostic e protocolul tău: nutriție, suplimente cu how-to, program zilnic, plan de antrenament, somn, obiceiuri. Poți bifa ce urmezi — sistemul învață și se adaptează.',
  },
];

export function FirstVisitTour({ demoMode }: { demoMode: boolean }) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (demoMode) return;                       // never fire in demo
    try {
      if (localStorage.getItem(SEEN_KEY) === '1') return;
      // Small delay so the dashboard has a chance to render first — avoids
      // the tour mounting before the user even sees what it's pointing at.
      const t = setTimeout(() => setOpen(true), 900);
      return () => clearTimeout(t);
    } catch { /* localStorage blocked — silently skip tour */ }
  }, [demoMode]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') handleClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const handleClose = () => {
    setOpen(false);
    try { localStorage.setItem(SEEN_KEY, '1'); } catch { /* ignore */ }
  };

  if (!open) return null;

  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="tour-title"
      className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center animate-fade-in"
    >
      <div className="absolute inset-0 bg-black/75 backdrop-blur-sm" onClick={handleClose} />
      <div
        className="relative w-full sm:max-w-md bg-surface-1 border border-card-border rounded-t-3xl sm:rounded-3xl p-6 sm:p-7 animate-fade-in-up"
        onClick={e => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={handleClose}
          aria-label="Închide tour-ul"
          className="absolute top-4 right-4 p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-surface-2 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-2 text-accent text-xs font-mono uppercase tracking-widest mb-3">
          <Sparkles className="w-3.5 h-3.5" />
          {step + 1} din {STEPS.length}
        </div>

        <h2 id="tour-title" className="text-lg sm:text-xl font-bold tracking-tight mb-2">
          {current.title}
        </h2>
        <p className="text-sm text-foreground/90 leading-relaxed">
          {current.body}
        </p>

        {/* Progress pills */}
        <div className="flex gap-1.5 mt-5">
          {STEPS.map((_, i) => (
            <span
              key={i}
              className={`h-1 flex-1 rounded-full transition-colors ${i <= step ? 'bg-accent' : 'bg-card-border'}`}
            />
          ))}
        </div>

        <div className="flex items-center justify-between gap-2 mt-5">
          {step > 0 ? (
            <button
              type="button"
              onClick={() => setStep(s => Math.max(0, s - 1))}
              className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground px-3 py-2 rounded-lg hover:bg-surface-2 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
              Înapoi
            </button>
          ) : (
            <button
              type="button"
              onClick={handleClose}
              className="text-sm text-muted-foreground hover:text-foreground px-3 py-2 rounded-lg hover:bg-surface-2 transition-colors"
            >
              Sari peste
            </button>
          )}

          {isLast ? (
            <button
              type="button"
              onClick={handleClose}
              className="inline-flex items-center gap-1.5 text-sm font-semibold px-4 py-2 rounded-xl bg-accent text-black hover:bg-accent-bright transition-colors"
            >
              Am înțeles
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setStep(s => Math.min(STEPS.length - 1, s + 1))}
              className="inline-flex items-center gap-1.5 text-sm font-semibold px-4 py-2 rounded-xl bg-accent text-black hover:bg-accent-bright transition-colors"
            >
              Următorul
              <ChevronRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
