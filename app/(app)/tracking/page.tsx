'use client';

import { useEffect, useState, useCallback } from 'react';
import clsx from 'clsx';
import { Check, Pill, Dumbbell, Moon, Apple } from 'lucide-react';

interface ComplianceItem {
  type: string;
  name: string;
  completed: boolean;
}

const ICONS: Record<string, React.ReactNode> = {
  SUPPLEMENT: <Pill className="w-4 h-4" />,
  EXERCISE: <Dumbbell className="w-4 h-4" />,
  SLEEP: <Moon className="w-4 h-4" />,
  NUTRITION: <Apple className="w-4 h-4" />,
};

export default function TrackingPage() {
  const [date] = useState(new Date().toISOString().split('T')[0]);
  const [items, setItems] = useState<ComplianceItem[]>([]);
  const [protocolId, setProtocolId] = useState('');
  const [loading, setLoading] = useState(true);

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

      // Supplements
      if (protocol.supplements) {
        protocol.supplements.forEach((s: { name: string }) => {
          allItems.push({ type: 'SUPPLEMENT', name: s.name, completed: completedSet.has(`SUPPLEMENT::${s.name}`) });
        });
      }

      // Exercise (today's plan)
      if (protocol.exercise?.weeklyPlan) {
        const dayNames = ['Duminică', 'Luni', 'Marți', 'Miercuri', 'Joi', 'Vineri', 'Sâmbătă'];
        const today = dayNames[new Date().getDay()];
        protocol.exercise.weeklyPlan
          .filter((d: { day: string }) => d.day.toLowerCase() === today.toLowerCase())
          .forEach((d: { activity: string }) => {
            allItems.push({ type: 'EXERCISE', name: d.activity, completed: completedSet.has(`EXERCISE::${d.activity}`) });
          });
      }

      // Sleep routine
      if (protocol.sleep?.windDownRoutine) {
        protocol.sleep.windDownRoutine.forEach((s: string) => {
          allItems.push({ type: 'SLEEP', name: s, completed: completedSet.has(`SLEEP::${s}`) });
        });
      }

      // Nutrition
      if (protocol.nutrition?.meals) {
        protocol.nutrition.meals.forEach((m: { name: string }) => {
          allItems.push({ type: 'NUTRITION', name: m.name, completed: completedSet.has(`NUTRITION::${m.name}`) });
        });
      }

      setItems(allItems);
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
    <div className="flex items-center justify-center min-h-dvh">
      <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
    </div>
  );

  const completed = items.filter((i) => i.completed).length;
  const total = items.length;
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;

  const grouped = items.reduce<Record<string, ComplianceItem[]>>((acc, item) => {
    (acc[item.type] = acc[item.type] || []).push(item);
    return acc;
  }, {});

  const TYPE_LABELS: Record<string, string> = { SUPPLEMENT: 'Suplimente', EXERCISE: 'Exerciții', SLEEP: 'Somn', NUTRITION: 'Nutriție' };

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
      <div className="text-center space-y-2">
        <h1 className="text-2xl font-bold">Tracking Zilnic</h1>
        <p className="text-sm text-muted-foreground">{new Date().toLocaleDateString('ro-RO', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
      </div>

      {/* Progress ring */}
      <div className="flex justify-center">
        <div className="relative w-32 h-32">
          <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="42" fill="none" stroke="#1a1a1a" strokeWidth="6" />
            <circle cx="50" cy="50" r="42" fill="none" stroke="#00ff88" strokeWidth="6"
              strokeDasharray={`${2 * Math.PI * 42}`} strokeDashoffset={`${2 * Math.PI * 42 * (1 - pct / 100)}`}
              strokeLinecap="round" className="transition-all duration-500" />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-2xl font-bold font-mono text-accent">{pct}%</span>
            <span className="text-[10px] text-muted">{completed}/{total}</span>
          </div>
        </div>
      </div>

      {/* Items grouped by type */}
      {Object.entries(grouped).map(([type, typeItems]) => (
        <div key={type} className="rounded-2xl bg-card border border-card-border p-4 space-y-2">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-accent">{ICONS[type]}</span>
            <h3 className="text-sm font-semibold">{TYPE_LABELS[type] || type}</h3>
            <span className="text-xs text-muted ml-auto">{typeItems.filter((i) => i.completed).length}/{typeItems.length}</span>
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
          <p className="text-muted-foreground">Niciun protocol generat.</p>
          <a href="/onboarding" className="text-accent text-sm underline mt-2 inline-block">Generează protocol</a>
        </div>
      )}
    </div>
  );
}
