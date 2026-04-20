'use client';

import { useState, useMemo } from 'react';
import clsx from 'clsx';
import { X, Check, Clock, AlertCircle, Zap } from 'lucide-react';
import type { DailyMetrics } from '@/lib/hooks/useDailyMetrics';

// ============================================================================
// Time-aware field groups — user sees only metrics relevant for RIGHT NOW,
// or (in 'recap' mode) everything from wake through now that isn't yet logged.
// ============================================================================
export type TimeBucket = 'morning' | 'midday' | 'evening' | 'night';

// Chronological order used by the recap mode. Night wraps to the next day,
// but for single-day logging we treat it as the last slot before the user
// goes to bed (not the early-AM hours).
const BUCKET_ORDER: TimeBucket[] = ['morning', 'midday', 'evening', 'night'];

function getTimeBucket(hour: number): TimeBucket {
  if (hour >= 5 && hour < 11) return 'morning';    // 05:00–10:59
  if (hour >= 11 && hour < 17) return 'midday';    // 11:00–16:59
  if (hour >= 17 && hour < 23) return 'evening';   // 17:00–22:59
  return 'night';                                   // 23:00–04:59
}

// Which buckets are "in scope" at the current time for catch-up logging.
// Rule: if user opens at 14:32, we show morning + midday (everything they
// should have measured by now), and SKIP evening + night (future).
export function getEligibleBuckets(hour: number): TimeBucket[] {
  const current = getTimeBucket(hour);
  // Night bucket edge case: 23:00–04:59. If it's 02:00, we want to treat
  // the whole previous day as eligible (morning + midday + evening + night).
  if (current === 'night') return BUCKET_ORDER;
  const idx = BUCKET_ORDER.indexOf(current);
  return BUCKET_ORDER.slice(0, idx + 1);
}

export interface FieldSpec {
  key: keyof DailyMetrics;
  label: string;
  hint?: string;
  unit?: string;
  min?: number;
  max?: number;
  step?: number;
  type?: 'number' | 'integer';
}

export type GroupDef = { title: string; fields: FieldSpec[] };

// Fields shown for each time bucket. Morning is the biggest since wearables
// finalize their overnight analysis then. The FASTED group is intentionally
// first — these measurements are lowest-noise when done BEFORE food/water.
export const BUCKET_GROUPS: Record<TimeBucket, GroupDef[]> = {
  morning: [
    { title: '⚖️ FASTED — do NOW, before food or water', fields: [
      { key: 'weight_kg', label: 'Weight', unit: 'kg', min: 20, max: 400, step: 0.1, hint: 'Post-bathroom, no clothes' },
      { key: 'body_fat_pct', label: 'Body fat', unit: '%', min: 3, max: 60, step: 0.1, hint: 'Smart scale — fasted = most accurate' },
      { key: 'muscle_mass_kg', label: 'Muscle mass', unit: 'kg', min: 10, max: 100, step: 0.1 },
      { key: 'visceral_fat', label: 'Visceral fat', unit: '', min: 1, max: 60, type: 'integer', hint: 'Tanita rating 1-60' },
      { key: 'body_water_pct', label: 'Body water', unit: '%', min: 20, max: 80, step: 0.1 },
      { key: 'bone_mass_kg', label: 'Bone mass', unit: 'kg', min: 1, max: 10, step: 0.1 },
      { key: 'bmr_kcal', label: 'BMR (estimate)', unit: 'kcal', min: 800, max: 3500, type: 'integer' },
      { key: 'basal_body_temp_c', label: 'Basal body temp', unit: '°C', min: 34, max: 39, step: 0.01, hint: 'Oral/forehead — cleanest metabolic signal' },
      { key: 'antioxidant_index', label: 'Antioxidants (Veggie Meter)', unit: '/100', min: 0, max: 100, type: 'integer', hint: 'Skin carotenoids — before coffee' },
      { key: 'resting_hr', label: 'Resting HR', unit: 'bpm', min: 20, max: 220, type: 'integer', hint: 'Right after waking, before standing' },
      { key: 'bp_systolic_morning', label: 'BP systolic', unit: 'mmHg', min: 60, max: 250, type: 'integer' },
      { key: 'bp_diastolic_morning', label: 'BP diastolic', unit: 'mmHg', min: 30, max: 160, type: 'integer' },
    ]},
    { title: '😴 Last night — duration', fields: [
      { key: 'sleep_hours_planned', label: 'Hours planned', unit: 'h', min: 0, max: 15, step: 0.5 },
      { key: 'sleep_hours', label: 'Hours slept (real)', unit: 'h', min: 0, max: 15, step: 0.1 },
      { key: 'sleep_score', label: 'Sleep score', unit: '/100', min: 0, max: 100, type: 'integer', hint: 'From your watch/ring' },
      { key: 'sleep_quality', label: 'Subjective quality', unit: '/10', min: 1, max: 10, type: 'integer' },
    ]},
    { title: '🌙 Sleep stages (min)', fields: [
      { key: 'deep_sleep_min', label: 'Deep sleep', unit: 'min', min: 0, max: 600, type: 'integer' },
      { key: 'light_sleep_min', label: 'Light sleep', unit: 'min', min: 0, max: 600, type: 'integer' },
      { key: 'rem_sleep_min', label: 'REM', unit: 'min', min: 0, max: 600, type: 'integer' },
      { key: 'awake_min', label: 'Awake', unit: 'min', min: 0, max: 600, type: 'integer' },
    ]},
    { title: '❤️ Overnight vitals', fields: [
      { key: 'hrv_sleep_avg', label: 'HRV during sleep', unit: 'ms', min: 0, max: 250, type: 'integer' },
      { key: 'blood_oxygen_avg_sleep', label: 'Blood O₂ avg', unit: '%', min: 70, max: 100, step: 0.1 },
      { key: 'avg_respiratory_rate', label: 'Avg respiratory rate', unit: '/min', min: 5, max: 30, step: 0.1 },
      { key: 'skin_temp_deviation', label: 'Skin temp deviation', unit: '°C', min: -3, max: 3, step: 0.1, hint: 'Range: −0.5 to +0.5 normal. Above +0.5 = possible cycle / fever / overtraining. Below −0.5 = cold exposure / deep recovery.' },
    ]},
    { title: '🔋 How you feel', fields: [
      { key: 'energy_score', label: 'Energy score (watch)', unit: '/100', min: 0, max: 100, type: 'integer' },
      { key: 'energy', label: 'Energy (subjective)', unit: '/10', min: 1, max: 10, type: 'integer' },
      { key: 'mood', label: 'Mood', unit: '/10', min: 1, max: 10, type: 'integer' },
    ]},
  ],
  midday: [
    { title: '🏃 Activity so far', fields: [
      { key: 'steps', label: 'Steps', min: 0, max: 100000, type: 'integer' },
      { key: 'active_time_min', label: 'Active time', unit: 'min', min: 0, max: 1440, type: 'integer' },
      { key: 'activity_calories', label: 'Activity calories', unit: 'kcal', min: 0, max: 5000, type: 'integer' },
    ]},
    { title: '❤️ Heart rate today', fields: [
      { key: 'min_heart_rate', label: 'Min HR today', unit: 'bpm', min: 20, max: 220, type: 'integer' },
      { key: 'max_heart_rate', label: 'Max HR today', unit: 'bpm', min: 20, max: 300, type: 'integer' },
      { key: 'avg_heart_rate', label: 'Avg HR today', unit: 'bpm', min: 20, max: 220, type: 'integer' },
      { key: 'hrv', label: 'Daytime HRV', unit: 'ms', min: 0, max: 250, type: 'integer' },
    ]},
    { title: '🧠 State', fields: [
      { key: 'stress_level', label: 'Stress right now', unit: '/10', min: 1, max: 10, type: 'integer' },
      { key: 'energy', label: 'Energy right now', unit: '/10', min: 1, max: 10, type: 'integer' },
      { key: 'mood', label: 'Mood right now', unit: '/10', min: 1, max: 10, type: 'integer' },
    ]},
  ],
  evening: [
    { title: '🏃 Full-day activity', fields: [
      { key: 'steps', label: 'Total steps', min: 0, max: 100000, type: 'integer' },
      { key: 'active_time_min', label: 'Active time', unit: 'min', min: 0, max: 1440, type: 'integer' },
      { key: 'activity_calories', label: 'Activity calories', unit: 'kcal', min: 0, max: 5000, type: 'integer' },
      { key: 'workout_minutes', label: 'Workout duration', unit: 'min', min: 0, max: 500, type: 'integer' },
    ]},
    { title: '❤️ Full-day vitals', fields: [
      { key: 'min_heart_rate', label: 'Min HR today', unit: 'bpm', min: 20, max: 220, type: 'integer' },
      { key: 'max_heart_rate', label: 'Max HR today', unit: 'bpm', min: 20, max: 300, type: 'integer' },
      { key: 'avg_heart_rate', label: 'Avg HR today', unit: 'bpm', min: 20, max: 220, type: 'integer' },
    ]},
    { title: '🩺 Evening BP', fields: [
      { key: 'bp_systolic_evening', label: 'BP systolic', unit: 'mmHg', min: 60, max: 250, type: 'integer' },
      { key: 'bp_diastolic_evening', label: 'BP diastolic', unit: 'mmHg', min: 30, max: 160, type: 'integer' },
    ]},
    { title: '🥬 Watch-computed indices', fields: [
      { key: 'antioxidant_index', label: 'Antioxidant index', unit: '/100', min: 0, max: 100, type: 'integer', hint: 'Galaxy Watch skin carotenoid' },
      { key: 'ages_index', label: 'AGEs index', unit: '', min: 0, max: 5, step: 0.01, hint: 'Advanced Glycation End products' },
    ]},
    { title: '🧠 End-of-day', fields: [
      { key: 'stress_level', label: 'Stress (avg day)', unit: '/10', min: 1, max: 10, type: 'integer' },
      { key: 'energy', label: 'Energy end-of-day', unit: '/10', min: 1, max: 10, type: 'integer' },
      { key: 'mood', label: 'Overall mood', unit: '/10', min: 1, max: 10, type: 'integer' },
    ]},
  ],
  night: [
    { title: '🌙 Wind-down', fields: [
      { key: 'sleep_hours_planned', label: 'Hours planned tonight', unit: 'h', min: 0, max: 15, step: 0.5 },
      { key: 'stress_level', label: 'Stress before bed', unit: '/10', min: 1, max: 10, type: 'integer' },
      { key: 'mood', label: 'Mood before bed', unit: '/10', min: 1, max: 10, type: 'integer' },
    ]},
    { title: '📊 Day recap', fields: [
      { key: 'steps', label: 'Total steps', min: 0, max: 100000, type: 'integer' },
      { key: 'max_heart_rate', label: 'Max HR today', unit: 'bpm', min: 20, max: 300, type: 'integer' },
    ]},
  ],
};

const BUCKET_LABELS: Record<TimeBucket, { title: string; subtitle: string; emoji: string }> = {
  morning: { emoji: '🌅', title: 'Good morning', subtitle: "Your overnight numbers are in — log what your wearable reported plus how you feel." },
  midday:  { emoji: '☀️', title: 'Midday check-in', subtitle: "What's happened since you woke up — activity, HR ranges, and current state." },
  evening: { emoji: '🌆', title: 'Evening recap', subtitle: 'Close the day — full totals, evening BP, watch indices.' },
  night:   { emoji: '🌙', title: 'Before bed', subtitle: 'Quick recap before the next cycle starts.' },
};

// ─────────────────────────────────────────────────────────────────────────────
// Utility — how many fields in a group are still blank for the current day?
// Used by both the count badges in the tracking header and the group-level
// "X pending" chip inside the sheet itself.
// ─────────────────────────────────────────────────────────────────────────────
function countPending(group: GroupDef, metrics: DailyMetrics, local: Partial<DailyMetrics>, deviceSources?: Record<string, string[]>): number {
  return group.fields.filter(f => {
    if (deviceSources && !(deviceSources[String(f.key)]?.length)) return false;
    const localVal = local[f.key];
    if (localVal !== null && localVal !== undefined && localVal !== '') return false;
    const v = metrics[f.key];
    return v === null || v === undefined || v === '';
  }).length;
}

// Count pending fields across all groups in a bucket — for the tracking header
// badge ("7 unlogged items from morning + midday"). Exported so the page can
// compute the summary without re-instantiating the sheet.
export function countBucketPending(bucket: TimeBucket, metrics: DailyMetrics, deviceSources?: Record<string, string[]>): number {
  return BUCKET_GROUPS[bucket].reduce((sum, g) => sum + countPending(g, metrics, {}, deviceSources), 0);
}

export function countAllPendingUpToNow(hour: number, metrics: DailyMetrics, deviceSources?: Record<string, string[]>): number {
  return getEligibleBuckets(hour).reduce((sum, b) => sum + countBucketPending(b, metrics, deviceSources), 0);
}

interface Props {
  open: boolean;
  onClose: () => void;
  metrics: DailyMetrics;
  onSave: (updates: Partial<DailyMetrics>) => Promise<void> | void;
  // Device source map — when present, fields with no source (device or manual) are hidden.
  deviceSources?: Record<string, string[]>;
  // 'current'  → show only the current time bucket (quick one-liner check-in).
  // 'recap'    → show every bucket from wake through current time, hiding
  //              groups where every field is already filled. "Catch up" UX.
  mode?: 'current' | 'recap';
  // When true, show EVERY bucket (morning + midday + evening + night) regardless
  // of the current clock. Used when logging for a past date — the day is over,
  // so there's no "future windows" concept. Overrides mode.
  forFullDay?: boolean;
  // User's ideal wake time (HH:MM) from onboarding. When set, the FASTED group
  // title reads "at 06:10 (your wake + 10 min)" instead of a generic "NOW".
  // Makes the most important group feel personalized instead of one-size-fits.
  wakeTime?: string;
  // For the header subtitle — e.g. "yesterday (Apr 18)" when forFullDay is true.
  dateLabel?: string;
}

// Adds 10 minutes to a HH:MM string. Returns the fasted-measurement slot.
// Handles wrap-around at midnight, not that it should ever matter here.
function addMinutesToHHMM(hhmm: string, minutes: number): string {
  const [h, m] = hhmm.split(':').map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return hhmm;
  const total = (h * 60 + m + minutes + 24 * 60) % (24 * 60);
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

export function SmartLogSheet({ open, onClose, metrics, onSave, deviceSources, mode = 'current', forFullDay = false, wakeTime, dateLabel }: Props) {
  const now = new Date();
  const currentBucket = useMemo(() => getTimeBucket(now.getHours()), [now]);
  const eligibleBuckets = useMemo(() => {
    if (forFullDay) return BUCKET_ORDER;           // past date — show everything
    if (mode === 'recap') return getEligibleBuckets(now.getHours());
    return [currentBucket];
  }, [forFullDay, mode, now, currentBucket]);

  // Local editing buffer — only commit on save
  const [local, setLocal] = useState<Partial<DailyMetrics>>({});
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  // Personalized FASTED slot — wake time + 10 min by default. If the user hasn't
  // filled a wake time yet, fall back to the generic "do NOW" hint.
  const fastedSlot = wakeTime ? addMinutesToHHMM(wakeTime, 10) : null;

  // Build the flattened list of buckets + their (capability-filtered) groups.
  // In recap mode we ALSO drop groups where every field is already filled —
  // this is the "catch up" flow; fields already logged shouldn't be noise.
  const bucketSections = useMemo(() => {
    return eligibleBuckets.map(b => {
      const rawGroups = BUCKET_GROUPS[b];
      const filteredGroups: GroupDef[] = rawGroups.map(g => {
        // Personalize the FASTED group title with the user's wake time when we have it.
        // The group has a stable leading "⚖️ FASTED" so we match on that, not the full string.
        const isFastedGroup = g.title.startsWith('⚖️ FASTED');
        const title = isFastedGroup && fastedSlot
          ? `⚖️ FASTED — at ${fastedSlot} (wake + 10 min), before food or water`
          : g.title;
        return {
          title,
          fields: g.fields.filter(f => {
            if (!deviceSources) return true;
            return deviceSources[String(f.key)]?.length > 0;
          }),
        };
      }).filter(g => g.fields.length > 0);

      // In recap + full-day modes, also drop groups where every field is already
      // logged (focused worklist). Current-mode keeps everything visible so the
      // user can correct a mistyped value.
      const displayGroups = (mode === 'recap' || forFullDay)
        ? filteredGroups.filter(g => countPending(g, metrics, local, deviceSources) > 0)
        : filteredGroups;

      const pending = displayGroups.reduce((s, g) => s + countPending(g, metrics, local, deviceSources), 0);
      return { bucket: b, groups: displayGroups, pending };
    }).filter(s => s.groups.length > 0);
  }, [eligibleBuckets, deviceSources, mode, forFullDay, metrics, local, fastedSlot]);

  const header = BUCKET_LABELS[currentBucket];

  if (!open) return null;

  const getValue = (key: keyof DailyMetrics): string => {
    if (key in local) {
      const v = local[key];
      return v === null || v === undefined ? '' : String(v);
    }
    const v = metrics[key];
    return v === null || v === undefined ? '' : String(v);
  };

  const setField = (key: keyof DailyMetrics, raw: string, spec: FieldSpec) => {
    if (raw === '') {
      setLocal(p => ({ ...p, [key]: null }));
      return;
    }
    const parsed = spec.type === 'integer' ? parseInt(raw, 10) : parseFloat(raw);
    if (Number.isNaN(parsed)) return;
    setLocal(p => ({ ...p, [key]: parsed }));
  };

  const filledCount = Object.values(local).filter(v => v !== null && v !== undefined && v !== '').length;
  const totalPending = bucketSections.reduce((s, b) => s + b.pending, 0);

  const handleSave = async () => {
    if (filledCount === 0) { onClose(); return; }
    setSaving(true);
    await onSave(local);
    setSaving(false);
    setSavedAt(Date.now());
    setTimeout(() => { setLocal({}); onClose(); }, 700);
  };

  const timeLabel = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  const isRecap = mode === 'recap';
  const isFullDay = forFullDay;

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center animate-fade-in" onClick={onClose}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div
        className="relative glass-card rounded-t-3xl md:rounded-3xl w-full md:max-w-2xl max-h-[92vh] overflow-hidden flex flex-col animate-fade-in-up"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between p-6 border-b border-card-border shrink-0">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <Clock className="w-3.5 h-3.5 text-accent" />
              <span className="text-[10px] uppercase tracking-widest text-muted font-mono">
                {isFullDay ? (dateLabel || 'past day') : timeLabel}
              </span>
              {isFullDay && (
                <span className="inline-flex items-center gap-1 text-[9px] uppercase tracking-widest px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/25 font-semibold">
                  <AlertCircle className="w-2.5 h-2.5" /> Past day
                </span>
              )}
              {isRecap && !isFullDay && (
                <span className="inline-flex items-center gap-1 text-[9px] uppercase tracking-widest px-2 py-0.5 rounded-full bg-accent/10 text-accent border border-accent/25 font-semibold">
                  <Zap className="w-2.5 h-2.5" /> Recap mode
                </span>
              )}
            </div>
            <h2 className="text-xl font-semibold tracking-tight">
              {isFullDay
                ? `Log for ${dateLabel || 'this past day'}`
                : isRecap
                  ? 'Catch up — log everything since wake'
                  : header.title}
            </h2>
            <p className="text-xs text-muted-foreground mt-1.5 max-w-md leading-relaxed">
              {isFullDay
                ? totalPending > 0
                  ? `${totalPending} measurement${totalPending === 1 ? '' : 's'} still blank for that day. Fill what you remember; leave the rest.`
                  : 'Every measurable field for that day is already logged.'
                : isRecap
                  ? totalPending > 0
                    ? `${totalPending} measurement${totalPending === 1 ? '' : 's'} still pending across ${bucketSections.length} window${bucketSections.length === 1 ? '' : 's'}. Fill what you have; leave the rest blank.`
                    : 'You\'re fully caught up for today — nice work. Close this sheet and come back later.'
                  : header.subtitle}
            </p>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-surface-3 text-muted-foreground hover:text-foreground transition-colors shrink-0">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="overflow-y-auto flex-1 p-6 space-y-8">
          {bucketSections.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="w-12 h-12 rounded-2xl bg-accent/10 border border-accent/25 flex items-center justify-center mb-3">
                <Check className="w-5 h-5 text-accent" />
              </div>
              <p className="text-sm font-semibold">All caught up</p>
              <p className="text-[11px] text-muted-foreground mt-1 max-w-xs">
                Every measurable metric for today is logged. Come back after dinner for the evening window.
              </p>
            </div>
          )}

          {bucketSections.map(section => {
            const meta = BUCKET_LABELS[section.bucket];
            const isCurrentBucket = section.bucket === currentBucket;
            return (
              <div key={section.bucket} className="space-y-4">
                {/* Bucket header — shown in recap AND full-day modes (multi-bucket).
                    Current-mode has only one bucket so its header lives up top. */}
                {(isRecap || isFullDay) && (
                  <div className={clsx('flex items-center gap-2 pb-1 border-b',
                    isCurrentBucket && !isFullDay ? 'border-accent/30' : 'border-card-border')}>
                    <span className="text-base">{meta.emoji}</span>
                    <span className={clsx('text-xs font-semibold tracking-tight',
                      isCurrentBucket && !isFullDay ? 'text-accent' : 'text-foreground/90')}>
                      {meta.title}
                    </span>
                    {isCurrentBucket && !isFullDay && (
                      <span className="text-[9px] uppercase tracking-widest text-accent/80 font-mono">now</span>
                    )}
                    {!isCurrentBucket && !isFullDay && (
                      <span className="inline-flex items-center gap-1 text-[9px] uppercase tracking-widest px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/25 font-medium">
                        <AlertCircle className="w-2.5 h-2.5" /> earlier — catch up
                      </span>
                    )}
                    <span className="ml-auto text-[10px] text-muted font-mono tabular-nums">
                      {section.pending} pending
                    </span>
                  </div>
                )}

                {section.groups.map((group) => (
                  <div key={`${section.bucket}-${group.title}`}>
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <p className="text-[10px] uppercase tracking-widest text-accent font-mono">{group.title}</p>
                      {(() => {
                        const pending = countPending(group, metrics, local, deviceSources);
                        if (pending === 0) return <span className="text-[9px] text-accent">✓ complete</span>;
                        return <span className="text-[9px] text-muted font-mono">{pending} blank</span>;
                      })()}
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {group.fields.map(spec => {
                        const value = getValue(spec.key);
                        const sources = deviceSources?.[String(spec.key)] || [];
                        const deviceSource = sources.find(s => s !== 'manual');
                        const isFilled = value !== '' && value !== '0';  // 0 is valid; only truly-empty is "unfilled"
                        return (
                          <div key={String(spec.key)} className="space-y-1.5">
                            <label className="block text-xs text-muted-foreground">
                              <span className="flex items-center gap-1.5 flex-wrap">
                                <span>{spec.label}</span>
                                {deviceSource && (
                                  <span className="inline-flex items-center gap-0.5 text-[9px] px-1.5 py-0.5 rounded bg-accent/10 border border-accent/20 text-accent font-medium uppercase tracking-wider">
                                    ⌚ {deviceSource}
                                  </span>
                                )}
                                {!deviceSource && sources.includes('manual') && (
                                  <span className="inline-flex items-center gap-0.5 text-[9px] px-1.5 py-0.5 rounded bg-surface-3 text-muted uppercase tracking-wider">manual</span>
                                )}
                                {isFilled && <Check className="w-3 h-3 text-accent shrink-0" />}
                              </span>
                              {spec.hint && <span className="block text-[10px] text-muted mt-0.5">{spec.hint}</span>}
                            </label>
                            <div className="relative">
                              <input
                                type="number"
                                inputMode="decimal"
                                value={value}
                                onChange={e => setField(spec.key, e.target.value, spec)}
                                min={spec.min}
                                max={spec.max}
                                step={spec.step || (spec.type === 'integer' ? 1 : 'any')}
                                placeholder="—"
                                className={clsx(
                                  'w-full rounded-xl bg-surface-2 border px-3.5 py-2.5 text-sm font-mono tabular-nums outline-none focus:border-accent transition-colors placeholder:text-muted/50',
                                  isFilled ? 'border-accent/30' : 'border-card-border',
                                )}
                              />
                              {spec.unit && (
                                <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[10px] text-muted pointer-events-none">{spec.unit}</span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            );
          })}

          {bucketSections.length > 0 && (
            <div className="rounded-xl p-3 border border-dashed border-card-border bg-surface-2/50">
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                {isRecap
                  ? 'Leave any field blank if you genuinely don\'t have it. Partial logs still help — the AI uses every signal.'
                  : 'Leave any field blank if you don\'t have it. Next check-in will show different fields based on the time.'}
              </p>
            </div>
          )}
        </div>

        {/* Save bar */}
        <div className="p-4 border-t border-card-border bg-surface-1 shrink-0">
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs text-muted-foreground">
              {savedAt
                ? <span className="text-accent flex items-center gap-1.5"><Check className="w-3.5 h-3.5" /> Saved</span>
                : filledCount > 0
                  ? `${filledCount} field${filledCount === 1 ? '' : 's'} ready`
                  : isRecap && totalPending === 0
                    ? 'Nothing to log'
                    : 'Fill at least one'}
            </span>
            <div className="flex gap-2">
              <button onClick={onClose} className="px-4 py-2.5 rounded-xl bg-surface-3 text-muted-foreground hover:text-foreground text-sm transition-colors">
                Close
              </button>
              <button
                onClick={handleSave}
                disabled={saving || filledCount === 0}
                className={clsx('px-5 py-2.5 rounded-xl text-sm font-semibold transition-all',
                  filledCount === 0
                    ? 'bg-surface-3 text-muted cursor-not-allowed'
                    : 'bg-accent text-black hover:bg-accent-bright glow-cta')}
              >
                {saving ? 'Saving…' : `Save ${filledCount || ''}`}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
