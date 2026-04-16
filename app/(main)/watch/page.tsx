'use client';

import { useDailyLog } from '@/lib/hooks/useDailyLog';
import { Card } from '@/components/ui/Card';
import { MetricCard } from '@/components/watch/MetricCard';
import { WATCH_METRICS, METRIC_GROUP_LABELS } from '@/lib/constants';
import { Watch as WatchIcon } from 'lucide-react';

const GROUPS = ['sleep', 'cardio', 'activity', 'wellness'] as const;

export default function WatchPage() {
  const { log, hydrated, setWatchMetric } = useDailyLog();

  if (!hydrated || !log) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <WatchIcon className="w-5 h-5 text-primary" />
        <h1 className="text-xl font-bold">Galaxy Watch</h1>
      </div>

      {GROUPS.map((group) => {
        const metrics = WATCH_METRICS.filter((m) => m.group === group);
        return (
          <Card key={group}>
            <h3 className="text-sm font-medium mb-3">{METRIC_GROUP_LABELS[group]}</h3>
            <div className="grid grid-cols-2 gap-2">
              {metrics.map((metric) => (
                <MetricCard
                  key={metric.id}
                  metric={metric}
                  value={log.watchMetrics[metric.id] || 0}
                  onChange={(v) => setWatchMetric(metric.id, v)}
                />
              ))}
            </div>
          </Card>
        );
      })}
    </div>
  );
}
