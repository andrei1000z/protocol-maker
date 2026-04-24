'use client';

// "Take now" supplement view — the raw protocol supplement list bucketed by
// time-of-day with the currently-active window expanded, others collapsed.
//
// Why this exists: the stock supplement stack is a flat list sorted by
// priority. At 08:15 the user doesn't want to scan 12 items to figure out
// which ones to take with breakfast — they want a "morning: Vitamin D,
// Omega-3, NAC" callout at the top. This component provides that.
//
// The AI already writes per-supplement timing strings. We just group them
// via lib/engine/supplement-timing.ts and render a tight, scannable UI.

import { useEffect, useMemo, useState } from 'react';
import {
  bucketSupplements,
  currentSupplementBucket,
  BUCKET_LABELS,
  type SupplementBucket,
  type SupplementLike,
} from '@/lib/engine/supplement-timing';
import clsx from 'clsx';
import { ChevronDown } from 'lucide-react';

interface Props {
  supplements: SupplementLike[] | null | undefined;
}

// Bucket render order — matches a user's day rather than alphabetical.
const BUCKET_ORDER: SupplementBucket[] = ['morning', 'midday', 'evening', 'bedtime', 'anytime'];

export function SupplementTimeGroups({ supplements }: Props) {
  // Track the active bucket so the UI can auto-expand the one that matches
  // the user's local time. Updates every minute so a user sitting on the
  // page across a bucket transition sees the right section open.
  const [activeBucket, setActiveBucket] = useState<SupplementBucket>(() =>
    currentSupplementBucket(new Date().getHours()),
  );
  useEffect(() => {
    const tick = () => setActiveBucket(currentSupplementBucket(new Date().getHours()));
    const id = setInterval(tick, 60_000);
    return () => clearInterval(id);
  }, []);

  const [openOverride, setOpenOverride] = useState<Set<SupplementBucket>>(new Set());

  const grouped = useMemo(() => bucketSupplements(supplements), [supplements]);

  if (!supplements || supplements.length === 0) return null;

  const bucketIsOpen = (b: SupplementBucket) => b === activeBucket || openOverride.has(b);
  const toggleBucket = (b: SupplementBucket) => {
    setOpenOverride(prev => {
      const next = new Set(prev);
      // Opening any bucket promotes it to "manually opened"; closing an
      // auto-opened bucket requires remembering that closure too.
      if (next.has(b)) next.delete(b);
      else next.add(b);
      return next;
    });
    // If user explicitly closes the active bucket, move "active" elsewhere.
    if (b === activeBucket) setActiveBucket('anytime');
  };

  return (
    <div className="space-y-2">
      {BUCKET_ORDER.map(bucket => {
        const items = grouped[bucket];
        if (!items || items.length === 0) return null;
        const meta = BUCKET_LABELS[bucket];
        const isOpen = bucketIsOpen(bucket);
        const isNow = bucket === activeBucket;

        return (
          <div key={bucket} className={clsx('rounded-xl border transition-colors',
            isNow ? 'bg-accent/[0.06] border-accent/30' : 'bg-surface-2 border-card-border')}
          >
            <button
              onClick={() => toggleBucket(bucket)}
              className="w-full flex items-center gap-3 px-4 py-3 text-left"
              aria-expanded={isOpen}
            >
              <span className="text-lg" aria-hidden>{meta.emoji}</span>
              <div className="flex-1 min-w-0">
                <p className={clsx('text-sm font-semibold', isNow && 'text-accent')}>
                  {meta.title}
                  {isNow && <span className="ml-2 text-xs font-mono uppercase tracking-wider bg-accent/15 text-accent px-1.5 py-0.5 rounded-full border border-accent/25">Take now</span>}
                </p>
                <p className="text-xs text-muted-foreground">{meta.hint} · {items.length} item{items.length === 1 ? '' : 's'}</p>
              </div>
              <ChevronDown className={clsx('w-4 h-4 text-muted-foreground transition-transform shrink-0', isOpen && 'rotate-180')} />
            </button>

            {isOpen && (
              <ul className="px-3 pb-3 space-y-1.5">
                {items.map((s, i) => (
                  <li key={`${s.name || ''}-${i}`} className="flex items-start gap-3 px-3 py-2 rounded-lg bg-surface-1/60 border border-card-border">
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-medium truncate">
                        {s.name}
                        {s.priority && (
                          <span className={clsx('ml-2 text-[11px] font-medium font-mono uppercase tracking-widest px-1.5 py-0.5 rounded-full border align-middle',
                            /MUST|CRITICAL|HIGH/i.test(s.priority) ? 'text-danger bg-red-500/10 border-red-500/25'
                            : /STRONG/i.test(s.priority) ? 'text-accent bg-accent/10 border-accent/25'
                            : 'text-muted-foreground bg-surface-3 border-card-border')}>
                            {s.priority}
                          </span>
                        )}
                      </p>
                      {(s.dose || s.timing) && (
                        <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug truncate">
                          {s.dose && <span className="text-foreground/90 font-mono">{s.dose}</span>}
                          {s.dose && s.timing && <span className="text-muted mx-1.5">·</span>}
                          {s.timing}
                        </p>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        );
      })}
    </div>
  );
}
