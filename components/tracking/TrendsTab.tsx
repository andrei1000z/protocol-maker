'use client';

import { DailyMetrics } from '@/lib/hooks/useDailyMetrics';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip } from 'recharts';

function TrendCard({ title, data, dataKey, color, unit }: { title: string; data: { date: string; value: number | null }[]; dataKey: string; color: string; unit?: string }) {
  const hasData = data.some(d => d.value !== null);
  if (!hasData) {
    return (
      <div className="rounded-2xl bg-card border border-card-border p-4 space-y-2">
        <h3 className="text-sm font-semibold">{title}</h3>
        <p className="text-xs text-muted text-center py-8">Log daily metrics to see trends</p>
      </div>
    );
  }
  const validData = data.filter(d => d.value !== null) as { date: string; value: number }[];
  const current = validData[validData.length - 1]?.value;
  const previous = validData[validData.length - 2]?.value;
  const delta = current !== undefined && previous !== undefined ? current - previous : null;

  return (
    <div className="rounded-2xl bg-card border border-card-border p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">{title}</h3>
        <div className="flex items-baseline gap-2">
          <span className="text-lg font-mono font-bold text-accent">{current ?? '-'}{unit}</span>
          {delta !== null && delta !== 0 && (
            <span className={`text-[10px] font-mono ${delta > 0 ? 'text-accent' : 'text-red-400'}`}>
              {delta > 0 ? '+' : ''}{delta.toFixed(1)}
            </span>
          )}
        </div>
      </div>
      <ResponsiveContainer width="100%" height={100}>
        <LineChart data={data.map(d => ({ ...d, [dataKey]: d.value }))}>
          <XAxis dataKey="date" hide />
          <YAxis hide domain={['dataMin', 'dataMax']} />
          <Tooltip contentStyle={{ background: '#0a0a0a', border: '1px solid #1a1a1a', fontSize: 10, padding: '4px 8px' }} />
          <Line type="monotone" dataKey={dataKey} stroke={color} strokeWidth={2} dot={false} connectNulls />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function StepsCard({ data }: { data: { date: string; value: number | null }[] }) {
  const validData = data.filter(d => d.value !== null) as { date: string; value: number }[];
  if (validData.length === 0) {
    return (
      <div className="rounded-2xl bg-card border border-card-border p-4 space-y-2">
        <h3 className="text-sm font-semibold">Steps</h3>
        <p className="text-xs text-muted text-center py-8">Log your daily steps to see trends</p>
      </div>
    );
  }
  const avg = Math.round(validData.reduce((s, d) => s + d.value, 0) / validData.length);

  return (
    <div className="rounded-2xl bg-card border border-card-border p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Steps</h3>
        <span className="text-xs text-muted">Avg: <span className="text-accent font-mono">{avg.toLocaleString()}</span></span>
      </div>
      <ResponsiveContainer width="100%" height={100}>
        <BarChart data={data.map(d => ({ ...d, value: d.value ?? 0 }))}>
          <XAxis dataKey="date" hide />
          <YAxis hide />
          <Tooltip contentStyle={{ background: '#0a0a0a', border: '1px solid #1a1a1a', fontSize: 10, padding: '4px 8px' }} />
          <Bar dataKey="value" fill="#00ff88" radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function TrendsTab({ metrics }: { metrics: DailyMetrics[] }) {
  // Build 30-day window filled with nulls for missing dates
  const now = new Date();
  const days: { date: string; value: number | null }[] = [];
  const byDate = new Map(metrics.map(m => [m.date, m]));

  const buildSeries = (field: keyof DailyMetrics) => {
    const series: { date: string; value: number | null }[] = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const key = d.toISOString().split('T')[0];
      const m = byDate.get(key);
      const val = m?.[field];
      series.push({ date: key.slice(5), value: typeof val === 'number' ? val : null });
    }
    return series;
  };

  return (
    <div className="space-y-3">
      <TrendCard title="⚖️ Weight" data={buildSeries('weight_kg')} dataKey="weight_kg" color="#00ff88" unit="kg" />
      <TrendCard title="😴 Sleep Hours" data={buildSeries('sleep_hours')} dataKey="sleep_hours" color="#8b5cf6" unit="h" />
      <TrendCard title="😊 Mood" data={buildSeries('mood')} dataKey="mood" color="#00ff88" />
      <TrendCard title="⚡ Energy" data={buildSeries('energy')} dataKey="energy" color="#f59e0b" />
      <StepsCard data={buildSeries('steps')} />
      <TrendCard title="❤️ Resting HR" data={buildSeries('resting_hr')} dataKey="resting_hr" color="#ef4444" unit=" bpm" />
      <TrendCard title="📊 HRV" data={buildSeries('hrv')} dataKey="hrv" color="#3b82f6" unit=" ms" />
    </div>
  );
}
