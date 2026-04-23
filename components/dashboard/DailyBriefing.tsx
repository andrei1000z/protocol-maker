'use client';

// Top-of-dashboard status card. Keeps the copy human + time-aware:
//   - Morning: "how'd you sleep" + what's next on the stack
//   - Midday:  "keep going" + what to take with lunch
//   - Evening: "wind down" + bedtime stack
// No "briefing" or "runtime context" talk — this is the first thing the
// user reads every day; it should read like a friend, not a report.

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
  /** Optional short callout when a recent regen moved the numbers. */
  deltaLine?: string | null;
}

function timeOfDayCopy(hour: number) {
  if (hour < 11) return { phase: 'morning' as const, icon: Sunrise, hello: 'Morning' };
  if (hour < 15) return { phase: 'midday'  as const, icon: Sun,     hello: 'Afternoon' };
  if (hour < 21) return { phase: 'evening' as const, icon: Sunset,  hello: 'Evening' };
  return           { phase: 'night'   as const, icon: Moon,    hello: 'Late' };
}

// Short sleep-quality verdict drawn from sleep_hours + sleep_score. Replaces
// the raw number dump with a one-word judgment so users can skim the card.
function sleepVerdict(h?: number | null, score?: number | null): string | null {
  if (h == null) return null;
  const s = typeof score === 'number' ? score : null;
  if (h >= 7.5 && (s == null || s >= 75)) return 'solid';
  if (h >= 6.5 && (s == null || s >= 60)) return 'okay';
  return 'light';
}

export function DailyBriefing({ name, latestMetrics, supplements, deltaLine }: DailyBriefingProps) {
  const hour = useMemo(() => new Date().getHours(), []);
  const { phase, icon: Icon, hello } = timeOfDayCopy(hour);
  const bucket = currentSupplementBucket(hour);
  const bucketMeta = BUCKET_LABELS[bucket];

  const grouped = useMemo(() => bucketSupplements(supplements), [supplements]);
  const activeSups = grouped[bucket] || [];

  const hours = latestMetrics?.sleep_hours;
  const verdict = sleepVerdict(hours, latestMetrics?.sleep_score);

  return (
    <div className="rounded-3xl p-5 sm:p-6 relative overflow-hidden bg-gradient-to-br from-accent/[0.08] via-accent/[0.03] to-transparent border border-accent/25">
      <div className="flex items-start gap-4">
        <div className="w-11 h-11 rounded-2xl bg-accent/10 border border-accent/25 flex items-center justify-center shrink-0">
          <Icon className="w-5 h-5 text-accent" />
        </div>
        <div className="flex-1 min-w-0 space-y-2">
          <h2 className="text-lg sm:text-xl font-semibold tracking-tight">
            {hello}{name ? `, ${name.split(' ')[0]}` : ''}.
          </h2>

          {/* Morning: sleep one-liner. Other phases skip this and go straight
              to "what's next". Keeps the card short when there's nothing new. */}
          {phase === 'morning' && verdict && (
            <p className="text-[13px] text-foreground/90 leading-relaxed">
              {verdict === 'solid' && <>You slept <span className="text-accent font-medium">{hours!.toFixed(1)}h</span> — nice one.</>}
              {verdict === 'okay'  && <>You slept <span className="font-medium">{hours!.toFixed(1)}h</span>. Decent, not great.</>}
              {verdict === 'light' && <>You slept <span className="text-amber-400 font-medium">{hours!.toFixed(1)}h</span>. Try to catch up tonight.</>}
              {typeof latestMetrics?.resting_hr === 'number' && (
                <span className="text-muted-foreground"> Resting HR <span className="font-mono">{Math.round(latestMetrics.resting_hr)}</span>.</span>
              )}
            </p>
          )}

          {deltaLine && (
            <p className="text-[13px] text-accent leading-relaxed inline-flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 shrink-0" /> {deltaLine}
            </p>
          )}

          {/* Next action for the current window. Meant to answer "what now"
              without forcing them to scroll. */}
          {activeSups.length > 0 ? (
            <p className="text-[13px] text-foreground/90 leading-relaxed">
              Take with your {phase === 'morning' ? 'breakfast' : phase === 'midday' ? 'lunch' : phase === 'evening' ? 'dinner' : 'wind-down'}:{' '}
              <span className="text-muted-foreground">
                {activeSups.slice(0, 4).map(s => s.name).filter(Boolean).join(', ')}
                {activeSups.length > 4 && ` +${activeSups.length - 4} more`}
              </span>
            </p>
          ) : (
            <p className="text-[13px] text-muted-foreground leading-relaxed">
              Nothing on the stack right now — {phase === 'night' ? 'wind down and rest.' : 'keep hydrated.'}
            </p>
          )}
        </div>
      </div>

      {/* Bucket emoji floats on the right purely for personality — no
          functional purpose. Hidden on mobile to keep the card tight. */}
      <span aria-hidden className={clsx('absolute right-5 top-5 text-3xl opacity-40 hidden sm:inline select-none')}>
        {bucketMeta.emoji}
      </span>
    </div>
  );
}
