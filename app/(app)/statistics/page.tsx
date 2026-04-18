'use client';

import { useState, useMemo } from 'react';
import { useStatistics } from '@/lib/hooks/useApiData';
import clsx from 'clsx';
import {
  LineChart, Line, ResponsiveContainer, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine,
} from 'recharts';
import {
  Activity, Moon, HeartPulse, Droplet, Dumbbell, Brain, Sparkles, Flame,
  TrendingUp, TrendingDown, Minus,
} from 'lucide-react';

// ─────────────────────────────────────────────────────────────────────────────
// Metric catalog — maps daily_metrics columns to UI metadata
// Direction: "up" means higher = better (HDL, hrv, steps). "down" means lower
// is better (weight when losing, resting HR, stress). "target" means closer to
// a target value is better (sleep 7-9h, BMI 22, BP 120/80).
// ─────────────────────────────────────────────────────────────────────────────
type Direction = 'up' | 'down' | 'target';

interface MetricDef {
  key: string;
  label: string;
  unit?: string;
  direction: Direction;
  target?: number;
  decimals?: number;
  category: 'sleep' | 'heart' | 'activity' | 'bp' | 'mental' | 'body' | 'watch';
}

const METRIC_CATALOG: MetricDef[] = [
  // Body
  { key: 'weight_kg',              label: 'Weight',                 unit: 'kg',     direction: 'target', decimals: 1, category: 'body' },

  // Sleep
  { key: 'sleep_hours',            label: 'Sleep duration',         unit: 'h',      direction: 'target', target: 8, decimals: 1, category: 'sleep' },
  { key: 'sleep_hours_planned',    label: 'Sleep planned',          unit: 'h',      direction: 'up', decimals: 1, category: 'sleep' },
  { key: 'sleep_quality',          label: 'Sleep quality',          unit: '/10',    direction: 'up', category: 'sleep' },
  { key: 'sleep_score',            label: 'Sleep score',            unit: '/100',   direction: 'up', category: 'sleep' },
  { key: 'deep_sleep_min',         label: 'Deep sleep',             unit: 'min',    direction: 'up', category: 'sleep' },
  { key: 'light_sleep_min',        label: 'Light sleep',            unit: 'min',    direction: 'target', category: 'sleep' },
  { key: 'rem_sleep_min',          label: 'REM sleep',              unit: 'min',    direction: 'up', category: 'sleep' },
  { key: 'awake_min',              label: 'Awake during night',     unit: 'min',    direction: 'down', category: 'sleep' },

  // Heart + respiratory
  { key: 'resting_hr',             label: 'Resting HR',             unit: 'bpm',    direction: 'down', category: 'heart' },
  { key: 'min_heart_rate',         label: 'Min heart rate',         unit: 'bpm',    direction: 'down', category: 'heart' },
  { key: 'max_heart_rate',         label: 'Max heart rate',         unit: 'bpm',    direction: 'up', category: 'heart' },
  { key: 'avg_heart_rate',         label: 'Avg heart rate',         unit: 'bpm',    direction: 'down', category: 'heart' },
  { key: 'hrv',                    label: 'HRV (daytime)',          unit: 'ms',     direction: 'up', category: 'heart' },
  { key: 'hrv_sleep_avg',          label: 'HRV during sleep',       unit: 'ms',     direction: 'up', category: 'heart' },
  { key: 'blood_oxygen_avg_sleep', label: 'Blood O₂ during sleep',  unit: '%',      direction: 'up', decimals: 1, category: 'heart' },
  { key: 'avg_respiratory_rate',   label: 'Respiratory rate',       unit: '/min',   direction: 'target', target: 14, decimals: 1, category: 'heart' },
  { key: 'skin_temp_deviation',    label: 'Skin temp deviation',    unit: '°C',     direction: 'target', target: 0, decimals: 2, category: 'heart' },

  // Blood pressure
  { key: 'bp_systolic_morning',    label: 'Morning BP · Sys',       unit: 'mmHg',   direction: 'target', target: 115, category: 'bp' },
  { key: 'bp_diastolic_morning',   label: 'Morning BP · Dia',       unit: 'mmHg',   direction: 'target', target: 75, category: 'bp' },
  { key: 'bp_systolic_evening',    label: 'Evening BP · Sys',       unit: 'mmHg',   direction: 'target', target: 115, category: 'bp' },
  { key: 'bp_diastolic_evening',   label: 'Evening BP · Dia',       unit: 'mmHg',   direction: 'target', target: 75, category: 'bp' },

  // Activity
  { key: 'steps',                  label: 'Steps',                            direction: 'up', category: 'activity' },
  { key: 'active_time_min',        label: 'Active time',            unit: 'min', direction: 'up', category: 'activity' },
  { key: 'activity_calories',      label: 'Activity calories',      unit: 'kcal', direction: 'up', category: 'activity' },
  { key: 'workout_minutes',        label: 'Workout duration',       unit: 'min', direction: 'up', category: 'activity' },

  // Mental / subjective
  { key: 'mood',                   label: 'Mood',                   unit: '/10', direction: 'up', category: 'mental' },
  { key: 'energy',                 label: 'Energy (subjective)',    unit: '/10', direction: 'up', category: 'mental' },
  { key: 'energy_score',           label: 'Energy score (watch)',   unit: '/100', direction: 'up', category: 'mental' },
  { key: 'stress_level',           label: 'Stress',                 unit: '/10', direction: 'down', category: 'mental' },

  // Watch indices
  { key: 'antioxidant_index',      label: 'Antioxidant index',      unit: '/100', direction: 'up', category: 'watch' },
  { key: 'ages_index',             label: 'AGEs index',                       direction: 'down', decimals: 2, category: 'watch' },
];

const CATEGORIES: { key: MetricDef['category']; label: string; icon: React.ElementType; desc: string }[] = [
  { key: 'body',     label: 'Body composition', icon: Flame,      desc: 'Weight and body metrics' },
  { key: 'sleep',    label: 'Sleep',            icon: Moon,       desc: 'Duration, quality, stages' },
  { key: 'heart',    label: 'Heart & breathing',icon: HeartPulse, desc: 'HR, HRV, O₂, respiratory' },
  { key: 'bp',       label: 'Blood pressure',   icon: Droplet,    desc: 'Morning + evening readings' },
  { key: 'activity', label: 'Activity',         icon: Dumbbell,   desc: 'Steps, active time, calories' },
  { key: 'mental',   label: 'Mental & energy',  icon: Brain,      desc: 'Mood, energy, stress' },
  { key: 'watch',    label: 'Wearable indices', icon: Sparkles,   desc: 'Antioxidant + AGEs skin scans' },
];

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────
interface MetricRow {
  date: string;
  [key: string]: unknown;
}

// ─────────────────────────────────────────────────────────────────────────────
// Utilities
// ─────────────────────────────────────────────────────────────────────────────
function extractSeries(rows: MetricRow[], key: string) {
  return rows
    .map(r => ({ date: r.date, value: r[key] }))
    .filter(p => typeof p.value === 'number' && Number.isFinite(p.value)) as { date: string; value: number }[];
}

/** Calculate improvement given direction semantics. Returns null if <2 points. */
function computeImprovement(series: { value: number }[], def: MetricDef): {
  firstValue: number;
  latestValue: number;
  pctChange: number;       // raw % change (signed)
  improved: boolean | null; // true = better, false = worse, null = flat/not enough data
  improvementPct: number;   // user-facing number (always sign-corrected so improved = positive)
} | null {
  if (series.length < 2) return null;
  const first = series[0].value;
  const latest = series[series.length - 1].value;
  if (first === 0 && latest === 0) return null;

  const pctChange = first === 0 ? 0 : ((latest - first) / Math.abs(first)) * 100;

  let improved: boolean | null;
  let improvementPct: number;

  if (def.direction === 'up') {
    improved = latest > first ? true : latest < first ? false : null;
    improvementPct = pctChange; // positive = better
  } else if (def.direction === 'down') {
    improved = latest < first ? true : latest > first ? false : null;
    improvementPct = -pctChange; // flip sign so positive = better
  } else {
    // target direction: closer to target = better
    const target = def.target ?? 0;
    const firstDist = Math.abs(first - target);
    const latestDist = Math.abs(latest - target);
    if (firstDist === latestDist) {
      improved = null;
      improvementPct = 0;
    } else {
      improved = latestDist < firstDist;
      // % reduction in distance from target → positive when closer
      improvementPct = firstDist === 0 ? 0 : ((firstDist - latestDist) / firstDist) * 100;
    }
  }

  return { firstValue: first, latestValue: latest, pctChange, improved, improvementPct };
}

function fmtValue(n: number, def: MetricDef): string {
  const d = def.decimals ?? 0;
  return d > 0 ? n.toFixed(d) : String(Math.round(n));
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// ─────────────────────────────────────────────────────────────────────────────
// Small UI pieces — reused pattern from settings + history
// ─────────────────────────────────────────────────────────────────────────────
function Section({ icon: Icon, title, subtitle, children }: {
  icon: React.ElementType; title: string; subtitle?: string; children: React.ReactNode;
}) {
  return (
    <div className="glass-card rounded-2xl p-5 sm:p-6 space-y-4 animate-fade-in-up">
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-xl bg-accent/10 border border-accent/20 flex items-center justify-center shrink-0">
          <Icon className="w-4 h-4 text-accent" />
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-base sm:text-lg font-semibold tracking-tight">{title}</h2>
          {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
        </div>
      </div>
      {children}
    </div>
  );
}

function MetricChart({ def, series }: { def: MetricDef; series: { date: string; value: number }[] }) {
  const improvement = computeImprovement(series, def);
  const unitSuffix = def.unit ? ` ${def.unit}` : '';

  // Text below graph
  let caption: React.ReactNode = null;
  if (improvement) {
    const pct = Math.abs(improvement.improvementPct);
    if (improvement.improved === true) {
      caption = (
        <>
          Your <span className="text-foreground font-medium">{def.label.toLowerCase()}</span> <span className="text-accent font-semibold">improved by {pct.toFixed(1)}%</span> from when you started the protocol.
        </>
      );
    } else if (improvement.improved === false) {
      caption = (
        <>
          Your <span className="text-foreground font-medium">{def.label.toLowerCase()}</span> <span className="text-danger font-semibold">declined by {pct.toFixed(1)}%</span> from when you started the protocol.
        </>
      );
    } else {
      caption = (
        <>
          Your <span className="text-foreground font-medium">{def.label.toLowerCase()}</span> has <span className="text-muted-foreground font-medium">stayed the same</span> since you started the protocol.
        </>
      );
    }
  } else {
    caption = series.length === 1
      ? <>One reading logged so far. Log more to see a trend.</>
      : <>Log a reading via the Smart Log on /tracking to start building your trend.</>;
  }

  const lineColor = improvement?.improved === true
    ? '#34d399'
    : improvement?.improved === false
      ? '#f87171'
      : '#9ca3af';

  return (
    <div className="rounded-xl bg-surface-2 border border-card-border p-4 space-y-3">
      <div className="flex items-baseline justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold truncate">{def.label}</p>
          <p className="text-[10px] text-muted uppercase tracking-widest mt-0.5">
            {series.length} reading{series.length === 1 ? '' : 's'}
          </p>
        </div>
        {improvement && (
          <div className="flex items-center gap-1.5 shrink-0">
            {improvement.improved === true && <TrendingUp className="w-3.5 h-3.5 text-accent" />}
            {improvement.improved === false && <TrendingDown className="w-3.5 h-3.5 text-danger" />}
            {improvement.improved === null && <Minus className="w-3.5 h-3.5 text-muted" />}
            <span className={clsx('text-lg font-bold font-mono tabular-nums',
              improvement.improved === true ? 'text-accent' : improvement.improved === false ? 'text-danger' : 'text-foreground')}>
              {fmtValue(improvement.latestValue, def)}{unitSuffix}
            </span>
          </div>
        )}
        {!improvement && series.length === 1 && (
          <span className="text-lg font-bold font-mono tabular-nums text-foreground shrink-0">
            {fmtValue(series[0].value, def)}{unitSuffix}
          </span>
        )}
      </div>

      {series.length >= 2 ? (
        <div className="-mx-2">
          <ResponsiveContainer width="100%" height={140}>
            <LineChart data={series.map(s => ({ ...s, dateLabel: fmtDate(s.date) }))}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1d2128" vertical={false} />
              <XAxis dataKey="dateLabel" tick={{ fontSize: 9, fill: '#71717a' }} axisLine={false} tickLine={false} interval="preserveStartEnd" minTickGap={20} />
              <YAxis tick={{ fontSize: 9, fill: '#71717a' }} axisLine={false} tickLine={false} domain={['auto', 'auto']} />
              <Tooltip
                contentStyle={{ background: '#13161c', border: '1px solid #1d2128', borderRadius: 10, fontSize: 11, padding: '6px 10px' }}
                labelStyle={{ color: '#ecedef', fontSize: 10 }}
                itemStyle={{ color: lineColor }}
                formatter={(v) => [`${fmtValue(Number(v), def)}${unitSuffix}`, def.label]}
              />
              {def.direction === 'target' && def.target !== undefined && (
                <ReferenceLine y={def.target} stroke="#34d399" strokeDasharray="3 3" strokeOpacity={0.4} />
              )}
              <Line
                type="monotone"
                dataKey="value"
                stroke={lineColor}
                strokeWidth={2}
                dot={{ fill: lineColor, r: 3 }}
                activeDot={{ r: 5 }}
                isAnimationActive
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="h-[140px] flex items-center justify-center rounded-lg bg-surface-3/50 border border-dashed border-card-border">
          <p className="text-[11px] text-muted">{series.length === 0 ? 'No data yet' : 'One reading so far'}</p>
        </div>
      )}

      <p className="text-[11px] text-muted-foreground leading-relaxed">{caption}</p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────────────────────
export default function StatisticsPage() {
  const { data: stats, isLoading: loading } = useStatistics();
  const metrics = (stats?.metrics as MetricRow[] | undefined) ?? [];
  const protocolStartedAt = stats?.protocolStartedAt ?? null;
  const [activeCategory, setActiveCategory] = useState<string>('all');

  // Filter metrics to only those with ≥1 data point, grouped by category
  const metricsWithData = useMemo(() => {
    return METRIC_CATALOG.map(def => {
      const fullSeries = extractSeries(metrics, def.key);
      // If protocolStartedAt known, only consider points ON/AFTER that for "since protocol" framing
      const series = protocolStartedAt
        ? fullSeries.filter(s => s.date >= protocolStartedAt.slice(0, 10))
        : fullSeries;
      return { def, series };
    }).filter(m => m.series.length > 0);
  }, [metrics, protocolStartedAt]);

  const metricsByCategory = useMemo(() => {
    const groups: Record<string, { def: MetricDef; series: { date: string; value: number }[] }[]> = {};
    for (const m of metricsWithData) {
      (groups[m.def.category] ??= []).push(m);
    }
    return groups;
  }, [metricsWithData]);

  // Overall stats
  const totalImproved = metricsWithData.filter(m => {
    const imp = computeImprovement(m.series, m.def);
    return imp?.improved === true;
  }).length;
  const totalDeclined = metricsWithData.filter(m => {
    const imp = computeImprovement(m.series, m.def);
    return imp?.improved === false;
  }).length;
  const totalWithTrend = metricsWithData.filter(m => m.series.length >= 2).length;
  const totalReadings = metricsWithData.reduce((s, m) => s + m.series.length, 0);
  const daysTracked = metrics.length > 0
    ? Math.round((Date.now() - new Date(metrics[0].date).getTime()) / 864e5)
    : 0;

  if (loading) return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 space-y-4">
      {[1, 2, 3].map(i => (
        <div key={i} className="glass-card rounded-2xl p-6 animate-pulse">
          <div className="h-6 w-48 bg-surface-3 rounded mb-3" />
          <div className="h-4 w-full bg-surface-3 rounded mb-2" />
          <div className="h-24 w-full bg-surface-3 rounded-xl" />
        </div>
      ))}
    </div>
  );

  const visibleCategories = CATEGORIES.filter(c =>
    metricsByCategory[c.key] && metricsByCategory[c.key].length > 0
  );

  // CSV export — wide format: one row per date, columns for every tracked metric.
  // Doctor-friendly. Opens in Excel / Google Sheets.
  const exportCSV = () => {
    if (metrics.length === 0) return;
    const allKeys = new Set<string>();
    metrics.forEach(r => Object.keys(r).forEach(k => { if (k !== 'date' && k !== 'id' && k !== 'user_id' && k !== 'created_at' && k !== 'updated_at') allKeys.add(k); }));
    const cols = Array.from(allKeys).sort();
    const header = ['date', ...cols].join(',');
    const sortedRows = [...metrics].sort((a, b) => String(a.date).localeCompare(String(b.date)));
    const lines = sortedRows.map(r => [
      r.date,
      ...cols.map(c => {
        const v = r[c];
        if (v === null || v === undefined) return '';
        if (typeof v === 'string') return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
        if (Array.isArray(v)) return `"${v.join('; ')}"`;
        return String(v);
      }),
    ].join(','));
    const blob = new Blob([header + '\n' + lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `protocol-stats-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-5">
      {/* Header */}
      <div className="flex items-end justify-between gap-4 animate-fade-in">
        <div>
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">Statistics</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Every metric you&apos;ve logged, over time. Improvement shown relative to when you started the protocol.
          </p>
        </div>
        {metrics.length > 0 && (
          <button
            onClick={exportCSV}
            className="shrink-0 text-xs px-3.5 py-2 rounded-xl bg-surface-2 border border-card-border hover:border-accent/40 text-muted-foreground hover:text-accent transition-all flex items-center gap-1.5"
            title="Download CSV — doctor-friendly, opens in Excel / Sheets"
          >
            📥 Export CSV
          </button>
        )}
      </div>

      {/* Empty state */}
      {metricsWithData.length === 0 && (
        <Section icon={Activity} title="No metrics logged yet" subtitle="Open /tracking and tap Smart Log to start">
          <div className="text-center py-8 space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-surface-2 border border-card-border mx-auto flex items-center justify-center">
              <Sparkles className="w-7 h-7 text-muted" />
            </div>
            <div>
              <p className="text-sm font-medium">Statistics appear after your first log</p>
              <p className="text-xs text-muted-foreground mt-1.5 max-w-sm mx-auto leading-relaxed">
                Use the Smart Log button on the tracking page — it shows you the right fields for the current time of day (sleep stages in the morning, activity at midday, evening BP, etc.).
              </p>
            </div>
            <a href="/tracking" className="inline-block px-5 py-2.5 rounded-xl bg-accent text-black text-sm font-semibold hover:bg-accent-bright transition-colors">
              Open tracking
            </a>
          </div>
        </Section>
      )}

      {/* Overall stats row */}
      {metricsWithData.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 animate-fade-in-up">
          <div className="metric-tile">
            <p className="text-[10px] text-muted uppercase tracking-widest">Metrics tracked</p>
            <p className="text-2xl sm:text-3xl font-bold font-mono tabular-nums mt-2 leading-none">{metricsWithData.length}</p>
            <p className="text-[11px] text-muted-foreground mt-2">of {METRIC_CATALOG.length} available</p>
          </div>
          <div className="metric-tile">
            <p className="text-[10px] text-muted uppercase tracking-widest">Improving</p>
            <p className="text-2xl sm:text-3xl font-bold font-mono tabular-nums mt-2 leading-none text-accent">{totalImproved}</p>
            <p className="text-[11px] text-muted-foreground mt-2">{totalWithTrend > 0 ? `of ${totalWithTrend} with trend` : 'need ≥2 readings'}</p>
          </div>
          <div className="metric-tile">
            <p className="text-[10px] text-muted uppercase tracking-widest">Declining</p>
            <p className={clsx('text-2xl sm:text-3xl font-bold font-mono tabular-nums mt-2 leading-none', totalDeclined > 0 ? 'text-danger' : 'text-foreground')}>
              {totalDeclined}
            </p>
            <p className="text-[11px] text-muted-foreground mt-2">worth attention</p>
          </div>
          <div className="metric-tile">
            <p className="text-[10px] text-muted uppercase tracking-widest">Readings</p>
            <p className="text-2xl sm:text-3xl font-bold font-mono tabular-nums mt-2 leading-none">{totalReadings}</p>
            <p className="text-[11px] text-muted-foreground mt-2">
              {daysTracked > 0 ? `${daysTracked} days tracked` : ''}
            </p>
          </div>
        </div>
      )}

      {/* Category filter */}
      {visibleCategories.length > 1 && (
        <div className="flex gap-2 overflow-x-auto scrollbar-none -mx-1 px-1 pb-1 animate-fade-in">
          <button
            onClick={() => setActiveCategory('all')}
            className={clsx('px-3.5 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition-colors shrink-0',
              activeCategory === 'all'
                ? 'bg-accent text-black'
                : 'bg-surface-2 text-muted-foreground hover:text-foreground border border-card-border')}
          >
            All ({metricsWithData.length})
          </button>
          {visibleCategories.map(cat => {
            const Icon = cat.icon;
            const count = metricsByCategory[cat.key]?.length || 0;
            return (
              <button
                key={cat.key}
                onClick={() => setActiveCategory(cat.key)}
                className={clsx('px-3.5 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition-colors shrink-0 flex items-center gap-1.5',
                  activeCategory === cat.key
                    ? 'bg-accent text-black'
                    : 'bg-surface-2 text-muted-foreground hover:text-foreground border border-card-border')}
              >
                <Icon className="w-3.5 h-3.5" />
                {cat.label} ({count})
              </button>
            );
          })}
        </div>
      )}

      {/* Category sections */}
      {visibleCategories
        .filter(c => activeCategory === 'all' || activeCategory === c.key)
        .map(category => {
          const list = metricsByCategory[category.key] || [];
          if (list.length === 0) return null;
          return (
            <Section key={category.key} icon={category.icon} title={category.label} subtitle={category.desc}>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                {list.map(m => (
                  <MetricChart key={m.def.key} def={m.def} series={m.series} />
                ))}
              </div>
            </Section>
          );
        })}

      {metricsWithData.length > 0 && protocolStartedAt && (
        <p className="text-[11px] text-center text-muted pt-2">
          Protocol started {new Date(protocolStartedAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })} · data before that date is excluded from &ldquo;since start&rdquo; comparisons.
        </p>
      )}
    </div>
  );
}
