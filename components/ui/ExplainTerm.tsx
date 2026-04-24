'use client';

// Inline explainer for medical / technical jargon.
//
// Wrap any word that would send a non-technical reader to Google with
// <ExplainTerm term="hsCRP">hsCRP</ExplainTerm> and the word renders with a
// dotted underline. Focus (keyboard) or hover (mouse) opens a popover with
// a plain-English description, a "why it matters for longevity" line, the
// longevity-optimal range (when available from BIOMARKER_DB), and a link
// to the full `/biomarkers/[code]` page.
//
// The component is ~60 lines because it does real work: focus-visible
// keyboard support, aria-describedby wiring, outside-click + Escape to
// dismiss, auto-positioning when near the viewport edge. The alternative
// (native <abbr title="…">) is a nightmare on mobile and unreadable on
// desktop — tooltip fires only on hover, drops on a resize, no a11y.

import { useEffect, useId, useRef, useState } from 'react';
import Link from 'next/link';
import { BIOMARKER_DB } from '@/lib/engine/biomarkers';

export interface ExplainTermProps {
  /** Canonical term shown in the popover header + passed to the lookup (e.g. "hsCRP"). */
  term: string;
  /** Optional override for the visible text. Defaults to `term`. */
  children?: React.ReactNode;
  /** Override the "why it matters" line when the default (biomarker description) is wrong for the usage context. */
  why?: string;
  /** Override the plain-English explanation. */
  what?: string;
}

/** Look up a biomarker by code, name, or shortName (case-insensitive). */
function findBiomarker(term: string) {
  const q = term.toLowerCase().trim();
  return BIOMARKER_DB.find(b =>
    b.code.toLowerCase() === q ||
    b.shortName.toLowerCase() === q ||
    b.name.toLowerCase() === q
  );
}

export function ExplainTerm({ term, children, why, what }: ExplainTermProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLSpanElement>(null);
  const id = useId();
  const biomarker = findBiomarker(term);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const explainer = what ?? biomarker?.description ?? `${term} — clinical/technical term.`;
  const whyLine = why ?? (biomarker
    ? `Tracked because it's one of the measurable inputs to your longevity score.`
    : undefined);

  return (
    <span ref={rootRef} className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        onMouseEnter={() => setOpen(true)}
        onBlur={(e) => {
          // Close on blur unless focus moved INTO the popover (e.g. Tab to link).
          if (!rootRef.current?.contains(e.relatedTarget as Node)) setOpen(false);
        }}
        aria-expanded={open}
        aria-describedby={open ? id : undefined}
        className="underline decoration-dotted decoration-accent/60 underline-offset-2 hover:decoration-accent focus-visible:outline-none focus-visible:decoration-accent focus-visible:decoration-2 cursor-help"
      >
        {children ?? term}
      </button>
      {open && (
        <span
          id={id}
          role="tooltip"
          // Position: above the term if near the bottom, below otherwise. Simple
          // heuristic — we don't need full collision detection here.
          className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 w-72 max-w-[90vw] rounded-xl bg-surface-1 border border-card-border shadow-xl p-3 z-50 text-left animate-fade-in-up"
          onMouseLeave={() => setOpen(false)}
        >
          <span className="block text-xs font-semibold text-accent mb-1">
            {biomarker?.name ?? term}
          </span>
          <span className="block text-xs text-foreground/90 leading-relaxed">
            {explainer}
          </span>
          {whyLine && (
            <span className="block text-xs text-muted-foreground leading-relaxed mt-2">
              {whyLine}
            </span>
          )}
          {biomarker && (
            <span className="block text-xs text-muted font-mono mt-2 pt-2 border-t border-card-border">
              Longevity-optimal: {biomarker.longevityOptimalLow}–{biomarker.longevityOptimalHigh} {biomarker.unit}
              {biomarker.bryanJohnsonValue !== undefined && ` · Bryan: ${biomarker.bryanJohnsonValue}`}
            </span>
          )}
          {biomarker && (
            <Link
              href={`/biomarkers/${biomarker.code.toLowerCase()}`}
              className="inline-block text-xs text-accent hover:underline mt-2"
            >
              Read more →
            </Link>
          )}
        </span>
      )}
    </span>
  );
}

/**
 * Compact info-icon variant — use when you want a tiny (i) dot next to a
 * label rather than underlining the term itself. Same popover, same API,
 * no visible underline.
 */
export function HelpIcon({ term, why, what }: ExplainTermProps) {
  return (
    <ExplainTerm term={term} why={why} what={what}>
      <span
        aria-label={`Help: ${term}`}
        className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-surface-2 border border-card-border text-muted-foreground text-[11px] font-mono leading-none hover:bg-accent/10 hover:text-accent hover:border-accent/30 transition-colors"
      >
        i
      </span>
    </ExplainTerm>
  );
}
