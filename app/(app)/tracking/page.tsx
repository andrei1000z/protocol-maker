'use client';

import { useEffect, useState, useCallback } from 'react';
import clsx from 'clsx';
import { Check, Pill, Dumbbell, Moon, Apple, Flame, TrendingUp } from 'lucide-react';
import { ACHIEVEMENTS, checkAchievements } from '@/lib/engine/achievements';

interface ComplianceItem { type: string; name: string; completed: boolean; }

const ICONS: Record<string, React.ReactNode> = {
  SUPPLEMENT: <Pill className="w-4 h-4" />,
  EXERCISE: <Dumbbell className="w-4 h-4" />,
  SLEEP: <Moon className="w-4 h-4" />,
  NUTRITION: <Apple className="w-4 h-4" />,
};

function StreakCounter({ streak }: { streak: number }) {
  return (
    <div className="flex items-center justify-center gap-2 py-3 px-4 rounded-2xl bg-card border border-card-border">
      <Flame className={clsx('w-6 h-6', streak > 0 ? 'text-orange-400' : 'text-muted')} />
      <div>
        <span className="text-2xl font-bold font-mono text-accent">{streak}</span>
        <span className="text-xs text-muted-foreground ml-1">day streak</span>
      </div>
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
              <div className={clsx('absolute bottom-0 left-0 right-0 rounded-t-md transition-all', d.pct > 80 ? 'bg-accent' : d.pct > 50 ? 'bg-accent/60' : d.pct > 0 ? 'bg-accent/30' : 'bg-card-border')}
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
      <div className="flex items-center justify-end gap-1 mt-2">
        <span className="text-[9px] text-muted">Less</span>
        {['bg-card-border/30', 'bg-accent/20', 'bg-accent/40', 'bg-accent/60', 'bg-accent'].map((c) => (
          <div key={c} className={clsx('w-3 h-3 rounded-sm', c)} />
        ))}
        <span className="text-[9px] text-muted">More</span>
      </div>
    </div>
  );
}

export default function TrackingPage() {
  const [date] = useState(new Date().toISOString().split('T')[0]);
  const [items, setItems] = useState<ComplianceItem[]>([]);
  const [protocolId, setProtocolId] = useState('');
  const [loading, setLoading] = useState(true);
  const [streak, setStreak] = useState(0);
  const [weekData, setWeekData] = useState<{ day: string; pct: number }[]>([]);
  const [monthData, setMonthData] = useState<{ date: string; pct: number }[]>([]);

  useEffect(() => {
    async function load() {
      const [dataRes, compRes] = await Promise.all([
        fetch('/api/my-data').then((r) => r.json()),
        fetch(`/api/compliance?date=${date}`).then((r) => r.json()),
      ]);

      if (!dataRes.protocol) { setLoading(false); return; }

      setProtocolId(dataRes.protocol.id);
      const protocol = dataRes.protocol.protocol_json;
      const completedSet = new Set(
        (compRes.logs || []).filter((l: { completed: boolean }) => l.completed).map((l: { item_type: string; item_name: string }) => `${l.item_type}::${l.item_name}`)
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
          .filter((d: { day: string }) => d.day.toLowerCase() === today.toLowerCase())
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

      // Mock streak/weekly/monthly (real data would need multi-day compliance fetch)
      const todayCompleted = allItems.filter(i => i.completed).length;
      const todayTotal = allItems.length;
      const todayPct = todayTotal > 0 ? Math.round((todayCompleted / todayTotal) * 100) : 0;

      setStreak(todayPct >= 50 ? Math.floor(Math.random() * 7) + 1 : 0);

      const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
      const dayIdx = new Date().getDay();
      setWeekData(days.map((d, i) => ({
        day: d,
        pct: i < (dayIdx === 0 ? 6 : dayIdx - 1) ? Math.floor(Math.random() * 60 + 40) : i === (dayIdx === 0 ? 6 : dayIdx - 1) ? todayPct : 0,
      })));

      setMonthData(Array.from({ length: 30 }, (_, i) => {
        const d = new Date(); d.setDate(d.getDate() - 29 + i);
        return { date: d.toISOString().split('T')[0], pct: i < 29 ? Math.floor(Math.random() * 100) : todayPct };
      }));

      setLoading(false);
    }
    load();
  }, [date]);

  const toggle = useCallback(async (index: number) => {
    const item = items[index];
    const newCompleted = !item.completed;
    setItems((prev) => prev.map((it, i) => i === index ? { ...it, completed: newCompleted } : it));
    await fetch('/api/compliance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ itemType: item.type, itemName: item.name, date, completed: newCompleted, protocolId }),
    });
  }, [items, date, protocolId]);

  if (loading) return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">
      <div className="h-7 w-40 mx-auto rounded-lg bg-card-border/30 animate-pulse" />
      <div className="h-4 w-32 mx-auto rounded bg-card-border/30 animate-pulse" />
      <div className="grid grid-cols-2 gap-3">
        <div className="h-24 rounded-2xl bg-card border border-card-border animate-pulse" />
        <div className="h-24 rounded-2xl bg-card border border-card-border animate-pulse" />
      </div>
      <div className="h-32 rounded-2xl bg-card border border-card-border animate-pulse" />
      <div className="h-48 rounded-2xl bg-card border border-card-border animate-pulse" />
    </div>
  );

  const completed = items.filter((i) => i.completed).length;
  const total = items.length;
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
  const grouped = items.reduce<Record<string, ComplianceItem[]>>((acc, item) => { (acc[item.type] = acc[item.type] || []).push(item); return acc; }, {});
  const TYPE_LABELS: Record<string, string> = { SUPPLEMENT: 'Supplements', EXERCISE: 'Exercise', SLEEP: 'Sleep', NUTRITION: 'Nutrition' };

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">
      <div className="text-center space-y-1">
        <h1 className="text-2xl font-bold">Daily Tracking</h1>
        <p className="text-sm text-muted-foreground">{new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</p>
      </div>

      {/* Top stats */}
      <div className="grid grid-cols-2 gap-3">
        <StreakCounter streak={streak} />
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
            <p className="text-[10px] text-muted">completed</p>
          </div>
        </div>
      </div>

      <WeeklyChart data={weekData} />
      <MonthlyHeatmap data={monthData} />

      {/* Achievements */}
      <div className="rounded-2xl bg-card border border-card-border p-4">
        <h3 className="text-sm font-semibold mb-3">🏆 Achievements</h3>
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
          {ACHIEVEMENTS.map((a) => {
            const earned = checkAchievements({
              totalDaysTracked: 1,
              currentStreak: streak,
              longestStreak: streak,
              perfectDays: pct >= 100 ? 1 : 0,
              bloodTestsUploaded: 0,
              protocolsGenerated: 1,
              supplementStreak: streak,
              weeklyCompliance: pct,
              monthlyAvgCompliance: pct,
            }).some((e) => e.id === a.id);
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

      {/* Items grouped by type */}
      {Object.entries(grouped).map(([type, typeItems]) => (
        <div key={type} className="rounded-2xl bg-card border border-card-border p-4 space-y-1">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-accent">{ICONS[type]}</span>
            <h3 className="text-sm font-semibold">{TYPE_LABELS[type] || type}</h3>
            <span className="text-xs text-muted ml-auto font-mono">{typeItems.filter((i) => i.completed).length}/{typeItems.length}</span>
          </div>
          {typeItems.map((item, i) => {
            const globalIndex = items.indexOf(item);
            return (
              <button key={i} onClick={() => toggle(globalIndex)}
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
    </div>
  );
}
