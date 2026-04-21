'use client';

// "Morning brief / Evening recap" — single card at the top of the dashboard
// that summarizes what matters RIGHT NOW.
//
// Content blends three data sources:
//   1. Latest daily_metrics row (sleep hours, HRV, resting HR) — answers
//      "how was last night?" for morning viewers.
//   2. Current supplement bucket via lib/engine/supplement-timing.ts —
//      surfaces "take these N now" so the user doesn't have to scroll.
//   3. Picked top-focus from pickTodaysFocus (already powering the Today's
//      Focus block lower on the page) to give one action item.
//
// Renders different copy based on time of day so the card feels alive —
// morning gets sleep stats + AM supplements, evening gets "wind down" +
// bedtime supplements.

import { useMemo } from 'react';
import clsx from 'clsx';
import { Sunrise, Sun, Sunset, Moon, Sparkles } from 'lucide-react';
import { currentSupplementBucket, BUCKET_LABELS, bucketSupplements, type SupplementLike } from '@/lib/engine/supplement-timing';

interface LatestMetrics {
  sleep_hours?: number | null;
  sleep_score?: number | null;
  hrv?: number | null;
  resting_hr?: number | null;
  steps?: number | null;
  stress_level?: number | null;
  energy?: number | null;
}

export interface DailyBriefingProps {
  name?: string | null;
  latestMetrics?: LatestMetrics | null;
  supplements?: SupplementLike[] | null;
  /** Optional pre-picked top-focus sentence ("Take Omega-3 with breakfast…"). */
  focusLine?: string | null;
  /** Optional quick callout when bio age improved recently. */
  deltaLine?: string | null;
}

function timeOfDayCopy(hour: number) {
  if (hour < 11) return { phase: 'morning' as const, icon: Sunrise, greeting: 'Good morning' };
  if (hour < 15) return { phase: 'midday' as const, icon: Sun, greeting: 'Good afternoon' };
  if (hour < 21) return { phase: 'evening' as const, icon: Sunset, greeting: 'Good evening' };
  return { phase: 'night' as const, icon: Moon, greeting: 'Late night' };
}

export function DailyBriefing({ name, latestMetrics, supplements, focusLine, deltaLine }: DailyBriefingProps) {
  const hour = useMemo(() => new Date().getHours(), []);
  const { phase, icon: Icon, greeting } = timeOfDayCopy(hour);
  const bucket = currentSupplementBucket(hour);
  const bucketMeta = BUCKET_LABELS[bucket];

  const grouped = useMemo(() => bucketSupplements(supplements), [supplements]);
  const activeSups = grouped[bucket] || [];

  // Morning gets sleep stats (answering "how was last night"); evening gets
  // one-line "wind down" prompt (answering "what do I need to do before bed").
  const sleepLabel =
    latestMetrics?.sleep_hours != null
      ? `${latestMetrics.sleep_hours.toFixed(1)}h${latestMetrics.sleep_score != null ? ` · score ${latestMetrics.sleep_score}` : ''}`
      : null;
  const hrvLabel = latestMetrics?.hrv != null ? `${Math.round(latestMetrics.hrv)} ms HRV` : null;
  const rhrLabel = latestMetrics?.resting_hr != null ? `${Math.round(latestMetrics.resting_hr)} bpm RHR` : null;

  const nightStats = [sleepLabel, hrvLabel, rhrLabel].filter(Boolean) as string[];

  return (
    <div className="rounded-3xl p-5 sm:p-6 relative overflow-hidden bg-gradient-to-br from-accent/[0.08] via-accent/[0.03] to-transparent border border-accent/25">
      <div className="flex items-start gap-4">
        <div className="w-11 h-11 rounded-2xl bg-accent/10 border border-accent/25 flex items-center justify-center shrink-0">
          <Icon className="w-5 h-5 text-accent" />
        </div>
        <div className="flex-1 min-w-0 space-y-2">
          <div>
            <p className="text-xs font-mono uppercase tracking-widest text-accent">{bucketMeta.title} brief</p>
            <h2 className="text-lg sm:text-xl font-semibold tracking-tight mt-0.5">
              {greeting}{name ? `, ${name}` : ''}.
            </h2>
          </div>

          {/* Morning: sleep + HRV snapshot. Other phases: skip this row. */}
          {phase === 'morning' && nightStats.length > 0 && (
            <p className="text-[13px] text-foreground/90 leading-relaxed">
              Last night: <span className="font-mono">{nightStats.join(' · ')}</span>.
            </p>
          )}

          {deltaLine && (
            <p className="text-[13px] text-accent leading-relaxed inline-flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 shrink-0" /> {deltaLine}
            </p>
          )}

          {/* Supplement-right-now line. Concise — the full list is below in
              the Supplements section; this is just the "N items for this
              window" nudge. */}
          {activeSups.length > 0 ? (
            <p className="text-[13px] text-foreground/90 leading-relaxed">
              <span className="font-medium">{bucketMeta.title} stack:</span>{' '}
              <span className="text-muted-foreground">{activeSups.slice(0, 4).map(s => s.name).filter(Boolean).join(' · ')}{activeSups.length > 4 && ` +${activeSups.length - 4}`}</span>
            </p>
          ) : (
            <p className="text-[13px] text-muted-foreground leading-relaxed">
              No supplements scheduled for this window.
            </p>
          )}

          {focusLine && (
            <p className="text-[12px] text-muted-foreground leading-relaxed italic pt-1 border-t border-accent/15 mt-2">
              ↳ {focusLine}
            </p>
          )}
        </div>
      </div>

      {/* Subtle bucket emoji on the right — no functional purpose, keeps the
          card from looking like a flat text block. Hidden on mobile for
          layout tightness. */}
      <span aria-hidden className={clsx('absolute right-5 top-5 text-3xl opacity-40 hidden sm:inline select-none', 'grayscale-0')}>
        {bucketMeta.emoji}
      </span>
    </div>
  );
}
