'use client';

// One-shot post-regenerate toast — the tracking page's Refresh button writes
// a `protocol:regen-diff:latest` entry to localStorage, this component reads
// it on mount, renders once, then clears the entry. 5-min TTL keeps stale
// diffs from popping after a hard refresh.

import { useEffect, useState } from 'react';

interface Diff {
  scoreDelta: number | null;
  bioAgeDelta: number | null;
  paceDelta: number | null;
  supplementsAdded: number;
  supplementsRemoved: number;
}

export function RegenDiffToast() {
  const [diff, setDiff] = useState<Diff | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const raw = localStorage.getItem('protocol:regen-diff:latest');
      if (!raw) return;
      const parsed = JSON.parse(raw) as { diff?: unknown; ts?: number };
      if (parsed?.ts && Date.now() - parsed.ts < 5 * 60_000 && parsed.diff) {
        setDiff(parsed.diff as Diff);
      }
      localStorage.removeItem('protocol:regen-diff:latest');
    } catch { /* corrupt or quota — ignore */ }
  }, []);

  if (!diff || dismissed) return null;
  const bits: string[] = [];
  if (typeof diff.scoreDelta === 'number' && diff.scoreDelta !== 0) {
    bits.push(`${diff.scoreDelta > 0 ? '+' : ''}${diff.scoreDelta} scor`);
  }
  if (typeof diff.bioAgeDelta === 'number' && Math.abs(diff.bioAgeDelta) >= 0.1) {
    bits.push(`${diff.bioAgeDelta > 0 ? '+' : ''}${diff.bioAgeDelta.toFixed(1)}y vârstă bio`);
  }
  if (typeof diff.paceDelta === 'number' && Math.abs(diff.paceDelta) >= 0.01) {
    bits.push(`${diff.paceDelta > 0 ? '+' : ''}${diff.paceDelta.toFixed(2)} ritm`);
  }
  if (diff.supplementsAdded > 0) bits.push(`+${diff.supplementsAdded} suplimente`);
  if (diff.supplementsRemoved > 0) bits.push(`−${diff.supplementsRemoved} suplimente`);

  return (
    <div className="rounded-2xl bg-gradient-to-r from-accent/12 to-accent/4 border border-accent/30 p-4 flex items-center gap-3 animate-fade-in-up no-print">
      <span className="text-xl shrink-0">✨</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-accent">Protocol actualizat</p>
        <p className="text-xs text-muted-foreground mt-0.5">
          {bits.length > 0 ? bits.join(' · ') : 'Fără modificări majore față de versiunea anterioară.'}
        </p>
      </div>
      <button
        onClick={() => setDismissed(true)}
        aria-label="Închide"
        className="shrink-0 text-xs text-muted-foreground hover:text-foreground px-2 py-1"
      >
        Închide
      </button>
    </div>
  );
}
