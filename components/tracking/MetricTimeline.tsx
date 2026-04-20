'use client';

// ─────────────────────────────────────────────────────────────────────────────
// MetricTimeline — a flat, time-gated list of every measurement for a date.
//
// UX rules:
//   - Each metric is a single row: name + unit + optional device badge
//   - Rows for the CURRENT time window are editable now (inline input + Log button)
//   - Rows for EARLIER windows are editable too (catch-up logging)
//   - Rows for FUTURE windows are grayed out with "available at HH:MM"
//   - When viewing a past date (forFullDay), ALL rows are editable (the day is over)
//   - Already-logged rows show the value with a ✓; tap to edit
//   - Rows a user's devices can't provide at all are hidden when deviceSources is set
//
// This replaces the modal SmartLogSheet as the primary logging surface. It's
// flatter, less gamey, and shows exactly what the user can do right now at a
// glance — the ask from the founder was "scoate tot, fa o lista simpla".
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useMemo, useCallback } from 'react';
import clsx from 'clsx';
import { Check, Pencil, Lock } from 'lucide-react';
import type { DailyMetrics } from '@/lib/hooks/useDailyMetrics';
import {
  BUCKET_GROUPS,
  getEligibleBuckets,
  type TimeBucket,
  type FieldSpec,
} from './SmartLogSheet';

// Duration fields are stored two different ways in DailyMetrics:
//   - as DECIMAL HOURS (sleep_hours, sleep_hours_planned) — float like 7.5
//   - as INTEGER MINUTES (deep_sleep_min, rem_sleep_min, awake_min,
//     active_time_min, workout_minutes, etc.) — int like 90
// Both are nicer to edit as two boxes (Hh + Mm) than as a single opaque
// "7.5" or "90" number. This returns how to interpret the stored value,
// or null if it's not a duration at all.
type DurationShape = 'hours-decimal' | 'minutes-int' | null;
function durationShape(key: string): DurationShape {
  if (key === 'sleep_hours' || key === 'sleep_hours_planned') return 'hours-decimal';
  if (key.endsWith('_min') || key === 'workout_minutes') return 'minutes-int';
  return null;
}
function durationToHM(value: number | null | undefined, shape: 'hours-decimal' | 'minutes-int'): { h: string; m: string } {
  if (value === null || value === undefined || !Number.isFinite(value)) return { h: '', m: '' };
  const totalMin = shape === 'hours-decimal' ? value * 60 : value;
  const h = Math.floor(totalMin / 60);
  const m = Math.round(totalMin - h * 60);
  return { h: String(h), m: String(m) };
}
function hmToStored(h: string, m: string, shape: 'hours-decimal' | 'minutes-int'): number | null {
  const hNum = h === '' ? 0 : parseInt(h, 10);
  const mNum = m === '' ? 0 : parseInt(m, 10);
  if (!Number.isFinite(hNum) || !Number.isFinite(mNum)) return null;
  if (h === '' && m === '') return null;
  const totalMin = hNum * 60 + mNum;
  if (totalMin === 0 && h === '' && m === '') return null;
  return shape === 'hours-decimal' ? Math.round(totalMin / 60 * 10) / 10 : totalMin;
}
// Format a stored duration for the LOGGED display row — "7h 32m" reads
// better than "7.5" or "452" alone.
function formatDurationForDisplay(value: number | null | undefined, shape: 'hours-decimal' | 'minutes-int'): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return String(value ?? '');
  const totalMin = shape === 'hours-decimal' ? value * 60 : value;
  const h = Math.floor(totalMin / 60);
  const m = Math.round(totalMin - h * 60);
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

// Window metadata in display order.
const WINDOWS: { key: TimeBucket; label: string; emoji: string; startHour: number; range: string }[] = [
  { key: 'morning', label: 'Morning', emoji: '🌅', startHour: 5,  range: '05:00–11:00' },
  { key: 'midday',  label: 'Midday',  emoji: '☀️', startHour: 11, range: '11:00–17:00' },
  { key: 'evening', label: 'Evening', emoji: '🌆', startHour: 17, range: '17:00–23:00' },
  { key: 'night',   label: 'Night',   emoji: '🌙', startHour: 23, range: '23:00–05:00' },
];

// Personalize the FASTED group title with the user's wake time.
// The FASTED window slot = wake + 10 min (time for bathroom).
function personalizeGroupTitle(title: string, wakeTime?: string): string {
  if (!title.startsWith('⚖️ FASTED') || !wakeTime) return title;
  const [h, m] = wakeTime.split(':').map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return title;
  const total = (h * 60 + m + 10 + 24 * 60) % (24 * 60);
  const slot = `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
  return `⚖️ FASTED — at ${slot} (wake + 10 min), before food or water`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Single metric row — input, logged value, or locked state
// ─────────────────────────────────────────────────────────────────────────────
function MetricRow({
  spec, value, deviceSource, isManual, locked, unlockAt, onSave,
}: {
  spec: FieldSpec;
  value: number | null | undefined;
  deviceSource?: string;   // "Oura Ring 4" or "manual" — omitted when no sources given
  isManual: boolean;
  locked: boolean;
  unlockAt?: string;       // "17:00" when locked
  onSave: (value: number | null) => Promise<void>;
}) {
  const isLogged = value !== null && value !== undefined;
  const shape = durationShape(String(spec.key));
  const isDuration = shape !== null;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<string>('');         // used for non-duration fields
  const [draftH, setDraftH] = useState<string>('');       // used for duration fields
  const [draftM, setDraftM] = useState<string>('');
  const [busy, setBusy] = useState(false);

  const commit = useCallback(async () => {
    let parsed: number | null = null;
    if (isDuration) {
      // Empty both = clear the field (null). Otherwise compose from h+m.
      if (draftH.trim() === '' && draftM.trim() === '') {
        parsed = null;
      } else {
        parsed = hmToStored(draftH, draftM, shape as 'hours-decimal' | 'minutes-int');
        if (parsed === null) return;
      }
    } else {
      // Empty string clears the field (supports unlogging). Otherwise parse
      // as number (int or float depending on the spec) and reject NaN.
      const trimmed = draft.trim();
      if (trimmed === '') {
        parsed = null;
      } else {
        parsed = spec.type === 'integer' ? parseInt(trimmed, 10) : parseFloat(trimmed);
        if (!Number.isFinite(parsed)) return;
      }
    }
    setBusy(true);
    try {
      await onSave(parsed);
      setEditing(false);
      setDraft('');
      setDraftH('');
      setDraftM('');
    } finally {
      setBusy(false);
    }
  }, [draft, draftH, draftM, isDuration, shape, spec.type, onSave]);

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') { e.preventDefault(); commit(); }
    else if (e.key === 'Escape') {
      setEditing(false);
      setDraft(''); setDraftH(''); setDraftM('');
    }
  };

  // ── LOCKED (future window on today's date) ──────────────────────────────
  if (locked && !isLogged) {
    return (
      <div className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl bg-surface-2/40 border border-card-border opacity-45">
        <Lock className="w-3.5 h-3.5 text-muted shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-[13px] text-muted-foreground truncate">{spec.label}</p>
        </div>
        <span className="text-[10px] font-mono text-muted shrink-0">
          {unlockAt ? `at ${unlockAt}` : 'later'}
        </span>
      </div>
    );
  }

  // ── LOGGED (value present, not editing) ─────────────────────────────────
  if (isLogged && !editing) {
    // Duration fields render as "7h 32m" instead of the raw 7.5 or 452 —
    // much more legible when you glance at the logged row.
    const displayValue = isDuration
      ? formatDurationForDisplay(value, shape as 'hours-decimal' | 'minutes-int')
      : String(value);
    return (
      <div className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl bg-accent/[0.04] border border-accent/20 group">
        <Check className="w-3.5 h-3.5 text-accent shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <p className="text-[13px] font-medium truncate">{spec.label}</p>
            {deviceSource && !isManual && (
              <span className="inline-flex text-[9px] px-1.5 py-0.5 rounded bg-accent/10 border border-accent/20 text-accent font-medium uppercase tracking-wider">
                ⌚ {deviceSource}
              </span>
            )}
          </div>
        </div>
        <span className="text-sm font-mono tabular-nums text-accent shrink-0">
          {displayValue}
          {spec.unit && !isDuration && <span className="text-[10px] text-muted ml-0.5">{spec.unit}</span>}
        </span>
        <button
          onClick={() => {
            setEditing(true);
            if (isDuration) {
              const hm = durationToHM(value, shape as 'hours-decimal' | 'minutes-int');
              setDraftH(hm.h); setDraftM(hm.m);
            } else {
              setDraft(String(value));
            }
          }}
          aria-label="Edit"
          className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-surface-3 text-muted-foreground hover:text-foreground transition-all"
        >
          <Pencil className="w-3 h-3" />
        </button>
      </div>
    );
  }

  // ── EDITABLE (due/overdue/past-day empty, OR logged+editing) ────────────
  const nothingEntered = isDuration
    ? draftH.trim() === '' && draftM.trim() === ''
    : draft.trim() === '';
  return (
    <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-surface-2 border border-card-border hover:border-accent/30 transition-colors">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <p className="text-[13px] font-medium truncate">{spec.label}</p>
          {deviceSource && !isManual && (
            <span className="inline-flex text-[9px] px-1.5 py-0.5 rounded bg-accent/10 border border-accent/20 text-accent font-medium uppercase tracking-wider">
              ⌚ {deviceSource}
            </span>
          )}
          {isManual && (
            <span className="inline-flex text-[9px] px-1.5 py-0.5 rounded bg-surface-3 text-muted uppercase tracking-wider">manual</span>
          )}
        </div>
        {spec.hint && <p className="text-[10px] text-muted mt-0.5 leading-snug">{spec.hint}</p>}
      </div>

      {/* Dual H+M inputs for duration fields; single input otherwise */}
      {isDuration ? (
        <div className="flex items-center gap-1 shrink-0">
          <div className="relative w-14">
            <input
              type="number"
              inputMode="numeric"
              autoFocus={editing}
              value={draftH}
              onChange={e => setDraftH(e.target.value)}
              onKeyDown={onKeyDown}
              onBlur={() => { if (!nothingEntered && !busy) commit(); }}
              placeholder="0"
              min={0}
              max={24}
              step={1}
              className="w-full rounded-lg bg-background border border-card-border px-2 py-1.5 text-sm font-mono tabular-nums outline-none focus:border-accent transition-colors text-right pr-5"
            />
            <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[9px] text-muted pointer-events-none font-mono">h</span>
          </div>
          <div className="relative w-14">
            <input
              type="number"
              inputMode="numeric"
              value={draftM}
              onChange={e => setDraftM(e.target.value)}
              onKeyDown={onKeyDown}
              onBlur={() => { if (!nothingEntered && !busy) commit(); }}
              placeholder="0"
              min={0}
              max={59}
              step={1}
              className="w-full rounded-lg bg-background border border-card-border px-2 py-1.5 text-sm font-mono tabular-nums outline-none focus:border-accent transition-colors text-right pr-6"
            />
            <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[9px] text-muted pointer-events-none font-mono">m</span>
          </div>
        </div>
      ) : (
        <div className="relative shrink-0 w-28">
          <input
            type="number"
            inputMode="decimal"
            autoFocus={editing}
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onKeyDown={onKeyDown}
            onBlur={() => { if (draft !== '' && !busy) commit(); }}
            placeholder={isLogged ? String(value) : '—'}
            step={spec.step || (spec.type === 'integer' ? 1 : 'any')}
            min={spec.min}
            max={spec.max}
            className="w-full rounded-lg bg-background border border-card-border px-2.5 py-1.5 text-sm font-mono tabular-nums outline-none focus:border-accent transition-colors text-right"
          />
          {spec.unit && (
            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[9px] text-muted pointer-events-none font-mono">{spec.unit}</span>
          )}
        </div>
      )}

      <button
        onClick={commit}
        disabled={busy || nothingEntered}
        className={clsx('shrink-0 text-[11px] font-semibold px-2.5 py-1.5 rounded-lg transition-all',
          busy ? 'bg-surface-3 text-muted' :
          nothingEntered ? 'bg-surface-3 text-muted cursor-not-allowed' :
          'bg-accent text-black hover:bg-accent-bright')}
      >
        {busy ? '…' : 'Log'}
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────
export function MetricTimeline({
  metrics, onSave, deviceSources, wakeTime, forFullDay = false,
}: {
  metrics: DailyMetrics;
  onSave: (updates: Partial<DailyMetrics>) => Promise<void> | void;
  deviceSources?: Record<string, string[]>;
  wakeTime?: string;
  // When logging for a past date, every window is reachable (no "future" concept).
  forFullDay?: boolean;
}) {
  const now = new Date();
  const nowHour = now.getHours();

  // Save a single field immediately (row-level "Log" button). Returns promise
  // so the row can show a spinner + disable during the roundtrip.
  const saveField = useCallback(async (key: keyof DailyMetrics, value: number | null) => {
    await onSave({ [key]: value } as Partial<DailyMetrics>);
  }, [onSave]);

  // Compute which windows are unlocked right now. Past date → all 4.
  const unlockedWindows = useMemo(() => {
    return forFullDay ? new Set<TimeBucket>(WINDOWS.map(w => w.key)) : new Set(getEligibleBuckets(nowHour));
  }, [forFullDay, nowHour]);

  // Build the visible groups per window, filtered by device capability.
  // A group becomes empty if none of its fields have a device/manual source;
  // those empty groups are dropped entirely.
  const sections = useMemo(() => {
    return WINDOWS.map(w => {
      const groups = BUCKET_GROUPS[w.key].map(g => ({
        title: personalizeGroupTitle(g.title, wakeTime),
        fields: g.fields.filter(f => {
          if (!deviceSources) return true;
          return (deviceSources[String(f.key)]?.length ?? 0) > 0;
        }),
      })).filter(g => g.fields.length > 0);
      const locked = !unlockedWindows.has(w.key);
      const totalFields = groups.reduce((s, g) => s + g.fields.length, 0);
      const loggedCount = groups.reduce((sum, g) => sum + g.fields.filter(f => {
        const v = metrics[f.key];
        return v !== null && v !== undefined && v !== '';
      }).length, 0);
      return { window: w, groups, locked, totalFields, loggedCount };
    }).filter(s => s.totalFields > 0);
  }, [deviceSources, wakeTime, unlockedWindows, metrics]);

  const totalLogged = sections.reduce((s, sec) => s + sec.loggedCount, 0);
  const totalFields = sections.reduce((s, sec) => s + sec.totalFields, 0);
  const completionPct = totalFields > 0 ? Math.round((totalLogged / totalFields) * 100) : 0;

  return (
    <div className="space-y-5">
      {/* Header strip — progress across the whole day at a glance */}
      <div className="flex items-center justify-between gap-4 px-1">
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-bold font-mono tabular-nums text-accent">{totalLogged}</span>
          <span className="text-sm text-muted-foreground">/ {totalFields} logged</span>
        </div>
        <div className="flex-1 h-1.5 rounded-full bg-surface-3 overflow-hidden mx-2">
          <div
            className="h-full bg-accent rounded-full transition-all duration-700"
            style={{ width: `${completionPct}%` }}
          />
        </div>
        <span className="text-xs font-mono tabular-nums text-muted-foreground">{completionPct}%</span>
      </div>

      {/* Time windows — one section per window, with rows inside */}
      <div className="space-y-4">
        {sections.map(section => {
          const { window: w, groups, locked, loggedCount, totalFields: winTotal } = section;
          const unlockAt = locked ? `${String(w.startHour).padStart(2, '0')}:00` : undefined;
          return (
            <div key={w.key} className={clsx('glass-card rounded-2xl p-4 space-y-3 transition-opacity',
              locked && 'opacity-60')}>
              {/* Window header */}
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-base">{w.emoji}</span>
                  <div>
                    <p className="text-sm font-semibold tracking-tight">{w.label}</p>
                    <p className="text-[10px] text-muted font-mono">{w.range}</p>
                  </div>
                </div>
                <div className="text-right">
                  {locked ? (
                    <span className="text-[10px] font-mono text-muted">available at {unlockAt}</span>
                  ) : (
                    <span className="text-xs font-mono tabular-nums text-muted-foreground">
                      <span className={loggedCount === winTotal ? 'text-accent font-semibold' : ''}>{loggedCount}</span>
                      /{winTotal}
                    </span>
                  )}
                </div>
              </div>

              {/* Groups within the window */}
              {groups.map(group => (
                <div key={group.title} className="space-y-1.5">
                  <p className="text-[10px] uppercase tracking-widest text-accent/80 font-mono px-0.5">{group.title}</p>
                  <div className="space-y-1">
                    {group.fields.map(spec => {
                      const value = metrics[spec.key] as number | null | undefined;
                      const sources = deviceSources?.[String(spec.key)] || [];
                      const nonManualSource = sources.find(s => s !== 'manual');
                      const isManualOnly = sources.length > 0 && !nonManualSource;
                      return (
                        <MetricRow
                          key={String(spec.key)}
                          spec={spec}
                          value={value}
                          deviceSource={nonManualSource}
                          isManual={isManualOnly}
                          locked={locked}
                          unlockAt={unlockAt}
                          onSave={(v) => saveField(spec.key, v)}
                        />
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          );
        })}
      </div>

      {sections.length === 0 && (
        <div className="glass-card rounded-2xl p-8 text-center space-y-2">
          <p className="text-sm font-medium">Nothing to log yet</p>
          <p className="text-[11px] text-muted-foreground max-w-sm mx-auto">
            Add a smartwatch / smart ring / home device in onboarding to unlock trackable metrics.
          </p>
        </div>
      )}
    </div>
  );
}
