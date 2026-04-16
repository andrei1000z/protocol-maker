'use client';

import { Card } from '@/components/ui/Card';
import { DailyLog } from '@/lib/types';
import { getDaysAgo, taskCompletionPercent } from '@/lib/utils';
import clsx from 'clsx';

export function Heatmap({ logs }: { logs: Map<string, DailyLog> }) {
  const days = getDaysAgo(30);

  return (
    <Card>
      <h3 className="text-sm font-medium mb-3">Activitate 30 zile</h3>
      <div className="grid grid-cols-10 gap-1">
        {days.map((date) => {
          const log = logs.get(date);
          const pct = log ? taskCompletionPercent(log) : 0;
          const hasTasks = log && log.tasks.length > 0;
          return (
            <div
              key={date}
              title={`${date}: ${pct}%`}
              className={clsx(
                'aspect-square rounded-sm transition-colors',
                !hasTasks && 'bg-card-border/30',
                hasTasks && pct === 0 && 'bg-card-border',
                hasTasks && pct > 0 && pct < 30 && 'bg-emerald-900',
                hasTasks && pct >= 30 && pct < 60 && 'bg-emerald-700',
                hasTasks && pct >= 60 && pct < 90 && 'bg-emerald-500',
                hasTasks && pct >= 90 && 'bg-emerald-400',
              )}
            />
          );
        })}
      </div>
      <div className="flex items-center justify-end gap-1 mt-2">
        <span className="text-[10px] text-muted">Mai puțin</span>
        {['bg-card-border', 'bg-emerald-900', 'bg-emerald-700', 'bg-emerald-500', 'bg-emerald-400'].map((c) => (
          <div key={c} className={clsx('w-3 h-3 rounded-sm', c)} />
        ))}
        <span className="text-[10px] text-muted">Mai mult</span>
      </div>
    </Card>
  );
}
