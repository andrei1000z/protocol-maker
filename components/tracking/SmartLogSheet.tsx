'use client';

import { useState, useMemo } from 'react';
import clsx from 'clsx';
import { X, Check, Clock } from 'lucide-react';
import type { DailyMetrics } from '@/lib/hooks/useDailyMetrics';

// ============================================================================
// Time-aware field groups — user sees only metrics relevant for RIGHT NOW.
// Wearable metrics (sleep stages, overnight HRV) are in the morning group,
// because that's when wearables finish processing the night and the user
// can actually read them off.
// ============================================================================
type TimeBucket = 'morning' | 'midday' | 'evening' | 'night';

function getTimeBucket(hour: number): TimeBucket {
  if (hour >= 5 && hour < 11) return 'morning';    // 05:00–10:59
  if (hour >= 11 && hour < 17) return 'midday';    // 11:00–16:59
  if (hour >= 17 && hour < 23) return 'evening';   // 17:00–22:59
  return 'night';                                   // 23:00–04:59
}

interface FieldSpec {
  key: keyof DailyMetrics;
  label: string;
  hint?: string;
  unit?: string;
  min?: number;
  max?: number;
  step?: number;
  type?: 'number' | 'integer';
}

type GroupDef = { title: string; fields: FieldSpec[] };

// Fields shown for each time bucket. Morning is the biggest since wearables
// finalize their overnight analysis then.
const BUCKET_GROUPS: Record<TimeBucket, GroupDef[]> = {
  morning: [
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
      { key: 'skin_temp_deviation', label: 'Skin temp deviation', unit: '°C', min: -3, max: 3, step: 0.1, hint: 'vs your recent avg' },
    ]},
    { title: '🩺 Morning reading', fields: [
      { key: 'resting_hr', label: 'Resting HR (morning)', unit: 'bpm', min: 20, max: 220, type: 'integer' },
      { key: 'bp_systolic_morning', label: 'BP systolic', unit: 'mmHg', min: 60, max: 250, type: 'integer' },
      { key: 'bp_diastolic_morning', label: 'BP diastolic', unit: 'mmHg', min: 30, max: 160, type: 'integer' },
      { key: 'weight_kg', label: 'Weight (morning)', unit: 'kg', min: 20, max: 400, step: 0.1 },
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

const BUCKET_LABELS: Record<TimeBucket, { title: string; subtitle: string }> = {
  morning: { title: 'Good morning', subtitle: "Your overnight numbers are in — log what your wearable reported plus how you feel." },
  midday:  { title: 'Midday check-in', subtitle: "What's happened since you woke up — activity, HR ranges, and current state." },
  evening: { title: 'Evening recap', subtitle: 'Close the day — full totals, evening BP, watch indices.' },
  night:   { title: 'Before bed', subtitle: 'Quick recap before the next cycle starts.' },
};

interface Props {
  open: boolean;
  onClose: () => void;
  metrics: DailyMetrics;
  onSave: (updates: Partial<DailyMetrics>) => Promise<void> | void;
  // New: column → list of devices that can provide this value (e.g. "Oura Ring 4", "Dyson BP monitor", "manual").
  // When present, fields get a source badge and fields the user can't measure (no sources) are hidden.
  deviceSources?: Record<string, string[]>;
}

export function SmartLogSheet({ open, onClose, metrics, onSave, deviceSources }: Props) {
  const now = new Date();
  const bucket = useMemo(() => getTimeBucket(now.getHours()), [now]);
  const rawGroups = BUCKET_GROUPS[bucket];
  const header = BUCKET_LABELS[bucket];

  // Filter each group to only fields this user's devices (or manual logging) can fill.
  // If deviceSources isn't provided, show everything (backward compat).
  const groups = useMemo<GroupDef[]>(() => {
    if (!deviceSources) return rawGroups;
    return rawGroups.map(g => ({
      title: g.title,
      fields: g.fields.filter(f => {
        const srcs = deviceSources[String(f.key)];
        return srcs && srcs.length > 0;
      }),
    })).filter(g => g.fields.length > 0);
  }, [rawGroups, deviceSources]);

  // Local editing buffer — only commit on save
  const [local, setLocal] = useState<Partial<DailyMetrics>>({});
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);

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

  const handleSave = async () => {
    if (filledCount === 0) { onClose(); return; }
    setSaving(true);
    await onSave(local);
    setSaving(false);
    setSavedAt(Date.now());
    setTimeout(() => { setLocal({}); onClose(); }, 700);
  };

  const timeLabel = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center animate-fade-in" onClick={onClose}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div
        className="relative glass-card rounded-t-3xl md:rounded-3xl w-full md:max-w-2xl max-h-[92vh] overflow-hidden flex flex-col animate-fade-in-up"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between p-6 border-b border-card-border shrink-0">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Clock className="w-3.5 h-3.5 text-accent" />
              <span className="text-[10px] uppercase tracking-widest text-muted font-mono">{timeLabel}</span>
            </div>
            <h2 className="text-xl font-semibold tracking-tight">{header.title}</h2>
            <p className="text-xs text-muted-foreground mt-1.5 max-w-md leading-relaxed">{header.subtitle}</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-surface-3 text-muted-foreground hover:text-foreground transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="overflow-y-auto flex-1 p-6 space-y-6">
          {groups.map((group) => (
            <div key={group.title}>
              <p className="text-[10px] uppercase tracking-widest text-accent mb-3 font-mono">{group.title}</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {group.fields.map(spec => {
                  const value = getValue(spec.key);
                  const sources = deviceSources?.[String(spec.key)] || [];
                  // Primary source badge: first non-manual source if any, else "manual"
                  const deviceSource = sources.find(s => s !== 'manual');
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
                          className="w-full rounded-xl bg-surface-2 border border-card-border px-3.5 py-2.5 text-sm font-mono tabular-nums outline-none focus:border-accent transition-colors placeholder:text-muted/50"
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

          <div className="rounded-xl p-3 border border-dashed border-card-border bg-surface-2/50">
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Leave any field blank if you don&apos;t have it. Next check-in will show different fields based on the time.
            </p>
          </div>
        </div>

        {/* Save bar */}
        <div className="p-4 border-t border-card-border bg-surface-1 shrink-0">
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs text-muted-foreground">
              {savedAt
                ? <span className="text-accent flex items-center gap-1.5"><Check className="w-3.5 h-3.5" /> Saved</span>
                : filledCount > 0
                  ? `${filledCount} field${filledCount === 1 ? '' : 's'} ready`
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
