'use client';

import { DailyMetrics } from '@/lib/hooks/useDailyMetrics';
import clsx from 'clsx';

export function MetricsTab({ metrics, onChange }: { metrics: DailyMetrics; onChange: (updates: Partial<DailyMetrics>) => void }) {
  return (
    <div className="space-y-4">
      {/* Weight */}
      <div className="rounded-2xl bg-card border border-card-border p-4 space-y-2">
        <label className="text-xs text-muted-foreground">⚖️ Weight (kg)</label>
        <input type="number" step="0.1" value={metrics.weight_kg ?? ''} onChange={e => onChange({ weight_kg: e.target.value ? parseFloat(e.target.value) : null })}
          placeholder="75.5" className="w-full rounded-xl bg-background border border-card-border px-3 py-2.5 text-sm outline-none focus:border-accent font-mono" />
      </div>

      {/* Sleep */}
      <div className="rounded-2xl bg-card border border-card-border p-4 space-y-3">
        <p className="text-xs text-muted-foreground">😴 Sleep</p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-[10px] text-muted">Hours</label>
            <input type="number" step="0.25" value={metrics.sleep_hours ?? ''} onChange={e => onChange({ sleep_hours: e.target.value ? parseFloat(e.target.value) : null })}
              placeholder="7.5" className="w-full mt-1 rounded-xl bg-background border border-card-border px-3 py-2.5 text-sm outline-none focus:border-accent font-mono" />
          </div>
          <div>
            <label className="text-[10px] text-muted">Quality (1-10)</label>
            <div className="flex gap-0.5 mt-1">{[...Array(10)].map((_, i) => (
              <button key={i} onClick={() => onChange({ sleep_quality: i + 1 })}
                className={clsx('flex-1 h-8 rounded text-[10px] font-mono transition-all',
                  metrics.sleep_quality === i + 1 ? 'bg-accent text-black' : (metrics.sleep_quality ?? 0) > i ? 'bg-accent/20 text-accent' : 'bg-background border border-card-border text-muted')}>
                {i + 1}
              </button>
            ))}</div>
          </div>
        </div>
      </div>

      {/* Mood / Energy */}
      <div className="rounded-2xl bg-card border border-card-border p-4 space-y-3">
        <p className="text-xs text-muted-foreground">💚 Mood & Energy</p>
        {([
          { key: 'mood', label: '😊 Mood', val: metrics.mood },
          { key: 'energy', label: '⚡ Energy', val: metrics.energy },
          { key: 'stress_level', label: '😰 Stress', val: metrics.stress_level },
        ] as const).map(({ key, label, val }) => (
          <div key={key}>
            <label className="text-[10px] text-muted">{label} (1-10)</label>
            <div className="flex gap-0.5 mt-1">{[...Array(10)].map((_, i) => (
              <button key={i} onClick={() => onChange({ [key]: i + 1 })}
                className={clsx('flex-1 h-8 rounded text-[10px] font-mono transition-all',
                  val === i + 1 ? 'bg-accent text-black' : (val ?? 0) > i ? 'bg-accent/20 text-accent' : 'bg-background border border-card-border text-muted')}>
                {i + 1}
              </button>
            ))}</div>
          </div>
        ))}
      </div>

      {/* Wearable data */}
      <div className="rounded-2xl bg-card border border-card-border p-4 space-y-3">
        <p className="text-xs text-muted-foreground">⌚ From wearable (optional)</p>
        <div className="grid grid-cols-3 gap-2">
          <div>
            <label className="text-[10px] text-muted">Steps</label>
            <input type="number" value={metrics.steps ?? ''} onChange={e => onChange({ steps: e.target.value ? parseInt(e.target.value) : null })}
              placeholder="8500" className="w-full mt-1 rounded-xl bg-background border border-card-border px-2 py-2 text-xs outline-none focus:border-accent font-mono" />
          </div>
          <div>
            <label className="text-[10px] text-muted">HRV (ms)</label>
            <input type="number" value={metrics.hrv ?? ''} onChange={e => onChange({ hrv: e.target.value ? parseInt(e.target.value) : null })}
              placeholder="55" className="w-full mt-1 rounded-xl bg-background border border-card-border px-2 py-2 text-xs outline-none focus:border-accent font-mono" />
          </div>
          <div>
            <label className="text-[10px] text-muted">Rest HR</label>
            <input type="number" value={metrics.resting_hr ?? ''} onChange={e => onChange({ resting_hr: e.target.value ? parseInt(e.target.value) : null })}
              placeholder="60" className="w-full mt-1 rounded-xl bg-background border border-card-border px-2 py-2 text-xs outline-none focus:border-accent font-mono" />
          </div>
        </div>
      </div>

      {/* Workout */}
      <div className="rounded-2xl bg-card border border-card-border p-4 space-y-3">
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={metrics.workout_done ?? false} onChange={e => onChange({ workout_done: e.target.checked })}
            className="w-4 h-4 accent-[#00ff88]" />
          <span className="text-sm">🏋️ Workout completed</span>
        </label>
        {metrics.workout_done && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] text-muted">Duration (min)</label>
              <input type="number" value={metrics.workout_minutes ?? ''} onChange={e => onChange({ workout_minutes: e.target.value ? parseInt(e.target.value) : null })}
                placeholder="45" className="w-full mt-1 rounded-xl bg-background border border-card-border px-3 py-2 text-xs outline-none focus:border-accent font-mono" />
            </div>
            <div>
              <label className="text-[10px] text-muted">Intensity</label>
              <select value={metrics.workout_intensity ?? ''} onChange={e => onChange({ workout_intensity: e.target.value || null })}
                className="w-full mt-1 rounded-xl bg-background border border-card-border px-3 py-2 text-xs outline-none focus:border-accent">
                <option value="">-</option><option value="low">Low / Zone 2</option><option value="moderate">Moderate</option><option value="high">High / HIIT</option>
              </select>
            </div>
          </div>
        )}
      </div>

      {/* Notes */}
      <div className="rounded-2xl bg-card border border-card-border p-4 space-y-2">
        <label className="text-xs text-muted-foreground">📝 Notes</label>
        <textarea value={metrics.notes ?? ''} onChange={e => onChange({ notes: e.target.value })} rows={3}
          placeholder="How did you feel? Anything notable?" className="w-full rounded-xl bg-background border border-card-border px-3 py-2.5 text-sm outline-none focus:border-accent resize-none" />
      </div>

      <p className="text-[10px] text-center text-muted">Changes save automatically.</p>
    </div>
  );
}
