'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useMyData, useComplianceToday, useComplianceHistory, invalidate } from '@/lib/hooks/useApiData';
import clsx from 'clsx';
import {
  Check, Pill, Dumbbell, Moon, Apple, Flame, Sparkles, ClipboardCheck, Trophy,
  TrendingUp, AlertCircle, Lightbulb, Watch,
} from 'lucide-react';
import { ACHIEVEMENTS, checkAchievements } from '@/lib/engine/achievements';
import {
  calculateStreak, calculateLongestStreak, countPerfectDays,
  getWeeklyData, getMonthlyHeatmap, calculateMonthlyAverage,
  ComplianceEntry,
} from '@/lib/utils/streak';
import { HabitsTab } from '@/components/tracking/HabitsTab';
import { SmartLogSheet } from '@/components/tracking/SmartLogSheet';
import { useDailyMetrics, useDailyMetricsRange, DailyMetrics } from '@/lib/hooks/useDailyMetrics';
import { buildInsights, currentWorkoutStreak, loggedDaysInLastN, Insight } from '@/lib/engine/tracking-insights';
import { SectionCard as Section, StatTile as Stat, ProgressRing } from '@/components/ui/SectionCard';
import { summarizeUserDevices, type UserDeviceSummary, CAPABILITY_TO_COLUMNS, EQUIPMENT_TO_COLUMNS } from '@/lib/engine/device-catalog';

// ─────────────────────────────────────────────────────────────────────────────
// Types + static
// ─────────────────────────────────────────────────────────────────────────────
interface ComplianceItem { type: string; name: string; priority?: string; completed: boolean; }

const TYPE_META: Record<string, { label: string; icon: React.ElementType; hint: string }> = {
  SUPPLEMENT: { label: 'Supplements', icon: Pill, hint: 'What to take today' },
  EXERCISE:   { label: 'Exercise',    icon: Dumbbell, hint: 'Scheduled for today' },
  SLEEP:      { label: 'Wind-down',   icon: Moon, hint: 'Before bed tonight' },
  NUTRITION:  { label: 'Nutrition',   icon: Apple, hint: 'Meals to hit' },
};

const TABS = [
  { id: 'today',   label: 'Today',   icon: ClipboardCheck },
  { id: 'habits',  label: 'Habits',  icon: Check },
  { id: 'awards',  label: 'Awards',  icon: Trophy },
] as const;
type TabId = typeof TABS[number]['id'];

// Custom tab pill nav — matching chat send button glow aesthetic
function TabBar({ active, onChange }: { active: TabId; onChange: (t: TabId) => void }) {
  return (
    <div className="flex gap-1.5 p-1 rounded-xl bg-surface-2 border border-card-border animate-fade-in">
      {TABS.map(t => {
        const Icon = t.icon;
        const isActive = active === t.id;
        return (
          <button
            key={t.id}
            onClick={() => onChange(t.id)}
            className={clsx('flex-1 py-2 px-3 rounded-lg text-xs font-medium transition-all flex items-center justify-center gap-1.5',
              isActive
                ? 'bg-accent text-black shadow-sm'
                : 'text-muted-foreground hover:text-foreground hover:bg-surface-3')}
          >
            <Icon className="w-3.5 h-3.5" />
            {t.label}
          </button>
        );
      })}
    </div>
  );
}

// Weekly bar (7 days)
function WeeklyBar({ data }: { data: { day: string; pct: number }[] }) {
  return (
    <div className="flex items-end gap-1.5 sm:gap-2 h-28">
      {data.map((d, i) => {
        const color = d.pct >= 85 ? 'bg-accent' : d.pct >= 60 ? 'bg-accent/70' : d.pct >= 30 ? 'bg-accent/40' : d.pct > 0 ? 'bg-accent/20' : 'bg-surface-3';
        return (
          <div key={i} className="flex-1 flex flex-col items-center gap-1.5">
            <div className="w-full flex-1 bg-surface-3 rounded-lg relative overflow-hidden">
              <div
                className={clsx('absolute bottom-0 left-0 right-0 rounded-lg transition-all duration-700', color)}
                style={{ height: `${d.pct}%` }}
                title={`${d.day}: ${d.pct}%`}
              />
              {d.pct >= 30 && (
                <span className="absolute bottom-1 left-0 right-0 text-center text-[9px] font-mono text-black/80 font-semibold">
                  {d.pct}
                </span>
              )}
            </div>
            <span className="text-[10px] text-muted">{d.day.slice(0, 1)}</span>
          </div>
        );
      })}
    </div>
  );
}

// 30-day heatmap
function Heatmap30({ data }: { data: { date: string; pct: number }[] }) {
  return (
    <div className="grid grid-cols-10 sm:grid-cols-15 gap-1">
      {data.map((d, i) => (
        <div
          key={i}
          title={`${d.date}: ${d.pct}%`}
          className={clsx('aspect-square rounded-[3px] transition-colors',
            d.pct === 0 && 'bg-surface-3',
            d.pct > 0 && d.pct < 30 && 'bg-accent/25',
            d.pct >= 30 && d.pct < 60 && 'bg-accent/50',
            d.pct >= 60 && d.pct < 90 && 'bg-accent/75',
            d.pct >= 90 && 'bg-accent',
          )}
        />
      ))}
    </div>
  );
}

// Insight callout
function InsightRow({ insight }: { insight: Insight }) {
  const toneMap = {
    positive:  { bg: 'bg-accent/5 border-accent/20',     pill: 'pill-optimal',     iconColor: 'text-accent' },
    attention: { bg: 'bg-amber-500/5 border-amber-500/20', pill: 'pill-suboptimal', iconColor: 'text-warning' },
    negative:  { bg: 'bg-red-500/5 border-red-500/20',   pill: 'pill-critical',    iconColor: 'text-danger' },
    neutral:   { bg: 'bg-surface-2 border-card-border',  pill: 'bg-surface-3 text-muted-foreground border-card-border', iconColor: 'text-muted-foreground' },
  };
  const style = toneMap[insight.tone];
  return (
    <div className={clsx('p-3.5 rounded-xl border flex gap-3 transition-colors', style.bg)}>
      <span className="text-xl leading-none shrink-0" aria-hidden>{insight.icon}</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium leading-snug">{insight.title}</p>
        {insight.detail && <p className="text-[11px] text-muted-foreground leading-relaxed mt-1">{insight.detail}</p>}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// DevicesBlock — shows the user's wearables + home equipment from onboarding,
// each as a row with the metrics that device can track. Clicking opens Smart Log.
// ═══════════════════════════════════════════════════════════════════════════

// Human-readable label for a daily_metrics column (used in device rows)
const COLUMN_LABELS: Record<string, string> = {
  sleep_hours: 'Sleep hours', sleep_score: 'Sleep score', sleep_quality: 'Sleep quality',
  deep_sleep_min: 'Deep sleep', light_sleep_min: 'Light sleep', rem_sleep_min: 'REM sleep', awake_min: 'Awake time',
  hrv: 'HRV', hrv_sleep_avg: 'HRV overnight',
  resting_hr: 'Resting HR', avg_heart_rate: 'Avg HR', min_heart_rate: 'Min HR', max_heart_rate: 'Max HR',
  blood_oxygen_avg_sleep: 'Blood O₂', skin_temp_deviation: 'Skin temp', avg_respiratory_rate: 'Respiration',
  bp_systolic_morning: 'Morning BP syst', bp_diastolic_morning: 'Morning BP dias',
  bp_systolic_evening: 'Evening BP syst', bp_diastolic_evening: 'Evening BP dias',
  steps: 'Steps', active_time_min: 'Active time', activity_calories: 'Calories burned', workout_minutes: 'Workout',
  energy_score: 'Body battery', stress_level: 'Stress', mood: 'Mood', energy: 'Energy',
  weight_kg: 'Weight', antioxidant_index: 'Antioxidants',
  // Morning-fasted measurements
  body_fat_pct: 'Body fat %', muscle_mass_kg: 'Muscle mass', visceral_fat: 'Visceral fat',
  body_water_pct: 'Body water %', bone_mass_kg: 'Bone mass', bmr_kcal: 'BMR',
  basal_body_temp_c: 'Basal body temp',
};

function DeviceRow({ icon, label, caption, columns, metrics, onOpenLog, tone = 'accent' }: {
  icon: string;
  label: string;
  caption: string;
  columns: string[];
  metrics: DailyMetrics;
  onOpenLog: () => void;
  tone?: 'accent' | 'blue' | 'amber' | 'muted';
}) {
  const shown = columns.map(c => COLUMN_LABELS[c] || c).slice(0, 6);
  const filled = columns.filter(c => {
    const v = metrics[c as keyof DailyMetrics];
    return v !== null && v !== undefined && v !== '';
  }).length;
  const border =
    tone === 'accent' ? 'border-accent/25 bg-accent/[0.04]' :
    tone === 'blue'   ? 'border-blue-500/25 bg-blue-500/[0.04]' :
    tone === 'amber'  ? 'border-amber-500/25 bg-amber-500/[0.04]' :
                        'border-card-border bg-surface-2';
  return (
    <button
      onClick={onOpenLog}
      className={clsx('w-full p-4 rounded-xl border text-left space-y-2 hover:border-accent/40 active:scale-[0.995] transition-all', border)}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2.5 min-w-0">
          <span className="text-xl shrink-0">{icon}</span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold truncate">{label}</p>
            <p className="text-[11px] text-muted-foreground leading-snug">{caption}</p>
          </div>
        </div>
        <div className="text-right shrink-0">
          <p className="text-[10px] text-muted uppercase tracking-widest">logged</p>
          <p className="text-base font-bold font-mono tabular-nums text-accent">{filled}<span className="text-xs text-muted">/{columns.length}</span></p>
        </div>
      </div>
      <div className="flex flex-wrap gap-1">
        {shown.map(s => (
          <span key={s} className="text-[9px] px-1.5 py-0.5 rounded bg-surface-3 text-muted-foreground">{s}</span>
        ))}
        {columns.length > 6 && (
          <span className="text-[9px] px-1.5 py-0.5 rounded bg-surface-3 text-muted-foreground">+{columns.length - 6} more</span>
        )}
      </div>
    </button>
  );
}

function DevicesBlock({ summary, metrics, onOpenLog }: {
  summary: UserDeviceSummary;
  metrics: DailyMetrics;
  onOpenLog: () => void;
}) {
  // Columns a wearable/ring actually covers = its own capabilities' columns
  const swColumns = summary.smartwatch
    ? Array.from(new Set(summary.smartwatch.capabilities.flatMap(c => CAPABILITY_TO_COLUMNS[c] || [])))
    : [];
  const srColumns = summary.smartRing
    ? Array.from(new Set(summary.smartRing.capabilities.flatMap(c => CAPABILITY_TO_COLUMNS[c] || [])))
    : [];

  const nothing = !summary.smartwatch && !summary.smartRing && summary.equipment.length === 0;
  if (nothing) {
    return (
      <div className="p-5 rounded-xl bg-surface-2 border border-dashed border-card-border text-center">
        <p className="text-sm font-medium">No devices yet</p>
        <p className="text-[11px] text-muted-foreground mt-1 max-w-sm mx-auto leading-relaxed">
          Add your smartwatch, smart ring, BP monitor, or scale in onboarding and they&apos;ll appear here with what they can track.
        </p>
        <a href="/onboarding" className="inline-block mt-3 text-xs text-accent hover:underline">Add devices →</a>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {summary.smartwatch && (
        <DeviceRow
          icon="⌚"
          label={summary.smartwatch.label}
          caption={`${summary.smartwatch.capabilities.length} metrics supported`}
          columns={swColumns}
          metrics={metrics}
          onOpenLog={onOpenLog}
          tone="accent"
        />
      )}
      {summary.smartRing && (
        <DeviceRow
          icon="💍"
          label={summary.smartRing.label}
          caption={`${summary.smartRing.capabilities.length} metrics supported`}
          columns={srColumns}
          metrics={metrics}
          onOpenLog={onOpenLog}
          tone="blue"
        />
      )}
      {summary.equipment.map(eq => {
        const equipCols = EQUIPMENT_TO_COLUMNS[eq.key] || [];
        if (equipCols.length === 0) return null;
        return (
          <DeviceRow
            key={eq.key}
            icon={eq.icon}
            label={eq.label}
            caption={`${equipCols.length} metric${equipCols.length === 1 ? '' : 's'} unlocked`}
            columns={equipCols}
            metrics={metrics}
            onOpenLog={onOpenLog}
            tone="amber"
          />
        );
      })}
    </div>
  );
}

// Quick log pills — inline single-tap entry for mood/sleep/weight
function QuickLogBar({ metrics, onChange }: { metrics: DailyMetrics; onChange: (u: Partial<DailyMetrics>) => void }) {
  const [weightInput, setWeightInput] = useState<string>(metrics.weight_kg ? String(metrics.weight_kg) : '');
  useEffect(() => setWeightInput(metrics.weight_kg ? String(metrics.weight_kg) : ''), [metrics.weight_kg]);

  const commitWeight = () => {
    if (weightInput === '') { onChange({ weight_kg: null }); return; }
    const n = parseFloat(weightInput);
    if (Number.isFinite(n)) onChange({ weight_kg: n });
  };

  return (
    <div className="grid grid-cols-3 gap-2">
      {/* Mood 1-10 quickpick */}
      <div className="rounded-xl bg-surface-2 border border-card-border p-3 space-y-2">
        <p className="text-[10px] text-muted uppercase tracking-widest flex items-center gap-1">😊 Mood</p>
        <div className="flex items-baseline gap-1.5">
          <span className="text-2xl font-bold font-mono tabular-nums text-accent">{metrics.mood ?? '—'}</span>
          {metrics.mood !== null && metrics.mood !== undefined && <span className="text-[10px] text-muted">/10</span>}
        </div>
        <div className="grid grid-cols-5 gap-0.5">
          {[1,2,3,4,5,6,7,8,9,10].map(n => (
            <button
              key={n}
              onClick={() => onChange({ mood: n === metrics.mood ? null : n })}
              className={clsx('h-6 rounded text-[10px] font-mono transition-all',
                metrics.mood === n ? 'bg-accent text-black font-bold'
                  : (metrics.mood ?? 0) >= n ? 'bg-accent/30 text-accent'
                  : 'bg-surface-3 text-muted hover:text-foreground')}
            >{n}</button>
          ))}
        </div>
      </div>

      {/* Sleep hours quickpick */}
      <div className="rounded-xl bg-surface-2 border border-card-border p-3 space-y-2">
        <p className="text-[10px] text-muted uppercase tracking-widest">😴 Sleep</p>
        <div className="flex items-baseline gap-1.5">
          <span className="text-2xl font-bold font-mono tabular-nums text-accent">{metrics.sleep_hours?.toFixed(1) ?? '—'}</span>
          {metrics.sleep_hours !== null && metrics.sleep_hours !== undefined && <span className="text-[10px] text-muted">h</span>}
        </div>
        <div className="grid grid-cols-4 gap-0.5">
          {[5, 6, 7, 8, 9].map(h => (
            <button
              key={h}
              onClick={() => onChange({ sleep_hours: h === metrics.sleep_hours ? null : h })}
              className={clsx('h-6 rounded text-[10px] font-mono transition-all',
                metrics.sleep_hours === h ? 'bg-accent text-black font-bold'
                  : 'bg-surface-3 text-muted hover:text-foreground')}
            >{h}h</button>
          ))}
          <input
            type="number"
            step="0.1"
            value={metrics.sleep_hours && ![5, 6, 7, 8, 9].includes(metrics.sleep_hours) ? metrics.sleep_hours : ''}
            onChange={e => onChange({ sleep_hours: e.target.value ? parseFloat(e.target.value) : null })}
            placeholder="…"
            className="h-6 w-full rounded bg-surface-3 text-[10px] font-mono text-center outline-none focus:bg-accent/20 focus:text-accent placeholder:text-muted/60"
          />
        </div>
      </div>

      {/* Weight inline input */}
      <div className="rounded-xl bg-surface-2 border border-card-border p-3 space-y-2">
        <p className="text-[10px] text-muted uppercase tracking-widest">⚖️ Weight</p>
        <div className="flex items-baseline gap-1.5">
          <input
            type="number"
            step="0.1"
            value={weightInput}
            onChange={e => setWeightInput(e.target.value)}
            onBlur={commitWeight}
            onKeyDown={e => { if (e.key === 'Enter') { e.currentTarget.blur(); } }}
            placeholder="—"
            className="text-2xl font-bold font-mono tabular-nums text-accent bg-transparent outline-none w-20 tracking-tight"
          />
          <span className="text-[10px] text-muted">kg</span>
        </div>
        <p className="text-[10px] text-muted-foreground">Morning, no clothes</p>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────────────────────
export default function TrackingPage() {
  // Retroactive logging: user can switch to any day in the past 7 to log what they missed
  const todayIso = new Date().toISOString().split('T')[0];
  const [date, setDate] = useState(todayIso);
  const [activeTab, setActiveTab] = useState<TabId>('today');
  const [items, setItems] = useState<ComplianceItem[]>([]);
  const [smartLogOpen, setSmartLogOpen] = useState(false);

  // Build last-7-days option list for the date picker (labels + ISO dates)
  const recentDates = useMemo(() => {
    const out: { iso: string; label: string; isToday: boolean }[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const iso = d.toISOString().split('T')[0];
      const isToday = i === 0;
      const label = isToday
        ? 'Today'
        : i === 1 ? 'Yesterday'
        : d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
      out.push({ iso, label, isToday });
    }
    return out;
  }, []);
  const isRetroactive = date !== todayIso;

  // SWR data sources — all deduped + cached across routes
  const { data: myData, isLoading: loadingMy } = useMyData();

  // Device summary — drives source badges in SmartLogSheet + new DeviceQuickLog block.
  // Memoized against onboarding_data so we don't rebuild on unrelated re-renders.
  const deviceSummary: UserDeviceSummary = useMemo(() => {
    const od = (myData?.profile?.onboarding_data || {}) as Record<string, unknown>;
    return summarizeUserDevices(od);
  }, [myData?.profile?.onboarding_data]);
  const deviceSources = useMemo(() => {
    // Convert Set keys → plain Record for passing into the Sheet
    const obj: Record<string, string[]> = {};
    for (const col of Array.from(deviceSummary.columns)) {
      obj[col] = deviceSummary.sources[col] || [];
    }
    return obj;
  }, [deviceSummary]);
  const { data: compToday } = useComplianceToday(date);
  const thirtyDaysAgoStr = useMemo(() => { const d = new Date(); d.setDate(d.getDate() - 30); return d.toISOString().split('T')[0]; }, []);
  const { data: compHistoryData } = useComplianceHistory(thirtyDaysAgoStr, date);

  const history = useMemo(() => (compHistoryData?.history ?? []) as ComplianceEntry[], [compHistoryData]);
  const protocolId = myData?.protocol?.id ?? '';
  const bloodTestsCount = (myData?.bloodTests?.length) ?? 0;
  const protocolsCount = myData?.protocol ? 1 : 0;
  const agingPace = myData?.protocol?.aging_pace ?? null;
  const longevityScore = myData?.protocol?.longevity_score ?? null;
  const loading = loadingMy;

  // Current hour-based label + subtitle for the smart log CTA
  const bucketInfo = useMemo(() => {
    const h = new Date().getHours();
    if (h >= 5 && h < 11)  return { label: 'Log morning metrics',  sub: 'Last night\'s sleep, HRV, morning BP, wake-up vitals' };
    if (h >= 11 && h < 17) return { label: 'Log midday check-in',  sub: 'Activity so far, HR ranges, current mood/energy' };
    if (h >= 17 && h < 23) return { label: 'Log evening recap',    sub: 'Full-day totals, evening BP, antioxidant & AGEs indices' };
    return { label: 'Log before bed', sub: 'Quick wind-down — tomorrow\'s sleep intention' };
  }, []);

  const { metrics: todayMetrics, save: saveMetrics } = useDailyMetrics(date);
  const { metrics: rangeMetrics } = useDailyMetricsRange(thirtyDaysAgoStr, date);

  // Build compliance checklist whenever protocol or today's logs change
  useEffect(() => {
    const protocol = myData?.protocol?.protocol_json as Record<string, unknown> | undefined;
    if (!protocol) { setItems([]); return; }

    const completedSet = new Set(
      (compToday?.logs ?? []).filter(l => l.completed).map(l => `${l.item_type}::${l.item_name}`)
    );

    const allItems: ComplianceItem[] = [];
    const supps = protocol.supplements as Array<{ name: string; priority?: string }> | undefined;
    if (supps) supps.forEach(s => {
      allItems.push({ type: 'SUPPLEMENT', name: s.name, priority: s.priority, completed: completedSet.has(`SUPPLEMENT::${s.name}`) });
    });

    const exercise = protocol.exercise as { weeklyPlan?: Array<{ day: string; activity: string }> } | undefined;
    if (exercise?.weeklyPlan) {
      const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      const selectedDayName = dayNames[new Date(date + 'T12:00:00').getDay()];
      exercise.weeklyPlan
        .filter(d => d.day?.toLowerCase() === selectedDayName.toLowerCase())
        .forEach(d => {
          allItems.push({ type: 'EXERCISE', name: d.activity, completed: completedSet.has(`EXERCISE::${d.activity}`) });
        });
    }

    const sleep = protocol.sleep as { windDownRoutine?: Array<string | { action: string }> } | undefined;
    if (sleep?.windDownRoutine) sleep.windDownRoutine.forEach(s => {
      const name = typeof s === 'string' ? s : s.action;
      allItems.push({ type: 'SLEEP', name, completed: completedSet.has(`SLEEP::${name}`) });
    });

    const nutrition = protocol.nutrition as { meals?: Array<{ name: string }> } | undefined;
    if (nutrition?.meals) nutrition.meals.forEach(m => {
      allItems.push({ type: 'NUTRITION', name: m.name, completed: completedSet.has(`NUTRITION::${m.name}`) });
    });

    setItems(allItems);
  }, [myData, compToday, date]);

  const toggleCompliance = useCallback(async (index: number) => {
    const item = items[index];
    const newCompleted = !item.completed;
    // Optimistic local toggle — UI flips instantly
    setItems(prev => prev.map((it, i) => i === index ? { ...it, completed: newCompleted } : it));
    await fetch('/api/compliance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ itemType: item.type, itemName: item.name, date, completed: newCompleted, protocolId }),
    });
    // Revalidate compliance caches in the background so streak/history stay fresh
    invalidate.compliance();
  }, [items, date, protocolId]);

  const toggleHabit = useCallback((habitId: string) => {
    const current = todayMetrics.habits_completed ?? [];
    const updated = current.includes(habitId) ? current.filter(h => h !== habitId) : [...current, habitId];
    saveMetrics({ habits_completed: updated });
  }, [todayMetrics.habits_completed, saveMetrics]);

  // Loading skeleton
  if (loading) return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 space-y-4">
      {[1, 2, 3].map(i => (
        <div key={i} className="glass-card rounded-2xl p-6 animate-pulse">
          <div className="h-6 w-48 bg-surface-3 rounded mb-3" />
          <div className="h-4 w-full bg-surface-3 rounded mb-2" />
          <div className="h-20 w-full bg-surface-3 rounded-xl" />
        </div>
      ))}
    </div>
  );

  // Derived stats
  const completed = items.filter(i => i.completed).length;
  const total = items.length;
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
  const streak = calculateStreak(history);
  const longestStreak = calculateLongestStreak(history);
  const perfectDays = countPerfectDays(history);
  const weekData = getWeeklyData(history);
  const monthData = getMonthlyHeatmap(history);
  const monthlyAvg = calculateMonthlyAverage(history);
  const metricsArr = (rangeMetrics || []) as DailyMetrics[];
  const workoutStreak = currentWorkoutStreak(metricsArr);
  const daysLogged7 = loggedDaysInLastN(metricsArr, 7);
  const insights = buildInsights(metricsArr, [], {
    agingPace,
    longevityScore,
    biologicalAge: null,
  });

  // Group + sort items (MUST first)
  const priorityRank = (p?: string) => (p === 'MUST' ? 0 : p === 'STRONG' ? 1 : p === 'OPTIONAL' ? 2 : 3);
  const grouped = items.reduce<Record<string, ComplianceItem[]>>((acc, item) => {
    (acc[item.type] = acc[item.type] || []).push(item); return acc;
  }, {});
  Object.keys(grouped).forEach(k => grouped[k].sort((a, b) => priorityRank(a.priority) - priorityRank(b.priority)));

  // Day label (uses selected `date`, not necessarily today)
  const selectedDate = new Date(date + 'T12:00:00');
  const weekday = selectedDate.toLocaleDateString('en-US', { weekday: 'long' });
  const dateStr = selectedDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric' });

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-5">
      {/* ═══════════ PAGE HEADER ═══════════ */}
      <div className="flex items-end justify-between gap-4 animate-fade-in flex-wrap">
        <div>
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">Daily Tracking</h1>
          <p className="text-sm text-muted-foreground mt-1">{weekday} · {dateStr}</p>
        </div>
        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none max-w-full">
          {recentDates.map(d => (
            <button
              key={d.iso}
              onClick={() => setDate(d.iso)}
              className={clsx('shrink-0 px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-colors whitespace-nowrap',
                date === d.iso
                  ? 'bg-accent text-black'
                  : 'bg-surface-2 border border-card-border text-muted-foreground hover:text-foreground hover:bg-surface-3')}
            >
              {d.label}
            </button>
          ))}
        </div>
      </div>

      {/* Retroactive logging banner */}
      {isRetroactive && (
        <div className="flex items-center gap-3 p-3.5 rounded-xl bg-amber-500/5 border border-amber-500/20 animate-fade-in">
          <AlertCircle className="w-4 h-4 text-warning shrink-0" />
          <p className="text-[11px] sm:text-xs leading-relaxed">
            <span className="text-warning font-medium">Logging retroactively for {weekday}.</span>{' '}
            <span className="text-muted-foreground">Be honest — the protocol adapts to real adherence, not wishful ticks.</span>
          </p>
          <button
            onClick={() => setDate(todayIso)}
            className="ml-auto shrink-0 text-[11px] text-accent hover:underline"
          >
            Back to today
          </button>
        </div>
      )}

      {/* ═══════════ HERO: SMART LOG + TODAY'S PROGRESS ═══════════ */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
        {/* Smart log CTA */}
        <button
          onClick={() => setSmartLogOpen(true)}
          className="md:col-span-3 hero-card rounded-2xl p-5 sm:p-6 flex items-center gap-4 hover:border-accent/40 transition-all group animate-fade-in-up text-left relative overflow-hidden"
        >
          <div className="w-12 h-12 rounded-xl bg-accent/15 border border-accent/25 flex items-center justify-center shrink-0 group-hover:bg-accent/25 group-hover:scale-105 transition-all">
            <Sparkles className="w-5 h-5 text-accent" />
          </div>
          <div className="text-left flex-1 min-w-0">
            <p className="text-sm sm:text-base font-semibold tracking-tight">{bucketInfo.label}</p>
            <p className="text-[11px] sm:text-xs text-muted-foreground mt-1 leading-relaxed">{bucketInfo.sub}</p>
          </div>
          <div className="text-accent text-lg shrink-0 group-hover:translate-x-1 transition-transform">→</div>
        </button>

        {/* Today's completion ring */}
        <div className="md:col-span-2 metric-tile flex items-center gap-4 animate-fade-in-up">
          <div className="relative shrink-0">
            <ProgressRing value={pct} size={72} stroke={6} />
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-sm font-bold font-mono text-accent">{pct}%</span>
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] text-muted uppercase tracking-widest">Today's plan</p>
            <p className="text-xl font-bold font-mono tabular-nums mt-1">{completed}<span className="text-muted text-base">/{total}</span></p>
            <p className="text-[10px] text-muted-foreground mt-1">30-day avg {monthlyAvg}%</p>
          </div>
        </div>
      </div>

      {/* ═══════════ QUICK PULSE — 4 STAT TILES ═══════════ */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 animate-fade-in-up">
        <Stat
          label="Streak"
          value={<span className="flex items-center gap-1.5"><Flame className={clsx('w-5 h-5', streak > 0 ? 'text-orange-400' : 'text-muted')} />{streak}</span>}
          subtext={<span className="text-muted-foreground">{longestStreak > streak ? `longest ${longestStreak}d` : 'keep going'}</span>}
          tone={streak > 0 ? 'accent' : 'default'}
        />
        <Stat
          label="Perfect days"
          value={perfectDays}
          subtext={<span className="text-muted-foreground">100% days</span>}
          tone="accent"
        />
        <Stat
          label="Workout streak"
          value={workoutStreak}
          subtext={<span className="text-muted-foreground">days in a row</span>}
          tone={workoutStreak >= 3 ? 'accent' : 'default'}
        />
        <Stat
          label="Logged days"
          value={`${daysLogged7}/7`}
          subtext={<span className="text-muted-foreground">this week</span>}
          tone={daysLogged7 >= 5 ? 'accent' : daysLogged7 >= 3 ? 'default' : 'warning'}
        />
      </div>

      {/* ═══════════ YOUR DEVICES — everything you can measure ═══════════ */}
      <Section icon={Watch} title="Your devices" subtitle="Each device shows the metrics it can track. Tap a row to log them.">
        <DevicesBlock summary={deviceSummary} metrics={todayMetrics as DailyMetrics} onOpenLog={() => setSmartLogOpen(true)} />
      </Section>

      {/* ═══════════ QUICK LOG BAR ═══════════ */}
      <Section icon={TrendingUp} title="Quick log" subtitle="One-tap entry for your most-logged metrics">
        <QuickLogBar metrics={todayMetrics as DailyMetrics} onChange={saveMetrics} />
        <p className="text-[11px] text-muted-foreground text-center">
          Tap a number to log or clear. Saves automatically. Want everything else (sleep stages, BP, HRV, O₂)? Use <span className="text-accent">Smart Log</span> above.
        </p>
      </Section>

      {/* ═══════════ INSIGHTS ═══════════ */}
      {insights.length > 0 && (
        <Section icon={Lightbulb} title="Insights" subtitle="Patterns we spotted in your recent data">
          <div className="space-y-2">
            {insights.map((ins, i) => <InsightRow key={i} insight={ins} />)}
          </div>
        </Section>
      )}

      {/* ═══════════ TABS ═══════════ */}
      <TabBar active={activeTab} onChange={setActiveTab} />

      {/* ═══════════ TAB CONTENT ═══════════ */}
      {activeTab === 'today' && (
        <>
          {/* Weekly bar */}
          <Section icon={TrendingUp} title="This week" subtitle="Daily protocol completion">
            <WeeklyBar data={weekData} />
          </Section>

          {/* 30-day heatmap */}
          <Section icon={ClipboardCheck} title="Last 30 days" subtitle={`Averaged ${monthlyAvg}% completion`}>
            <Heatmap30 data={monthData} />
            <div className="flex items-center justify-end gap-2 mt-3 text-[9px] text-muted">
              Less
              <div className="flex gap-0.5">
                <div className="w-2.5 h-2.5 rounded-[2px] bg-surface-3" />
                <div className="w-2.5 h-2.5 rounded-[2px] bg-accent/25" />
                <div className="w-2.5 h-2.5 rounded-[2px] bg-accent/50" />
                <div className="w-2.5 h-2.5 rounded-[2px] bg-accent/75" />
                <div className="w-2.5 h-2.5 rounded-[2px] bg-accent" />
              </div>
              More
            </div>
          </Section>

          {/* Protocol checklist per type */}
          {items.length === 0 ? (
            <Section icon={AlertCircle} title="No protocol yet" subtitle="Complete onboarding to see your daily checklist">
              <a href="/onboarding" className="inline-block px-5 py-2.5 rounded-xl bg-accent text-black text-sm font-semibold hover:bg-accent-bright transition-colors">Generate protocol</a>
            </Section>
          ) : (
            Object.entries(grouped).map(([type, typeItems]) => {
              const meta = TYPE_META[type] || { label: type, icon: Check, hint: '' };
              const Icon = meta.icon;
              const doneCount = typeItems.filter(i => i.completed).length;
              return (
                <Section
                  key={type}
                  icon={Icon}
                  title={meta.label}
                  subtitle={meta.hint}
                  action={
                    <span className="text-xs font-mono text-muted tabular-nums">{doneCount}/{typeItems.length}</span>
                  }
                >
                  <div className="space-y-1">
                    {typeItems.map((item) => {
                      const globalIndex = items.indexOf(item);
                      const prio = item.priority;
                      const pillTone = prio === 'MUST' ? 'pill-critical' : prio === 'STRONG' ? 'pill-suboptimal' : null;
                      return (
                        <button
                          key={`${item.type}::${item.name}`}
                          onClick={() => toggleCompliance(globalIndex)}
                          className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-surface-2 active:bg-surface-3 transition-colors text-left group"
                        >
                          <div className={clsx('w-6 h-6 rounded-lg border-2 flex items-center justify-center shrink-0 transition-all',
                            item.completed ? 'bg-accent border-accent' : 'border-card-border group-hover:border-accent/40')}>
                            {item.completed && <Check className="w-4 h-4 text-black" strokeWidth={3} />}
                          </div>
                          <span className={clsx('flex-1 text-sm transition-colors leading-snug',
                            item.completed ? 'text-muted line-through' : 'text-foreground')}>
                            {item.name}
                          </span>
                          {pillTone && !item.completed && (
                            <span className={clsx('text-[9px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full border shrink-0', pillTone)}>
                              {prio}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </Section>
              );
            })
          )}
        </>
      )}

      {activeTab === 'habits' && (
        <Section icon={Check} title="Daily habits" subtitle="Longevity habits beyond the protocol checklist">
          <HabitsTab completed={todayMetrics.habits_completed ?? []} onToggle={toggleHabit} />
        </Section>
      )}

      {activeTab === 'awards' && (() => {
        const earnedIds = new Set(checkAchievements({
          totalDaysTracked: history.filter(h => h.total > 0).length,
          currentStreak: streak, longestStreak, perfectDays,
          bloodTestsUploaded: bloodTestsCount, protocolsGenerated: protocolsCount,
          supplementStreak: streak, weeklyCompliance: pct, monthlyAvgCompliance: monthlyAvg,
        }).map(a => a.id));
        const earned = ACHIEVEMENTS.filter(a => earnedIds.has(a.id));
        const locked = ACHIEVEMENTS.filter(a => !earnedIds.has(a.id));
        return (
          <>
            <Section icon={Trophy} title="Earned" subtitle={`${earned.length} of ${ACHIEVEMENTS.length} unlocked`}>
              {earned.length === 0 ? (
                <p className="text-xs text-muted-foreground">No awards yet — keep logging and they'll start rolling in.</p>
              ) : (
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                  {earned.map(a => (
                    <button
                      key={a.id}
                      title={`${a.description} — click to share`}
                      onClick={() => {
                        const text = `🏆 Just unlocked "${a.name}" on Protocol — ${a.description}`;
                        const url = 'https://protocol-tawny.vercel.app';
                        const nav = typeof navigator !== 'undefined' ? navigator : null;
                        if (nav && typeof nav.share === 'function') {
                          nav.share({ title: 'Protocol achievement', text, url }).catch(() => {});
                        } else if (nav?.clipboard) {
                          nav.clipboard.writeText(`${text} ${url}`);
                        }
                      }}
                      className={clsx('aspect-square rounded-xl border flex flex-col items-center justify-center gap-1 p-2 transition-transform hover:scale-105 cursor-pointer relative group',
                        a.tier === 'legendary' ? 'bg-amber-500/10 border-amber-500/30' :
                        a.tier === 'gold' ? 'bg-accent/10 border-accent/30' :
                        a.tier === 'silver' ? 'bg-surface-2 border-card-border' :
                        'bg-surface-2 border-card-border')}
                    >
                      <span className="text-2xl">{a.icon}</span>
                      <span className="text-[9px] text-center leading-tight text-foreground/90 font-medium">{a.name}</span>
                      <span className="absolute top-1 right-1 text-[9px] text-muted opacity-0 group-hover:opacity-100 transition-opacity">share</span>
                    </button>
                  ))}
                </div>
              )}
            </Section>

            <Section icon={Trophy} title="Locked" subtitle={`${locked.length} awards to chase`}>
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                {locked.map(a => (
                  <div
                    key={a.id}
                    title={a.description}
                    className="aspect-square rounded-xl border border-card-border bg-surface-2/50 flex flex-col items-center justify-center gap-1 p-2 opacity-40 hover:opacity-70 transition-opacity"
                  >
                    <span className="text-2xl grayscale">{a.icon}</span>
                    <span className="text-[9px] text-center leading-tight text-muted font-medium">{a.name}</span>
                  </div>
                ))}
              </div>
            </Section>
          </>
        );
      })()}

      {/* Smart Log sheet */}
      <SmartLogSheet
        open={smartLogOpen}
        onClose={() => setSmartLogOpen(false)}
        metrics={todayMetrics as DailyMetrics}
        onSave={(updates) => saveMetrics(updates)}
        deviceSources={deviceSources}
      />

      <p className="text-[11px] text-center text-muted pt-2">
        Daily averages feed into tomorrow&apos;s protocol regeneration (3 AM Romania).
      </p>
    </div>
  );
}
