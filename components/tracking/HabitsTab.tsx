'use client';

import clsx from 'clsx';
import { Check } from 'lucide-react';
import { DAILY_HABITS, getHabitsByCategory } from '@/lib/engine/daily-habits';

export function HabitsTab({ completed, onToggle }: { completed: string[]; onToggle: (id: string) => void }) {
  const byCategory = getHabitsByCategory();
  const totalDone = completed.length;
  const totalAvailable = DAILY_HABITS.length;
  const pct = totalAvailable > 0 ? Math.round((totalDone / totalAvailable) * 100) : 0;

  return (
    <div className="space-y-4">
      {/* Progress header */}
      <div className="flex items-center justify-between px-1">
        <div>
          <p className="text-[10px] text-muted uppercase tracking-widest">Today's habits</p>
          <p className="text-lg font-mono font-bold tabular-nums mt-0.5">
            <span className="text-accent">{totalDone}</span><span className="text-muted">/{totalAvailable}</span>
            <span className="text-xs text-muted-foreground ml-2">· {pct}%</span>
          </p>
        </div>
        <div className="w-20 h-1.5 rounded-full bg-surface-3 overflow-hidden">
          <div className="h-full bg-accent rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
        </div>
      </div>

      {/* Category groups */}
      {Object.entries(byCategory).map(([category, habits]) => {
        const doneInCategory = habits.filter(h => completed.includes(h.id)).length;
        return (
          <div key={category} className="rounded-xl bg-surface-2 border border-card-border p-4 space-y-1">
            <div className="flex items-center justify-between mb-2 px-1">
              <p className="text-[10px] text-accent uppercase tracking-widest font-semibold">{category}</p>
              <span className="text-[10px] font-mono text-muted tabular-nums">{doneInCategory}/{habits.length}</span>
            </div>
            {habits.map(h => {
              const done = completed.includes(h.id);
              return (
                <button
                  key={h.id}
                  onClick={() => onToggle(h.id)}
                  className={clsx('flex items-center gap-3 w-full py-2.5 px-3 rounded-lg transition-colors text-left group',
                    done ? 'bg-accent/5' : 'hover:bg-surface-3 active:bg-surface-3/50')}
                >
                  <div className={clsx('w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-all',
                    done ? 'bg-accent border-accent' : 'border-card-border group-hover:border-accent/40')}>
                    {done && <Check className="w-3 h-3 text-black" strokeWidth={3} />}
                  </div>
                  <span className="text-base leading-none shrink-0">{h.icon}</span>
                  <div className="flex-1 min-w-0">
                    <p className={clsx('text-sm transition-colors leading-tight',
                      done ? 'text-muted line-through' : 'text-foreground')}>{h.name}</p>
                    <p className="text-[11px] text-muted-foreground truncate mt-0.5">{h.description}</p>
                  </div>
                </button>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
