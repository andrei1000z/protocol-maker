'use client';

import { useEffect, useState, useCallback } from 'react';
import clsx from 'clsx';
import { Check, Pill, Dumbbell, Moon, Apple, Flame, TrendingUp } from 'lucide-react';
import { ACHIEVEMENTS, checkAchievements } from '@/lib/engine/achievements';
import {
  calculateStreak, calculateLongestStreak, countPerfectDays,
  getWeeklyData, getMonthlyHeatmap, calculateMonthlyAverage,
  ComplianceEntry,
} from '@/lib/utils/streak';
import { TabNav } from '@/components/tracking/Tabs';
import { HabitsTab } from '@/components/tracking/HabitsTab';
import { MetricsTab } from '@/components/tracking/MetricsTab';
import { TrendsTab } from '@/components/tracking/TrendsTab';
import { SmartLogSheet } from '@/components/tracking/SmartLogSheet';
import { useDailyMetrics, useDailyMetricsRange, DailyMetrics } from '@/lib/hooks/useDailyMetrics';
import { Sparkles } from 'lucide-react';

interface ComplianceItem { type: string; name: string; completed: boolean; }

const ICONS: Record<string, React.ReactNode> = {
  SUPPLEMENT: <Pill className="w-4 h-4" />,
  EXERCISE: <Dumbbell className="w-4 h-4" />,
  SLEEP: <Moon className="w-4 h-4" />,
  NUTRITION: <Apple className="w-4 h-4" />,
};

const TABS = [
  { id: 'protocol', label: 'Protocol', icon: '📋' },
  { id: 'habits', label: 'Habits', icon: '✅' },
  { id: 'metrics', label: 'Metrics', icon: '📊' },
  { id: 'trends', label: 'Trends', icon: '📈' },
  { id: 'achievements', label: 'Awards', icon: '🏆' },
];

function StreakCounter({ streak, longest }: { streak: number; longest: number }) {
  return (
    <div className="flex flex-col items-center justify-center gap-1 py-3 px-4 rounded-2xl bg-card border border-card-border">
      <div className="flex items-center gap-2">
        <Flame className={clsx('w-6 h-6', streak > 0 ? 'text-orange-400' : 'text-muted')} />
        <span className="text-2xl font-bold font-mono text-accent">{streak}</span>
        <span className="text-xs text-muted-foreground">day streak</span>
      </div>
      {longest > streak && <span className="text-[10px] text-muted">Longest: {longest} days</span>}
    </div>
  );
}

function WeeklyChart({ data }: { data: { day: string; pct: number }[] }) {
  return (
    <div className="rounded-2xl bg-card border border-card-border p-4">
      <div className="flex items-center gap-2 mb-3">
        <TrendingUp className="w-4 h-4 text-accent" />
        <h3 className="text-sm font-semibold">This Week</h3>
      </div>
      <div className="flex items-end gap-1.5 h-24">
        {data.map((d, i) => (
          <div key={i} className="flex-1 flex flex-col items-center gap-1">
            <div className="w-full bg-card-border rounded-t-md relative" style={{ height: '80px' }}>
              <div className={clsx('absolute bottom-0 left-0 right-0 rounded-t-md transition-all',
                d.pct > 80 ? 'bg-accent' : d.pct > 50 ? 'bg-accent/60' : d.pct > 0 ? 'bg-accent/30' : 'bg-card-border')}
                style={{ height: `${d.pct}%` }} />
            </div>
            <span className="text-[9px] text-muted">{d.day}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function MonthlyHeatmap({ data }: { data: { date: string; pct: number }[] }) {
  return (
    <div className="rounded-2xl bg-card border border-card-border p-4">
      <h3 className="text-sm font-semibold mb-3">Last 30 Days</h3>
      <div className="grid grid-cols-10 gap-1">
        {data.map((d, i) => (
          <div key={i} title={`${d.date}: ${d.pct}%`}
            className={clsx('aspect-square rounded-sm transition-colors',
              d.pct === 0 && 'bg-card-border/30',
              d.pct > 0 && d.pct < 30 && 'bg-accent/20',
              d.pct >= 30 && d.pct < 60 && 'bg-accent/40',
              d.pct >= 60 && d.pct < 90 && 'bg-accent/60',
              d.pct >= 90 && 'bg-accent',
            )} />
        ))}
      </div>
    </div>
  );
}

export default function TrackingPage() {
  const [date] = useState(new Date().toISOString().split('T')[0]);
  const [activeTab, setActiveTab] = useState('protocol');
  const [items, setItems] = useState<ComplianceItem[]>([]);
  const [protocolId, setProtocolId] = useState('');
  const [loading, setLoading] = useState(true);
  const [history, setHistory] = useState<ComplianceEntry[]>([]);
  const [bloodTestsCount, setBloodTestsCount] = useState(0);
  const [protocolsCount, setProtocolsCount] = useState(0);
  const [smartLogOpen, setSmartLogOpen] = useState(false);

  // Time-aware button label
  const bucketLabel = (() => {
    const h = new Date().getHours();
    if (h >= 5 && h < 11) return 'Log morning metrics';
    if (h >= 11 && h < 17) return 'Log midday check-in';
    if (h >= 17 && h < 23) return 'Log evening recap';
    return 'Log before bed';
  })();

  const thirtyDaysAgo = (() => { const d = new Date(); d.setDate(d.getDate() - 30); return d.toISOString().split('T')[0]; })();
  const { metrics: todayMetrics, save: saveMetrics } = useDailyMetrics(date);
  const { metrics: rangeMetrics } = useDailyMetricsRange(thirtyDaysAgo, date);

  useEffect(() => {
    async function load() {
      const startDate = thirtyDaysAgo;
      const [dataRes, compTodayRes, historyRes] = await Promise.all([
        fetch('/api/my-data').then(r => r.json()),
        fetch(`/api/compliance?date=${date}`).then(r => r.json()),
        fetch(`/api/compliance/history?startDate=${startDate}&endDate=${date}`).then(r => r.json()),
      ]);

      if (!dataRes.protocol) { setLoading(false); return; }

      setProtocolId(dataRes.protocol.id);
      setBloodTestsCount((dataRes.bloodTests || []).length);
      setProtocolsCount(dataRes.protocol ? 1 : 0);
      setHistory(historyRes.history || []);

      const protocol = dataRes.protocol.protocol_json;
      const completedSet = new Set(
        (compTodayRes.logs || []).filter((l: { completed: boolean }) => l.completed)
          .map((l: { item_type: string; item_name: string }) => `${l.item_type}::${l.item_name}`)
      );

      const allItems: ComplianceItem[] = [];
      if (protocol.supplements) {
        protocol.supplements.forEach((s: { name: string }) => {
          allItems.push({ type: 'SUPPLEMENT', name: s.name, completed: completedSet.has(`SUPPLEMENT::${s.name}`) });
        });
      }
      if (protocol.exercise?.weeklyPlan) {
        const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const today = dayNames[new Date().getDay()];
        protocol.exercise.weeklyPlan
          .filter((d: { day: string }) => d.day?.toLowerCase() === today.toLowerCase())
          .forEach((d: { activity: string }) => {
            allItems.push({ type: 'EXERCISE', name: d.activity, completed: completedSet.has(`EXERCISE::${d.activity}`) });
          });
      }
      if (protocol.sleep?.windDownRoutine) {
        protocol.sleep.windDownRoutine.forEach((s: string | { action: string }) => {
          const name = typeof s === 'string' ? s : s.action;
          allItems.push({ type: 'SLEEP', name, completed: completedSet.has(`SLEEP::${name}`) });
        });
      }
      if (protocol.nutrition?.meals) {
        protocol.nutrition.meals.forEach((m: { name: string }) => {
          allItems.push({ type: 'NUTRITION', name: m.name, completed: completedSet.has(`NUTRITION::${m.name}`) });
        });
      }

      setItems(allItems);
      setLoading(false);
    }
    load();
  }, [date, thirtyDaysAgo]);

  const toggleCompliance = useCallback(async (index: number) => {
    const item = items[index];
    const newCompleted = !item.completed;
    setItems(prev => prev.map((it, i) => i === index ? { ...it, completed: newCompleted } : it));
    await fetch('/api/compliance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ itemType: item.type, itemName: item.name, date, completed: newCompleted, protocolId }),
    });
    setHistory(prev => {
      const todayCompleted = items.filter((it, i) => i === index ? newCompleted : it.completed).length;
      const total = items.length;
      const pct = total > 0 ? Math.round((todayCompleted / total) * 100) : 0;
      const existing = prev.find(h => h.date === date);
      if (existing) return prev.map(h => h.date === date ? { ...h, completed: todayCompleted, total, pct } : h);
      return [...prev, { date, completed: todayCompleted, total, pct }];
    });
  }, [items, date, protocolId]);

  const toggleHabit = useCallback((habitId: string) => {
    const current = todayMetrics.habits_completed ?? [];
    const updated = current.includes(habitId) ? current.filter(h => h !== habitId) : [...current, habitId];
    saveMetrics({ habits_completed: updated });
  }, [todayMetrics.habits_completed, saveMetrics]);

  if (loading) return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">
      <div className="h-7 w-40 mx-auto rounded-lg bg-card-border/30 animate-pulse" />
      <div className="grid grid-cols-2 gap-3"><div className="h-24 rounded-2xl bg-card animate-pulse" /><div className="h-24 rounded-2xl bg-card animate-pulse" /></div>
      <div className="h-32 rounded-2xl bg-card animate-pulse" />
    </div>
  );

  const completed = items.filter(i => i.completed).length;
  const total = items.length;
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;

  const streak = calculateStreak(history);
  const longestStreak = calculateLongestStreak(history);
  const perfectDays = countPerfectDays(history);
  const weekData = getWeeklyData(history);
  const monthData = getMonthlyHeatmap(history);
  const monthlyAvg = calculateMonthlyAverage(history);

  const grouped = items.reduce<Record<string, ComplianceItem[]>>((acc, item) => {
    (acc[item.type] = acc[item.type] || []).push(item); return acc;
  }, {});
  const TYPE_LABELS: Record<string, string> = { SUPPLEMENT: 'Supplements', EXERCISE: 'Exercise', SLEEP: 'Sleep', NUTRITION: 'Nutrition' };

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
      <div className="text-center space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">Daily Tracking</h1>
        <p className="text-sm text-muted-foreground">{new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</p>
      </div>

      {/* Smart log — big time-aware button */}
      <button
        onClick={() => setSmartLogOpen(true)}
        className="w-full rounded-2xl hero-card border border-accent/30 p-5 flex items-center gap-4 hover:border-accent/50 transition-all group animate-fade-in-up"
      >
        <div className="w-12 h-12 rounded-xl bg-accent/15 flex items-center justify-center shrink-0 group-hover:bg-accent/20 transition-colors">
          <Sparkles className="w-6 h-6 text-accent" />
        </div>
        <div className="text-left flex-1 min-w-0">
          <p className="text-sm font-semibold tracking-tight">{bucketLabel}</p>
          <p className="text-xs text-muted-foreground mt-0.5 truncate">Tap to log whatever your watch + body reported — we only show fields relevant to right now.</p>
        </div>
        <div className="text-xs text-accent font-mono pr-1">→</div>
      </button>

      <SmartLogSheet
        open={smartLogOpen}
        onClose={() => setSmartLogOpen(false)}
        metrics={todayMetrics as DailyMetrics}
        onSave={(updates) => saveMetrics(updates)}
      />

      {/* Top stats always visible */}
      <div className="grid grid-cols-2 gap-3">
        <StreakCounter streak={streak} longest={longestStreak} />
        <div className="flex items-center justify-center py-3 px-4 rounded-2xl bg-card border border-card-border">
          <div className="relative w-16 h-16">
            <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="42" fill="none" stroke="#1a1a1a" strokeWidth="8" />
              <circle cx="50" cy="50" r="42" fill="none" stroke="#00ff88" strokeWidth="8"
                strokeDasharray={`${2 * Math.PI * 42}`} strokeDashoffset={`${2 * Math.PI * 42 * (1 - pct / 100)}`}
                strokeLinecap="round" className="transition-all duration-500" />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-lg font-bold font-mono text-accent">{pct}%</span>
            </div>
          </div>
          <div className="ml-3">
            <p className="text-sm font-bold">{completed}/{total}</p>
            <p className="text-[10px] text-muted">today</p>
            <p className="text-[9px] text-muted mt-1">30d: {monthlyAvg}%</p>
          </div>
        </div>
      </div>

      <TabNav tabs={TABS} active={activeTab} onChange={setActiveTab} />

      {activeTab === 'protocol' && (
        <>
          <WeeklyChart data={weekData} />
          <MonthlyHeatmap data={monthData} />
          {Object.entries(grouped).map(([type, typeItems]) => (
            <div key={type} className="rounded-2xl bg-card border border-card-border p-4 space-y-1">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-accent">{ICONS[type]}</span>
                <h3 className="text-sm font-semibold">{TYPE_LABELS[type] || type}</h3>
                <span className="text-xs text-muted ml-auto font-mono">{typeItems.filter(i => i.completed).length}/{typeItems.length}</span>
              </div>
              {typeItems.map((item, i) => {
                const globalIndex = items.indexOf(item);
                return (
                  <button key={i} onClick={() => toggleCompliance(globalIndex)}
                    className="flex items-center gap-3 w-full py-2.5 px-3 rounded-xl hover:bg-background transition-colors text-left">
                    <div className={clsx('w-6 h-6 rounded-lg border-2 flex items-center justify-center shrink-0 transition-all',
                      item.completed ? 'bg-accent border-accent' : 'border-card-border')}>
                      {item.completed && <Check className="w-4 h-4 text-black" />}
                    </div>
                    <span className={clsx('text-sm transition-colors', item.completed ? 'text-muted line-through' : 'text-foreground')}>{item.name}</span>
                  </button>
                );
              })}
            </div>
          ))}
          {items.length === 0 && (
            <div className="text-center py-12">
              <p className="text-muted-foreground">No protocol generated.</p>
              <a href="/onboarding" className="text-accent text-sm underline mt-2 inline-block">Generate protocol</a>
            </div>
          )}
        </>
      )}

      {activeTab === 'habits' && <HabitsTab completed={todayMetrics.habits_completed ?? []} onToggle={toggleHabit} />}

      {activeTab === 'metrics' && <MetricsTab metrics={todayMetrics as DailyMetrics} onChange={(updates) => saveMetrics(updates)} />}

      {activeTab === 'trends' && <TrendsTab metrics={rangeMetrics as DailyMetrics[]} />}

      {activeTab === 'achievements' && (
        <div className="rounded-2xl bg-card border border-card-border p-4">
          <h3 className="text-sm font-semibold mb-3">🏆 Achievements</h3>
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
            {ACHIEVEMENTS.map((a) => {
              const earned = checkAchievements({
                totalDaysTracked: history.filter(h => h.total > 0).length,
                currentStreak: streak, longestStreak, perfectDays,
                bloodTestsUploaded: bloodTestsCount, protocolsGenerated: protocolsCount,
                supplementStreak: streak, weeklyCompliance: pct, monthlyAvgCompliance: monthlyAvg,
              }).some(e => e.id === a.id);
              return (
                <div key={a.id} title={`${a.name}: ${a.description}`}
                  className={clsx('aspect-square rounded-xl border flex flex-col items-center justify-center gap-1 transition-all',
                    earned ? (a.tier === 'legendary' ? 'bg-amber-500/10 border-amber-500/30' : a.tier === 'gold' ? 'bg-accent/10 border-accent/30' : 'bg-card border-card-border')
                    : 'bg-background border-card-border opacity-30')}>
                  <span className="text-xl">{a.icon}</span>
                  <span className="text-[8px] text-center leading-tight px-1">{a.name}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
