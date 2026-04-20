'use client';

// Organ-system radar chart — split into its own file so the dashboard can
// `next/dynamic`-load it and keep recharts (~150 KB gzipped) out of the
// critical path. The rest of the dashboard renders while this lazy-loads,
// and the chart shows a skeleton until it's ready.

import { Radar, RadarChart, PolarGrid, PolarAngleAxis, ResponsiveContainer } from 'recharts';

export interface OrganRadarPoint { name: string; score: number; }

export default function OrganRadar({ data }: { data: OrganRadarPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <RadarChart data={data}>
        <PolarGrid stroke="#1d2128" />
        <PolarAngleAxis dataKey="name" tick={{ fontSize: 11, fill: '#9ca3af' }} />
        <Radar dataKey="score" stroke="#34d399" fill="#34d399" fillOpacity={0.18} strokeWidth={2.5} />
      </RadarChart>
    </ResponsiveContainer>
  );
}
