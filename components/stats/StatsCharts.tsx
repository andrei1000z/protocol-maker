'use client';

import { Card } from '@/components/ui/Card';
import { DeltaBadge } from './DeltaBadge';
import { DailyLog } from '@/lib/types';
import {
  AreaChart, Area, LineChart, Line, BarChart, Bar,
  RadarChart, Radar, PolarGrid, PolarAngleAxis,
  ResponsiveContainer, XAxis, YAxis, Tooltip,
} from 'recharts';
import { WATCH_METRICS } from '@/lib/constants';

const chartColors = {
  primary: '#3b82f6',
  warning: '#f59e0b',
  success: '#22c55e',
  purple: '#a855f7',
};

export function WeightChart({ logs }: { logs: DailyLog[] }) {
  const data = logs
    .filter((l) => l.weight)
    .map((l) => ({ date: l.date.slice(5), weight: l.weight }));

  if (data.length < 2) return null;

  const first = data[0].weight!;
  const last = data[data.length - 1].weight!;

  return (
    <Card>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium">Greutate</h3>
        <DeltaBadge current={last} previous={first} unit="kg" />
      </div>
      <ResponsiveContainer width="100%" height={120}>
        <AreaChart data={data}>
          <defs>
            <linearGradient id="weightGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={chartColors.primary} stopOpacity={0.3} />
              <stop offset="95%" stopColor={chartColors.primary} stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#71717a' }} axisLine={false} tickLine={false} />
          <YAxis hide domain={['dataMin - 2', 'dataMax + 2']} />
          <Tooltip contentStyle={{ background: '#18181b', border: '1px solid #27272a', borderRadius: '8px', fontSize: 12 }} />
          <Area type="monotone" dataKey="weight" stroke={chartColors.primary} fill="url(#weightGrad)" strokeWidth={2} />
        </AreaChart>
      </ResponsiveContainer>
    </Card>
  );
}

export function SleepChart({ logs }: { logs: DailyLog[] }) {
  const data = logs
    .filter((l) => l.watchMetrics.sleepScore)
    .map((l) => ({ date: l.date.slice(5), score: l.watchMetrics.sleepScore }));

  if (data.length < 2) return null;

  return (
    <Card>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium">Sleep Score</h3>
        <DeltaBadge current={data[data.length - 1].score} previous={data[0].score} unit="pts" />
      </div>
      <ResponsiveContainer width="100%" height={120}>
        <LineChart data={data}>
          <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#71717a' }} axisLine={false} tickLine={false} />
          <YAxis hide domain={[0, 100]} />
          <Tooltip contentStyle={{ background: '#18181b', border: '1px solid #27272a', borderRadius: '8px', fontSize: 12 }} />
          <Line type="monotone" dataKey="score" stroke={chartColors.purple} strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </Card>
  );
}

export function HRVChart({ logs }: { logs: DailyLog[] }) {
  const data = logs
    .filter((l) => l.watchMetrics.hrv)
    .map((l) => ({ date: l.date.slice(5), hrv: l.watchMetrics.hrv }));

  if (data.length < 2) return null;

  return (
    <Card>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium">HRV</h3>
        <DeltaBadge current={data[data.length - 1].hrv} previous={data[0].hrv} unit="ms" />
      </div>
      <ResponsiveContainer width="100%" height={120}>
        <BarChart data={data}>
          <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#71717a' }} axisLine={false} tickLine={false} />
          <YAxis hide />
          <Tooltip contentStyle={{ background: '#18181b', border: '1px solid #27272a', borderRadius: '8px', fontSize: 12 }} />
          <Bar dataKey="hrv" fill={chartColors.success} radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </Card>
  );
}

export function StepsChart({ logs }: { logs: DailyLog[] }) {
  const data = logs
    .filter((l) => l.watchMetrics.steps)
    .map((l) => ({ date: l.date.slice(5), steps: l.watchMetrics.steps }));

  if (data.length < 2) return null;

  return (
    <Card>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium">Pași</h3>
        <DeltaBadge current={data[data.length - 1].steps} previous={data[0].steps} />
      </div>
      <ResponsiveContainer width="100%" height={120}>
        <BarChart data={data}>
          <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#71717a' }} axisLine={false} tickLine={false} />
          <YAxis hide />
          <Tooltip contentStyle={{ background: '#18181b', border: '1px solid #27272a', borderRadius: '8px', fontSize: 12 }} />
          <Bar dataKey="steps" fill={chartColors.warning} radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </Card>
  );
}

export function WatchRadar({ log }: { log: DailyLog }) {
  const radarMetrics = ['sleepScore', 'hrv', 'vo2max', 'bodyBattery', 'spo2', 'steps'];
  const data = radarMetrics.map((id) => {
    const metric = WATCH_METRICS.find((m) => m.id === id)!;
    const value = log.watchMetrics[id] || 0;
    const normalized = Math.min((value / metric.target) * 100, 100);
    return { name: metric.name, value: Math.round(normalized) };
  });

  const hasData = data.some((d) => d.value > 0);
  if (!hasData) return null;

  return (
    <Card>
      <h3 className="text-sm font-medium mb-3">Watch Radar</h3>
      <ResponsiveContainer width="100%" height={200}>
        <RadarChart data={data} cx="50%" cy="50%" outerRadius="70%">
          <PolarGrid stroke="#27272a" />
          <PolarAngleAxis dataKey="name" tick={{ fontSize: 10, fill: '#a1a1aa' }} />
          <Radar dataKey="value" stroke={chartColors.primary} fill={chartColors.primary} fillOpacity={0.2} strokeWidth={2} />
        </RadarChart>
      </ResponsiveContainer>
    </Card>
  );
}
