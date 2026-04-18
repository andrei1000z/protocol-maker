'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useMyData, useComplianceToday, useComplianceHistory, invalidate } from '@/lib/hooks/useApiData';
import clsx from 'clsx';
import {
  Check, Pill, Dumbbell, Moon, Apple, Flame, Sparkles, ClipboardCheck, Trophy,
  TrendingUp, AlertCircle, Lightbulb,
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

// ─────────────────────────────────────────────────────────────────────────────
// Shared UI primitives (matching settings/history/stats/chat)
// ─────────────────────────────────────────────────────────────────────────────
function Section({ icon: Icon, title, subtitle, action, children, className }: {
  icon: React.ElementType; title: string; subtitle?: string; action?: React.ReactNode; children: React.ReactNode; className?: string;
}) {
  return (
    <div className={clsx('glass-card rounded-2xl p-5 sm:p-6 space-y-4 animate-fade-in-up', className)}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-accent/10 border border-accent/20 flex items-center justify-center shrink-0">
            <Icon className="w-4 h-4 text-accent" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-base sm:text-lg font-semibold tracking-tight">{title}</h2>
            {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
          </div>
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
      {children}
    </div>
  );
}

function Stat({ label, value, subtext, tone = 'default' }: {
  label: string; value: React.ReactNode; subtext?: React.ReactNode;
  tone?: 'default' | 'accent' | 'danger' | 'warning';
}) {
  const color = tone === 'accent' ? 'text-accent' : tone === 'danger' ? 'text-danger' : tone === 'warning' ? 'text-warning' : 'text-foreground';
  return (
    <div className="metric-tile">
      <p className="text-[10px] text-muted uppercase tracking-widest">{label}</p>
      <p className={clsx('text-2xl sm:text-3xl font-bold font-mono tabular-nums mt-2 leading-none', color)}>{value}</p>
      {subtext && <div className="mt-2 text-[11px]">{subtext}</div>}
    </div>
  );
}

// Progress ring matching dashboard version
function ProgressRing({ value, size = 64, stroke = 6 }: { value: number; size?: number; stroke?: number }) {
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (value / 100) * circumference;
  return (
    <svg className="progress-ring" width={size} height={size}>
      <circle cx={size / 2} cy={size / 2} r={radius} strokeWidth={stroke} fill="none" className="progress-ring-bg" />
      <circle
        cx={size / 2} cy={size / 2} r={radius} strokeWidth={stroke} fill="none"
        stroke="var(--accent)" strokeLinecap="round"
        strokeDasharray={circumference} strokeDashoffset={offset}
        style={{ transition: 'stroke-dashoffset 0.8s cubic-bezier(0.4, 0, 0.2, 1)' }}
      />
    </svg>
  );
}

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
  const [date] = useState(new Date().toISOString().split('T')[0]);
  const [activeTab, setActiveTab] = useState<TabId>('today');
  const [items, setItems] = useState<ComplianceItem[]>([]);
  const [smartLogOpen, setSmartLogOpen] = useState(false);

  // SWR data sources — all deduped + cached across routes
  const { data: myData, isLoading: loadingMy } = useMyData();
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
      const today = dayNames[new Date().getDay()];
      exercise.weeklyPlan
        .filter(d => d.day?.toLowerCase() === today.toLowerCase())
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
  }, [myData, compToday]);

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

  // Today's day label
  const today = new Date();
  const weekday = today.toLocaleDateString('en-US', { weekday: 'long' });
  const dateStr = today.toLocaleDateString('en-US', { month: 'long', day: 'numeric' });

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-5">
      {/* ═══════════ PAGE HEADER ═══════════ */}
      <div className="flex items-end justify-between gap-4 animate-fade-in">
        <div>
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">Daily Tracking</h1>
          <p className="text-sm text-muted-foreground mt-1">{weekday} · {dateStr}</p>
        </div>
      </div>

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
                    <div
                      key={a.id}
                      title={a.description}
                      className={clsx('aspect-square rounded-xl border flex flex-col items-center justify-center gap-1 p-2 transition-transform hover:scale-105',
                        a.tier === 'legendary' ? 'bg-amber-500/10 border-amber-500/30' :
                        a.tier === 'gold' ? 'bg-accent/10 border-accent/30' :
                        a.tier === 'silver' ? 'bg-surface-2 border-card-border' :
                        'bg-surface-2 border-card-border')}
                    >
                      <span className="text-2xl">{a.icon}</span>
                      <span className="text-[9px] text-center leading-tight text-foreground/90 font-medium">{a.name}</span>
                    </div>
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
      />

      <p className="text-[11px] text-center text-muted pt-2">
        Daily averages feed into tomorrow&apos;s protocol regeneration (3 AM Romania).
      </p>
    </div>
  );
}
