'use client';

// Full-screen "Upgrading your protocol" progress modal. The actual network
// call to /api/generate-protocol can take 10-20s; a plain spinner feels like
// the app is frozen. Instead we animate through 7 named stages so the user
// sees concrete work happening, which matches the real pipeline:
//
//   1. Reading your profile        (< 1s — Supabase reads in parallel)
//   2. Classifying biomarkers      (instant — pure engine)
//   3. Scanning last 30 days       (< 1s — daily_metrics read)
//   4. Detecting clinical patterns (instant)
//   5. Upgrading the AI            (~8-15s — Claude / Groq call)
//   6. Computing organ systems     (instant — post-AI blend)
//   7. Finalizing your dashboard   (< 1s — DB insert + redirect)
//
// Stages advance on timers because we can't introspect real progress from a
// streaming response. Stage 5 gets the longest dwell so users aren't surprised
// when they sit on "Upgrading AI" for 10s. The modal auto-closes when
// `done === true` is passed from the parent (tracks the fetch promise).

import { useEffect, useState } from 'react';
import { Check, Sparkles } from 'lucide-react';
import clsx from 'clsx';

export interface UpgradeStage {
  id: string;
  label: string;
  /** Upper bound on time we'll dwell on this stage before auto-advancing. */
  maxMs: number;
}

const DEFAULT_STAGES: UpgradeStage[] = [
  { id: 'profile',    label: 'Reading your profile',              maxMs: 1200 },
  { id: 'biomarkers', label: 'Classifying biomarkers',            maxMs: 1400 },
  { id: 'metrics',    label: 'Scanning last 30 days of tracking', maxMs: 1800 },
  { id: 'patterns',   label: 'Detecting clinical patterns',       maxMs: 1400 },
  { id: 'ai',         label: 'Upgrading the AI protocol generator', maxMs: 10_000 },
  { id: 'organs',     label: 'Computing organ system scores',     maxMs: 1500 },
  { id: 'finalize',   label: 'Finalizing your dashboard',         maxMs: 1200 },
];

export interface UpgradeProgressProps {
  /** Show / hide the modal. */
  open: boolean;
  /** Called when the server work is complete — lets the modal hop to the
   *  final stage + auto-close after a short celebration frame. */
  done?: boolean;
  /** Override the stage list (used in tests). */
  stages?: UpgradeStage[];
  /** Fires when the modal finishes animating its close sequence. */
  onClose?: () => void;
}

export function UpgradeProgress({ open, done, stages = DEFAULT_STAGES, onClose }: UpgradeProgressProps) {
  const [stageIdx, setStageIdx] = useState(0);
  const [celebrate, setCelebrate] = useState(false);

  // Reset on each open so re-runs start clean.
  useEffect(() => {
    if (!open) { setStageIdx(0); setCelebrate(false); return; }
    setStageIdx(0);
    setCelebrate(false);
  }, [open]);

  // Auto-advance through stages until we hit the last one. The AI stage
  // specifically waits for `done` so we don't prematurely mark it complete.
  useEffect(() => {
    if (!open || celebrate) return;
    const stage = stages[stageIdx];
    if (!stage) return;

    // "ai" stage (index 4 by default) is the long-running one. If the server
    // hasn't reported done yet, keep pulsing on this stage until it does —
    // never bounce past it on the timer alone.
    const isLongRunning = stage.id === 'ai';
    if (isLongRunning && !done) {
      // Soft timeout: after maxMs we flash a warning dot but stay on the
      // stage (server's still working; user just knows it's taking longer).
      return;
    }

    const timer = setTimeout(() => {
      if (stageIdx < stages.length - 1) {
        setStageIdx(i => i + 1);
      } else {
        // Last stage complete — show the success frame for 700ms then close.
        setCelebrate(true);
        setTimeout(() => onClose?.(), 700);
      }
    }, stage.maxMs);
    return () => clearTimeout(timer);
  }, [open, stageIdx, stages, done, celebrate, onClose]);

  // When done=true flips while we're still on stage 4, jump to stage 5.
  useEffect(() => {
    if (!open || !done) return;
    const aiIdx = stages.findIndex(s => s.id === 'ai');
    if (aiIdx < 0) return;
    if (stageIdx <= aiIdx) setStageIdx(aiIdx + 1);
  }, [done, open, stageIdx, stages]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="upgrade-progress-title"
      className="fixed inset-0 z-50 flex items-center justify-center animate-fade-in"
    >
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
      <div className="relative w-full max-w-md mx-4 glass-card rounded-3xl p-6 sm:p-8 space-y-6 animate-fade-in-up">
        <div className="flex items-start gap-3">
          <div className={clsx('w-12 h-12 rounded-2xl border flex items-center justify-center shrink-0 transition-colors',
            celebrate ? 'bg-accent/15 border-accent/40' : 'bg-accent/10 border-accent/25')}>
            {celebrate
              ? <Check className="w-6 h-6 text-accent" />
              : <Sparkles className="w-6 h-6 text-accent animate-pulse" />}
          </div>
          <div className="flex-1 min-w-0">
            <h2 id="upgrade-progress-title" className="text-lg font-semibold tracking-tight">
              {celebrate ? 'Protocol upgraded' : 'Upgrading your protocol'}
            </h2>
            <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
              {celebrate
                ? 'Refreshing your dashboard…'
                : 'This takes ~15 seconds. Your new scores, organ systems, and daily schedule are being recomputed.'}
            </p>
          </div>
        </div>

        {/* Stage checklist — each stage shows as pending / in-progress / done */}
        <ol className="space-y-2">
          {stages.map((stage, i) => {
            const status: 'done' | 'active' | 'pending' =
              celebrate || i < stageIdx ? 'done' :
              i === stageIdx ? 'active' :
              'pending';
            return (
              <li key={stage.id} className="flex items-center gap-3">
                <div className={clsx('w-5 h-5 rounded-full border flex items-center justify-center shrink-0 transition-all',
                  status === 'done'    ? 'bg-accent border-accent'
                  : status === 'active' ? 'bg-accent/15 border-accent/60'
                  :                       'bg-surface-3 border-card-border')}>
                  {status === 'done' && <Check className="w-3 h-3 text-black" strokeWidth={3} />}
                  {status === 'active' && <div className="w-2 h-2 rounded-full bg-accent animate-pulse" />}
                </div>
                <span className={clsx('text-sm leading-tight transition-colors',
                  status === 'done'    ? 'text-foreground line-through decoration-accent/50 decoration-1'
                  : status === 'active' ? 'text-accent font-medium'
                  :                       'text-muted-foreground')}>
                  {stage.label}
                  {status === 'active' && <span className="ml-1 inline-block">
                    <span className="inline-block animate-[bounce_1s_infinite] [animation-delay:0ms]">.</span>
                    <span className="inline-block animate-[bounce_1s_infinite] [animation-delay:150ms]">.</span>
                    <span className="inline-block animate-[bounce_1s_infinite] [animation-delay:300ms]">.</span>
                  </span>}
                </span>
              </li>
            );
          })}
        </ol>

        <div className="pt-1">
          <div className="h-1 rounded-full bg-surface-3 overflow-hidden">
            <div
              className="h-full bg-accent transition-all duration-500"
              style={{ width: `${Math.min(100, ((celebrate ? stages.length : stageIdx + 1) / stages.length) * 100)}%` }}
            />
          </div>
          <p className="text-xs text-muted mt-2 font-mono text-center">
            Step {Math.min(stageIdx + 1, stages.length)} of {stages.length}
          </p>
        </div>
      </div>
    </div>
  );
}
