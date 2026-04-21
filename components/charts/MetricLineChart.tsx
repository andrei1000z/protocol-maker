'use client';

// Recharts-backed line chart used by /statistics and /history.
//
// Lives in its own file so it can be dynamic-imported with `ssr: false`.
// Recharts is ~60KB gzipped — pulling it statically into every navigation
// slows TTI on mobile for nothing when the user opens Dashboard first.
// Importing through `next/dynamic` defers that weight until the user lands
// on a page that actually plots something.

import {
  LineChart, Line, ResponsiveContainer, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine,
} from 'recharts';

export interface MetricChartMarker { date: string; label: string; }

export interface MetricChartPoint { date: string; dateLabel: string; value: number | null; }

export interface MetricLineChartProps {
  data: MetricChartPoint[];
  /** Pixel height of the plot area. */
  height?: number;
  /** Line colour. Defaults to muted grey if no trend info is known. */
  lineColor?: string;
  /** Optional horizontal target reference line (e.g. sleep = 8h). */
  targetY?: number;
  /** Optional vertical reference lines — typically protocol regeneration dates. */
  markers?: MetricChartMarker[];
  /** Unit suffix shown in the tooltip (" bpm", " mg/dL"). */
  unitSuffix?: string;
  /** Decimal places for tooltip number formatting. */
  decimals?: number;
  /** Fixed y-axis domain; defaults to auto-fit. */
  domainY?: [number | 'auto' | 'dataMin' | 'dataMax', number | 'auto' | 'dataMin' | 'dataMax'];
  /** Accessible label announced by screen readers. Recharts renders SVG —
   *  without this, AT users hear "image" or nothing. Pass a sentence that
   *  summarises what the chart plots (e.g. "Longevity score over 6 months"). */
  ariaLabel?: string;
}

export default function MetricLineChart({
  data,
  height = 140,
  lineColor = '#9ca3af',
  targetY,
  markers,
  unitSuffix = '',
  decimals = 0,
  domainY = ['auto', 'auto'],
  ariaLabel,
}: MetricLineChartProps) {
  const fmt = (n: number) => decimals > 0 ? n.toFixed(decimals) : String(Math.round(n));
  // Derive a range summary for the screen-reader label when the caller didn't
  // supply one, so the chart is never announced as a bare "image".
  const values = data.map(d => d.value).filter((v): v is number => typeof v === 'number');
  const fallbackLabel = values.length > 0
    ? `Line chart with ${values.length} data points, ranging from ${fmt(Math.min(...values))}${unitSuffix} to ${fmt(Math.max(...values))}${unitSuffix}`
    : 'Line chart';
  return (
    // Wrap in a semantic role=img container so assistive tech announces the
    // chart once with a summary, instead of crawling the SVG internals.
    // Recharts' ResponsiveContainer doesn't forward `role`/`aria-label` so
    // the wrapper is the only reliable place to put them.
    <div role="img" aria-label={ariaLabel || fallbackLabel} style={{ width: '100%', height }}>
    <ResponsiveContainer
      width="100%"
      height="100%"
    >
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="#1d2128" vertical={false} />
        <XAxis dataKey="dateLabel" tick={{ fontSize: 9, fill: '#71717a' }} axisLine={false} tickLine={false} interval="preserveStartEnd" minTickGap={20} />
        <YAxis tick={{ fontSize: 9, fill: '#71717a' }} axisLine={false} tickLine={false} domain={domainY} />
        <Tooltip
          contentStyle={{ background: '#13161c', border: '1px solid #1d2128', borderRadius: 10, fontSize: 11, padding: '6px 10px' }}
          labelStyle={{ color: '#ecedef', fontSize: 10 }}
          itemStyle={{ color: lineColor }}
          formatter={(v) => [`${fmt(Number(v))}${unitSuffix}`, '']}
        />
        {targetY !== undefined && (
          <ReferenceLine y={targetY} stroke="#34d399" strokeDasharray="3 3" strokeOpacity={0.4} />
        )}
        {markers?.map(m => (
          <ReferenceLine
            key={m.label}
            x={m.date}
            stroke="#60a5fa"
            strokeDasharray="2 3"
            strokeOpacity={0.55}
            label={{ value: m.label, fontSize: 9, fill: '#60a5fa', position: 'insideTop' }}
          />
        ))}
        <Line
          type="monotone"
          dataKey="value"
          stroke={lineColor}
          strokeWidth={2}
          dot={{ fill: lineColor, r: 3 }}
          activeDot={{ r: 5 }}
          isAnimationActive
        />
      </LineChart>
    </ResponsiveContainer>
    </div>
  );
}
