'use client';

// Organ-system radar chart — split into its own file so the dashboard can
// `next/dynamic`-load it and keep recharts (~150 KB gzipped) out of the
// critical path. The rest of the dashboard renders while this lazy-loads,
// and the chart shows a skeleton until it's ready.

import { Radar, RadarChart, PolarGrid, PolarAngleAxis, ResponsiveContainer } from 'recharts';

export interface OrganRadarPoint { name: string; score: number; }

/**
 * Generate a single aria-label describing every organ + score on the chart.
 * Screen readers read this out instead of trying (and failing) to announce
 * the SVG's axis + polygon individually. Without it, VoiceOver says nothing
 * meaningful when the user lands on the chart.
 */
function buildA11yLabel(data: OrganRadarPoint[]): string {
  if (!data.length) return 'Organ system scores (no data yet).';
  const parts = data.map(d => `${d.name} ${Math.round(d.score)} of 100`);
  return `Organ system scores: ${parts.join('; ')}.`;
}

export default function OrganRadar({ data }: { data: OrganRadarPoint[] }) {
  return (
    <div role="img" aria-label={buildA11yLabel(data)}>
      <ResponsiveContainer width="100%" height={300}>
        <RadarChart data={data}>
          <PolarGrid stroke="#1d2128" />
          <PolarAngleAxis dataKey="name" tick={{ fontSize: 11, fill: '#9ca3af' }} />
          <Radar dataKey="score" stroke="#34d399" fill="#34d399" fillOpacity={0.18} strokeWidth={2.5} />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}
