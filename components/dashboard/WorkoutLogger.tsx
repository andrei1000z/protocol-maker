'use client';

// One-tap workout logger backed by lib/engine/workouts.ts presets.
//
// Renders 3-6 suggested presets based on the user's protocol (strength/
// cardio targets + gym vs home). Tap a preset → the duration + intensity
// land on today's daily_metrics row. Custom-time fallback for sessions
// that don't match a preset.

import { useEffect, useMemo, useState } from 'react';
import clsx from 'clsx';
import { Dumbbell, X, Check, Zap } from 'lucide-react';
import { useMyData, invalidate } from '@/lib/hooks/useApiData';
import { useDailyMetrics } from '@/lib/hooks/useDailyMetrics';
import { suggestWorkouts, intensityRpe, type WorkoutPreset } from '@/lib/engine/workouts';

export function WorkoutLogger() {
  const [open, setOpen] = useState(false);
  const todayIso = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const { data: myData } = useMyData();
  const { metrics: today, save } = useDailyMetrics(todayIso);

  // Recompute suggestions when the protocol changes (e.g., after a regen).
  // Reads strength/cardio targets to bias the picker.
  const suggestions = useMemo<WorkoutPreset[]>(() => {
    const ex = (myData?.protocol?.protocol_json as { exercise?: { strengthSessionsPerWeek?: number; cardioMinutesPerWeek?: number } })?.exercise;
    const od = (myData?.profile?.onboarding_data ?? {}) as Record<string, unknown>;
    const hasGym = od.gymAccess === 'full_gym' || od.gymAccess === 'home_gym';
    return suggestWorkouts({
      strengthSessionsPerWeek: ex?.strengthSessionsPerWeek,
      cardioMinutesPerWeek:    ex?.cardioMinutesPerWeek,
      hasGym,
    });
  }, [myData?.protocol?.protocol_json, myData?.profile?.onboarding_data]);

  const handleLog = async (preset: WorkoutPreset) => {
    await save({
      workout_done: true,
      workout_minutes: preset.durationMin,
      workout_intensity: preset.intensity,
    });
    invalidate.statistics();
    invalidate.liveScores();
    setOpen(false);
  };

  return (
    <section className="rounded-3xl bg-surface-1 border border-card-border p-5 sm:p-6 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="w-11 h-11 rounded-2xl bg-accent/10 border border-accent/25 flex items-center justify-center shrink-0">
            <Dumbbell className="w-5 h-5 text-accent" />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-semibold tracking-tight">Training</h2>
            <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
              {today?.workout_done
                ? `Done today: ${today.workout_minutes ?? '?'} min · ${today.workout_intensity ?? '?'}.`
                : "Tap to log what you did today — one click logs the whole session."}
            </p>
          </div>
        </div>
        <button
          onClick={() => setOpen(true)}
          className="shrink-0 inline-flex items-center gap-1.5 text-xs sm:text-sm font-semibold px-3.5 py-2 rounded-xl bg-accent text-black hover:bg-accent-bright transition-colors"
        >
          <Zap className="w-4 h-4" />
          {today?.workout_done ? 'Log another' : 'I trained today'}
        </button>
      </div>

      {open && (
        <WorkoutModal
          presets={suggestions}
          existing={today?.workout_done ? { minutes: today.workout_minutes, intensity: today.workout_intensity } : null}
          onClose={() => setOpen(false)}
          onPickPreset={handleLog}
          onCustom={async (minutes, intensity) => {
            await save({ workout_done: true, workout_minutes: minutes, workout_intensity: intensity });
            invalidate.statistics();
            invalidate.liveScores();
            setOpen(false);
          }}
        />
      )}
    </section>
  );
}

interface ModalProps {
  presets: WorkoutPreset[];
  existing: { minutes: number | null | undefined; intensity: string | null | undefined } | null;
  onClose: () => void;
  onPickPreset: (preset: WorkoutPreset) => Promise<void>;
  onCustom: (minutes: number, intensity: WorkoutPreset['intensity']) => Promise<void>;
}

function WorkoutModal({ presets, existing, onClose, onPickPreset, onCustom }: ModalProps) {
  const [customOpen, setCustomOpen] = useState(false);
  const [customMin, setCustomMin] = useState<number>(45);
  const [customIntensity, setCustomIntensity] = useState<WorkoutPreset['intensity']>('moderate');
  const [saving, setSaving] = useState<string | null>(null);

  // Esc closes — register only while open. Saves a global listener.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-end sm:items-center justify-center animate-fade-in">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-surface-1 rounded-t-3xl sm:rounded-3xl w-full sm:max-w-lg max-h-[88dvh] overflow-y-auto border border-card-border animate-fade-in-up">
        <div className="sticky top-0 bg-surface-1/95 backdrop-blur-lg border-b border-card-border p-5 flex items-center justify-between">
          <div>
            <p className="text-[10px] font-mono uppercase tracking-widest text-accent">Pick one</p>
            <h2 className="text-lg font-semibold mt-0.5">Log your workout</h2>
          </div>
          <button onClick={onClose} aria-label="Close" className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-surface-2 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-3">
          {existing && (
            <p className="text-[11px] text-amber-400 bg-amber-500/5 border border-amber-500/25 rounded-lg p-2">
              Already logged today: {existing.minutes ?? '?'} min · {existing.intensity ?? '?'}. Logging again replaces it.
            </p>
          )}

          <div className="space-y-2">
            {presets.map(p => (
              <button
                key={p.id}
                onClick={async () => { setSaving(p.id); await onPickPreset(p); setSaving(null); }}
                disabled={saving !== null}
                className="w-full text-left p-3.5 rounded-xl bg-surface-2 border border-card-border hover:border-accent/40 hover:bg-accent/[0.04] disabled:opacity-50 transition-colors"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold">{p.title}</p>
                      <span className="text-[9px] font-mono uppercase tracking-widest px-1.5 py-0.5 rounded-full bg-surface-3 border border-card-border text-muted">
                        {p.durationMin}m
                      </span>
                    </div>
                    <p className="text-[11px] text-muted-foreground leading-relaxed mt-0.5">{p.description}</p>
                    <p className="text-[10px] text-muted font-mono mt-1">{intensityRpe(p.intensity)}</p>
                  </div>
                  {saving === p.id ? (
                    <span className="w-4 h-4 border-2 border-accent/40 border-t-accent rounded-full animate-spin shrink-0" />
                  ) : (
                    <Check className="w-4 h-4 text-muted-foreground shrink-0" />
                  )}
                </div>
              </button>
            ))}
          </div>

          {/* Custom — fallback for sessions that don't match a preset */}
          <button
            onClick={() => setCustomOpen(o => !o)}
            className="w-full text-left p-3 rounded-xl bg-surface-2 border border-dashed border-card-border hover:border-card-border-hover transition-colors text-xs text-muted-foreground"
          >
            {customOpen ? '↑ Hide custom' : '↓ Custom session'}
          </button>
          {customOpen && (
            <div className="p-4 rounded-xl bg-surface-2 border border-card-border space-y-3">
              <div>
                <p className="text-[10px] font-mono uppercase tracking-widest text-muted mb-1.5">Duration · {customMin} min</p>
                <input
                  type="range" min={5} max={180} step={5}
                  value={customMin}
                  onChange={e => setCustomMin(Number(e.target.value))}
                  className="w-full"
                />
              </div>
              <div>
                <p className="text-[10px] font-mono uppercase tracking-widest text-muted mb-1.5">Intensity</p>
                <div className="grid grid-cols-4 gap-1">
                  {(['light', 'moderate', 'hard', 'max'] as const).map(i => (
                    <button
                      key={i}
                      onClick={() => setCustomIntensity(i)}
                      className={clsx('py-1.5 rounded-lg text-[11px] font-medium border transition-colors',
                        customIntensity === i
                          ? 'bg-accent/10 text-accent border-accent/30'
                          : 'bg-surface-3 text-muted-foreground border-card-border hover:text-foreground')}
                    >
                      {i}
                    </button>
                  ))}
                </div>
              </div>
              <button
                onClick={async () => { await onCustom(customMin, customIntensity); }}
                className="w-full py-2.5 rounded-xl bg-accent text-black font-semibold text-sm hover:bg-accent-bright transition-colors"
              >
                Log {customMin}m {customIntensity}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
