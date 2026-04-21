'use client';

// Inline 3-4 point mini-chart rendered per biomarker row on the dashboard.
//
// Shows the direction of travel across the user's recent blood tests without
// needing a full Recharts instance. Pure SVG, no deps, ~1KB. The full
// history chart lives on /history — this is the at-a-glance version.
//
// Design notes:
//   - Needs ≥2 points to render. Component returns null otherwise so callers
//     don't need to guard.
//   - Color reflects whether the series is moving toward the healthier pole
//     (green for improving, red for regressing, muted for steady).
//   - "Healthier pole" is determined by the `lowerIsBetter` prop — caller
//     passes based on biomarker code (LDL down = good, HDL up = good).

import clsx from 'clsx';

export interface BiomarkerSparklineProps {
  values: number[];                 // oldest → newest
  lowerIsBetter?: boolean;
  width?: number;
  height?: number;
  className?: string;
  /** For aria-label only — does not affect rendering. */
  unit?: string;
}

export function BiomarkerSparkline({
  values, lowerIsBetter = false,
  width = 56, height = 18, className, unit = '',
}: BiomarkerSparklineProps) {
  const clean = values.filter(v => Number.isFinite(v));
  if (clean.length < 2) return null;

  const min = Math.min(...clean);
  const max = Math.max(...clean);
  const range = max - min || 1;       // avoid div-by-0 on flat series
  const padY = 2;                      // keep the line off the edges
  const plotH = height - padY * 2;

  const points = clean.map((v, i) => {
    const x = (i / (clean.length - 1)) * (width - 4) + 2;
    const y = padY + (1 - (v - min) / range) * plotH;
    return { x, y, v };
  });

  // Direction of the series: first vs last. "steady" if delta < 2% of range
  // so tiny noise doesn't flip color.
  const first = clean[0];
  const last = clean[clean.length - 1];
  const deltaPct = Math.abs(last - first) / (Math.abs(first) || 1);
  const steady = deltaPct < 0.02;
  const movingDown = last < first;
  const improved = steady ? null : lowerIsBetter ? movingDown : !movingDown;

  const stroke = improved === true  ? '#34d399'    // accent green
              :  improved === false ? '#f87171'    // danger red
              :                       '#9ca3af';   // muted

  const d = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');

  const label = `Recent trend: ${clean.length} values, ${first}${unit ? ' ' + unit : ''} → ${last}${unit ? ' ' + unit : ''}, ${steady ? 'steady' : improved ? 'improving' : 'worsening'}`;

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={clsx('inline-block shrink-0', className)}
      role="img"
      aria-label={label}
    >
      <path d={d} fill="none" stroke={stroke} strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round" />
      {/* Last point dot for legibility when the line is short. */}
      <circle cx={points[points.length - 1].x} cy={points[points.length - 1].y} r={1.6} fill={stroke} />
    </svg>
  );
}

/** Helper: from a blood-tests array, pick the most-recent-5 values for a
 *  given code in chronological order. */
export function extractBiomarkerSeries(
  tests: Array<{ taken_at: string; biomarkers: Array<{ code: string; value: number }> }> | undefined | null,
  code: string,
): number[] {
  if (!Array.isArray(tests) || tests.length === 0) return [];
  const sorted = [...tests].sort((a, b) => new Date(a.taken_at).getTime() - new Date(b.taken_at).getTime());
  return sorted
    .slice(-5)   // last 5 is plenty for a sparkline; older values wash out the trend
    .map(t => t.biomarkers.find(b => b.code.toUpperCase() === code.toUpperCase())?.value)
    .filter((v): v is number => typeof v === 'number');
}
