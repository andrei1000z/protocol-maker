'use client';

// Floating "Ask AI" pill that lives in the dashboard's bottom-right corner.
//
// Why: users on the dashboard frequently have one-line questions ("why did
// my ApoB go up?", "is my sleep score good?") that are answerable by the
// existing chat endpoint. Before this component, the path was: scroll to
// top → tap Chat → type → submit. Now it's: tap pill → pick a suggestion
// or type → arrive at /chat with the question pre-seeded.
//
// The pill deep-links to /chat?q=... which the chat page reads on mount and
// auto-submits the first turn. Keeps the "ask about my dashboard" shortcut
// one click, without building a second chat stream inside the dashboard.

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { MessageSquarePlus, X } from 'lucide-react';
import clsx from 'clsx';

// Quick templates — the questions users are most likely to ask from the
// dashboard. Phrased in first-person because that's how the user will type.
const QUICK_PROMPTS = [
  'Why did my longevity score change?',
  'Which supplement moves my biomarkers fastest?',
  'What should I focus on this week?',
  'Is my sleep trend concerning?',
  'How do I lower my ApoB?',
  'Which organ system needs the most help?',
];

export function AskAIPill() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState('');
  const panelRef = useRef<HTMLDivElement>(null);

  // Close on outside click. Registered only while open so we don't hold a
  // document-level mousedown listener forever.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const go = (q: string) => {
    const trimmed = q.trim();
    if (!trimmed) return;
    setOpen(false);
    router.push(`/chat?q=${encodeURIComponent(trimmed)}`);
  };

  return (
    <div ref={panelRef} className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-40">
      {open && (
        <div className="mb-3 w-[min(88vw,360px)] rounded-2xl border border-card-border bg-surface-1 shadow-2xl p-4 space-y-3 animate-fade-in-up">
          <div className="flex items-start justify-between gap-3">
            <p className="text-sm font-semibold leading-tight">Ask about your protocol</p>
            <button onClick={() => setOpen(false)} aria-label="Close" className="p-1 -mr-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-surface-2 transition-colors">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <form onSubmit={(e) => { e.preventDefault(); go(value); }}>
            <input
              autoFocus
              value={value}
              onChange={e => setValue(e.target.value)}
              placeholder="Type a question or pick one below…"
              className="w-full px-3 py-2.5 rounded-xl bg-surface-2 border border-card-border text-sm outline-none focus:border-accent/50 placeholder:text-muted-foreground/50"
              aria-label="Question for the AI"
            />
          </form>

          <div className="space-y-1">
            {QUICK_PROMPTS.map(p => (
              <button
                key={p}
                onClick={() => go(p)}
                className="w-full text-left text-xs text-muted-foreground hover:text-accent hover:bg-accent/5 px-2.5 py-1.5 rounded-lg transition-colors truncate"
              >
                {p}
              </button>
            ))}
          </div>
        </div>
      )}

      <button
        onClick={() => setOpen(o => !o)}
        aria-label={open ? 'Close Ask AI' : 'Ask AI about your protocol'}
        aria-expanded={open}
        className={clsx(
          'rounded-full flex items-center justify-center shadow-xl transition-all active:scale-95',
          open
            ? 'w-12 h-12 bg-surface-2 border border-card-border text-muted-foreground'
            : 'w-14 h-14 sm:w-auto sm:h-12 sm:px-5 sm:gap-2 bg-accent text-black hover:bg-accent-bright glow-cta',
        )}
      >
        {open ? <X className="w-5 h-5" /> : (
          <>
            <MessageSquarePlus className="w-5 h-5" />
            <span className="hidden sm:inline text-sm font-semibold">Ask AI</span>
          </>
        )}
      </button>
    </div>
  );
}
