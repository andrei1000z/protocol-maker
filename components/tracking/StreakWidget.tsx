'use client';

// Streak + milestone progress widget. Renders the user's current streak
// alongside a progress bar toward the next milestone. Shows a celebration
// toast the first time a milestone is crossed — see markMilestoneCelebrated.
//
// Used on the tracking page. Keeps one source of truth by reading the
// already-computed streak from the page instead of re-running the calc.

import { useEffect, useState } from 'react';
import { Flame, Trophy } from 'lucide-react';
import {
  nextMilestone, milestoneFor, progressToNext,
  getUncelebratedMilestone, markMilestoneCelebrated,
} from '@/lib/utils/streak-milestones';

export interface StreakWidgetProps {
  streak: number;
  longestStreak: number;
  perfectDays: number;
  userId: string;
}

export function StreakWidget({ streak, longestStreak, perfectDays, userId }: StreakWidgetProps) {
  // Celebration toast — fires once per milestone per user per browser.
  // Keeps the ID so we only mark "celebrated" when the toast actually closes;
  // a closed-before-paint race would otherwise lose the marker.
  const [celebrating, setCelebrating] = useState<ReturnType<typeof getUncelebratedMilestone> | null>(null);

  useEffect(() => {
    const m = getUncelebratedMilestone(streak, userId);
    if (m) setCelebrating(m);
  }, [streak, userId]);

  const dismissCelebration = () => {
    if (celebrating) markMilestoneCelebrated(celebrating.days, userId);
    setCelebrating(null);
  };

  const current = milestoneFor(streak);
  const next = nextMilestone(streak);
  const pct = Math.round(progressToNext(streak) * 100);

  return (
    <>
      <div className="rounded-2xl bg-surface-2 border border-card-border p-5 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-accent/10 border border-accent/25 flex items-center justify-center">
              <Flame className="w-5 h-5 text-accent" />
            </div>
            <div>
              <p className="text-2xl font-bold font-mono tabular-nums leading-none">{streak}<span className="text-sm text-muted ml-1 font-normal">day{streak === 1 ? '' : 's'}</span></p>
              <p className="text-[10px] text-muted uppercase tracking-widest mt-1">Current streak</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-[10px] text-muted uppercase tracking-widest">Best</p>
            <p className="text-lg font-bold font-mono tabular-nums">{longestStreak}</p>
          </div>
        </div>

        {/* Progress bar toward next milestone. When user has passed the top
            of the ladder, render a static "365+" chip instead. */}
        {next ? (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-[11px] text-muted-foreground">
              <span>{current ? `${current.label} cleared` : 'Working toward first milestone'}</span>
              <span className="font-mono">{streak} / {next.days}</span>
            </div>
            <div className="h-1.5 rounded-full bg-surface-3 overflow-hidden">
              <div className="h-full bg-accent transition-all duration-500" style={{ width: `${pct}%` }} />
            </div>
            <p className="text-[10px] text-muted">
              <span className="text-accent font-medium">{next.days - streak}</span> days to <span className="text-foreground">{next.label}</span>
            </p>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-accent">
            <Trophy className="w-4 h-4" />
            <p className="text-xs font-semibold">You&apos;ve cleared every streak milestone. Remarkable.</p>
          </div>
        )}

        {perfectDays > 0 && (
          <div className="flex items-center justify-between pt-2 border-t border-card-border">
            <p className="text-[11px] text-muted-foreground">Perfect days (100% compliance)</p>
            <p className="text-sm font-mono font-semibold text-accent">{perfectDays}</p>
          </div>
        )}
      </div>

      {celebrating && (
        <div
          role="dialog"
          aria-labelledby="streak-celebration-title"
          className="fixed bottom-6 right-6 z-[55] max-w-sm animate-fade-in-up"
        >
          <div className="glass-card rounded-2xl p-5 border border-accent/40 bg-gradient-to-br from-accent/[0.08] to-transparent space-y-3 relative">
            <div className="flex items-start gap-3">
              <div className="w-11 h-11 rounded-2xl bg-accent/15 border border-accent/30 flex items-center justify-center shrink-0">
                <Trophy className="w-5 h-5 text-accent" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-mono uppercase tracking-widest text-accent">Milestone</p>
                <h3 id="streak-celebration-title" className="text-base font-semibold mt-0.5">{celebrating.label}</h3>
                <p className="text-[12px] text-muted-foreground mt-1 leading-relaxed">{celebrating.blurb}</p>
              </div>
            </div>
            <button
              onClick={dismissCelebration}
              className="w-full py-2 rounded-xl bg-accent text-black text-sm font-semibold hover:bg-accent-bright transition-colors"
            >
              Keep going
            </button>
          </div>
        </div>
      )}
    </>
  );
}
