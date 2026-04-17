'use client';

import clsx from 'clsx';
import { Check } from 'lucide-react';
import { DAILY_HABITS, getHabitsByCategory } from '@/lib/engine/daily-habits';

export function HabitsTab({ completed, onToggle }: { completed: string[]; onToggle: (id: string) => void }) {
  const byCategory = getHabitsByCategory();
  const totalDone = completed.length;
  const totalAvailable = DAILY_HABITS.length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between px-1">
        <h3 className="text-sm font-semibold">Daily Habits</h3>
        <span className="text-xs text-muted font-mono">{totalDone}/{totalAvailable}</span>
      </div>
      {Object.entries(byCategory).map(([category, habits]) => (
        <div key={category} className="rounded-2xl bg-card border border-card-border p-4 space-y-1">
          <p className="text-[10px] text-accent uppercase tracking-wider mb-2">{category}</p>
          {habits.map(h => {
            const done = completed.includes(h.id);
            return (
              <button key={h.id} onClick={() => onToggle(h.id)}
                className="flex items-center gap-3 w-full py-2.5 px-3 rounded-xl hover:bg-background transition-colors text-left">
                <div className={clsx('w-6 h-6 rounded-lg border-2 flex items-center justify-center shrink-0 transition-all',
                  done ? 'bg-accent border-accent' : 'border-card-border')}>
                  {done && <Check className="w-4 h-4 text-black" />}
                </div>
                <span className="text-lg">{h.icon}</span>
                <div className="flex-1 min-w-0">
                  <p className={clsx('text-sm transition-colors', done ? 'text-muted line-through' : 'text-foreground')}>{h.name}</p>
                  <p className="text-[10px] text-muted truncate">{h.description}</p>
                </div>
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}
