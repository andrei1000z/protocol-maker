'use client';

import { DailyLog } from '@/lib/types';
import { getDaysAgo } from '@/lib/utils';
import { Heatmap } from '@/components/stats/Heatmap';
import { WatchRadar, WeightChart, SleepChart, HRVChart, StepsChart } from '@/components/stats/StatsCharts';
import { useEffect, useState } from 'react';

export default function StatsPage() {
  const [log, setLog] = useState<DailyLog | null>(null);
  const [logsMap, setLogsMap] = useState<Map<string, DailyLog>>(new Map());
  const [logsArray, setLogsArray] = useState<DailyLog[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const days = getDaysAgo(30);
    const start = days[0];
    const end = days[days.length - 1];
    fetch(`/api/my-data?rangeStart=${start}&rangeEnd=${end}`)
      .then((r) => r.json())
      .then((data) => {
        setLog(data.log);
        const logs: DailyLog[] = data.rangeLogs || [];
        const map = new Map<string, DailyLog>();
        logs.forEach((l: DailyLog) => map.set(l.date, l));
        setLogsMap(map);
        setLogsArray(logs);
        setHydrated(true);
      })
      .catch(() => setHydrated(true));
  }, []);

  if (!hydrated || !log) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">Statistici</h1>
      <Heatmap logs={logsMap} />
      <WatchRadar log={log} />
      <WeightChart logs={logsArray} />
      <SleepChart logs={logsArray} />
      <HRVChart logs={logsArray} />
      <StepsChart logs={logsArray} />
    </div>
  );
}
