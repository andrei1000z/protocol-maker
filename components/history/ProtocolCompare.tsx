'use client';

// Pick-any-two protocol comparator. Lives in /history beneath the
// latest-vs-previous diff block.
//
// Why: the default diff shows v(n) vs v(n-1). Users often want to answer
// "how far have I come?" (compare today vs 3 months ago) or "did the
// experiment I ran in v3 actually move the needle?" (pick v3 vs v5).
//
// Uses the protocol list already fetched by /api/protocol-history and
// computes the delta client-side. The DB-level RPC for granular diffs
// (supplement add/remove) isn't called here — this is the hero-numbers
// comparison. For the rich diff, users should still use the "Latest vs
// previous" section which is RPC-backed.

import { useState } from 'react';
import clsx from 'clsx';
import { GitCompareArrows, ArrowLeftRight } from 'lucide-react';

export interface ProtocolRow {
  id: string;
  created_at: string;
  longevity_score: number | null;
  biological_age_decimal: number | null;
  biological_age: number | null;
  aging_pace: number | null;
  generation_source?: string | null;
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('ro-RO', { month: 'short', day: 'numeric', year: '2-digit' });
}

function daysBetween(a: string, b: string) {
  return Math.abs(Math.round((new Date(a).getTime() - new Date(b).getTime()) / 864e5));
}

function sourceBadge(source: string | null | undefined) {
  if (!source) return null;
  const label = source === 'cron' ? 'Auto' : source === 'claude' ? 'AI' : source === 'groq' ? 'Groq' : source === 'fallback' ? 'Engine' : source;
  return (
    <span className="ml-1.5 text-[11px] font-medium font-mono uppercase tracking-widest px-1.5 py-0.5 rounded-full bg-surface-3 border border-card-border text-muted">
      {label}
    </span>
  );
}

function DeltaTile({
  label, a, b, unit = '', decimals = 0, goodDirection,
}: {
  label: string;
  a: number | null;
  b: number | null;
  unit?: string;
  decimals?: number;
  /** 'up' = higher is better; 'down' = lower is better. */
  goodDirection: 'up' | 'down';
}) {
  if (a === null || b === null) {
    return (
      <div className="p-4 rounded-xl bg-surface-2 border border-card-border">
        <p className="text-xs uppercase tracking-widest text-muted">{label}</p>
        <p className="text-sm text-muted-foreground mt-2">Missing data</p>
      </div>
    );
  }
  const delta = b - a;
  const significant = Math.abs(delta) >= (decimals > 0 ? 0.1 : 1);
  const improved = !significant ? null : goodDirection === 'up' ? delta > 0 : delta < 0;

  const tone = improved === true  ? 'bg-accent/[0.04] border-accent/25'
             : improved === false ? 'bg-red-500/[0.04] border-red-500/20'
             :                       'bg-surface-2 border-card-border';
  const textTone = improved === true ? 'text-accent' : improved === false ? 'text-danger' : 'text-muted-foreground';

  return (
    <div className={clsx('p-4 rounded-xl border', tone)}>
      <p className="text-xs uppercase tracking-widest text-muted">{label}</p>
      <div className="flex items-baseline gap-2 mt-2">
        <span className="text-xl font-bold font-mono tabular-nums text-muted-foreground">{a.toFixed(decimals)}{unit}</span>
        <ArrowLeftRight className="w-3.5 h-3.5 text-muted shrink-0" />
        <span className={clsx('text-xl font-bold font-mono tabular-nums', textTone)}>{b.toFixed(decimals)}{unit}</span>
      </div>
      {significant && (
        <p className={clsx('text-xs font-mono mt-2', textTone)}>
          {delta > 0 ? '+' : ''}{delta.toFixed(decimals)}{unit}
        </p>
      )}
    </div>
  );
}

export function ProtocolCompare({ protocols }: { protocols: ProtocolRow[] }) {
  // Need ≥ 2 protocols for a comparison. The "Latest vs previous" block
  // already covers the default case; we render only when there's room to
  // actually pick different endpoints (3+) — otherwise the component would
  // only ever show v1 vs v2 which the diff section already does.
  const sorted = [...protocols].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  const [leftIdx, setLeftIdx] = useState<number>(0);
  const [rightIdx, setRightIdx] = useState<number>(sorted.length - 1);

  if (sorted.length < 3) return null;

  const left = sorted[Math.min(leftIdx, sorted.length - 1)];
  const right = sorted[Math.min(rightIdx, sorted.length - 1)];
  const identical = left.id === right.id;

  return (
    <div className="rounded-2xl bg-surface-2 border border-card-border p-5 space-y-4">
      <div className="flex items-center gap-2 mb-1">
        <GitCompareArrows className="w-4 h-4 text-accent" />
        <h3 className="text-sm font-semibold">Compare any two protocols</h3>
      </div>
      <p className="text-[11px] text-muted-foreground leading-relaxed">
        Pick two points in your history to see how score, bio age, and aging speed shifted.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_1fr] gap-2 items-center">
        <select
          value={leftIdx}
          onChange={e => setLeftIdx(Number(e.target.value))}
          aria-label="Earlier protocol"
          className="rounded-xl bg-surface-3 border border-card-border px-3 py-2.5 text-sm outline-none focus:border-accent/50 cursor-pointer"
        >
          {sorted.map((p, i) => (
            <option key={p.id} value={i}>
              v{i + 1} · {fmtDate(p.created_at)}
            </option>
          ))}
        </select>
        <span className="text-muted-foreground text-xs text-center font-mono hidden sm:inline">vs</span>
        <select
          value={rightIdx}
          onChange={e => setRightIdx(Number(e.target.value))}
          aria-label="Later protocol"
          className="rounded-xl bg-surface-3 border border-card-border px-3 py-2.5 text-sm outline-none focus:border-accent/50 cursor-pointer"
        >
          {sorted.map((p, i) => (
            <option key={p.id} value={i}>
              v{i + 1} · {fmtDate(p.created_at)}
            </option>
          ))}
        </select>
      </div>

      {identical ? (
        <p className="text-xs text-muted-foreground italic">Pick two different protocols to see a delta.</p>
      ) : (
        <>
          <p className="text-[11px] text-muted-foreground font-mono">
            {fmtDate(left.created_at)}{sourceBadge(left.generation_source)}
            <span className="mx-2 text-muted">·</span>
            {daysBetween(left.created_at, right.created_at)} days apart
            <span className="mx-2 text-muted">·</span>
            {fmtDate(right.created_at)}{sourceBadge(right.generation_source)}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <DeltaTile label="Longevity score" a={left.longevity_score} b={right.longevity_score} goodDirection="up" />
            <DeltaTile
              label="Biological age"
              a={left.biological_age_decimal ?? left.biological_age}
              b={right.biological_age_decimal ?? right.biological_age}
              unit="y"
              decimals={1}
              goodDirection="down"
            />
            <DeltaTile label="Aging pace" a={left.aging_pace} b={right.aging_pace} unit="×" decimals={2} goodDirection="down" />
          </div>
        </>
      )}
    </div>
  );
}
