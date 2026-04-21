'use client';

// Inline micro-visualization comparing your biomarker value to Bryan Johnson's.
// Pure SVG, no dependencies — cheap enough to render inside every biomarker
// row without touching bundle size. Replaces the "Bryan 0.8" text blob with
// a 60×8 bar that anchors the user's value + Bryan's position on the same
// optimal-range scale.
//
// Geometry: the bar spans the longevity-optimal range. If either value sits
// outside that range, we clamp to the visible edge and draw a tick marker
// with a distinctive pattern so the user can tell "outside range" at a glance.
//
// Accessibility: the component renders a title + aria-label with the actual
// numbers + direction, so screen readers get the same signal as sighted users.

import clsx from 'clsx';

export interface BryanGapBarProps {
  userValue: number | null | undefined;
  bryanValue: number | null | undefined;
  optimalLow: number;
  optimalHigh: number;
  unit?: string;
  /** Render height in pixels — defaults to the row-inline size. */
  height?: number;
  /** Render width as CSS — the bar stretches to container width by default. */
  width?: number | string;
  className?: string;
}

export function BryanGapBar({
  userValue, bryanValue, optimalLow, optimalHigh,
  unit = '', height = 10, width = '100%', className,
}: BryanGapBarProps) {
  // Guardrails. If either value is missing OR the range is degenerate,
  // render nothing so callers don't need to null-check around the chart.
  if (userValue === null || userValue === undefined) return null;
  if (!Number.isFinite(optimalLow) || !Number.isFinite(optimalHigh) || optimalHigh <= optimalLow) return null;

  const range = optimalHigh - optimalLow;
  // Extend the visible scale 15% on either side so markers just outside the
  // optimal band are still readable as "just above" / "just below".
  const viewMin = optimalLow - range * 0.15;
  const viewMax = optimalHigh + range * 0.15;
  const viewSpan = viewMax - viewMin;

  const pctOf = (v: number) => Math.max(0, Math.min(100, ((v - viewMin) / viewSpan) * 100));

  const userPct = pctOf(userValue);
  const bryanPct = Number.isFinite(bryanValue as number) ? pctOf(bryanValue as number) : null;
  const optimalLeftPct = pctOf(optimalLow);
  const optimalRightPct = pctOf(optimalHigh);

  const inRange = userValue >= optimalLow && userValue <= optimalHigh;
  const userAbove = userValue > optimalHigh;

  const ariaBits: string[] = [
    `Your value ${userValue}${unit ? ` ${unit}` : ''}`,
    `${inRange ? 'within' : userAbove ? 'above' : 'below'} optimal ${optimalLow}-${optimalHigh}${unit ? ` ${unit}` : ''}`,
  ];
  if (bryanValue !== null && bryanValue !== undefined) {
    ariaBits.push(`Bryan Johnson target ${bryanValue}${unit ? ` ${unit}` : ''}`);
  }

  return (
    <div
      role="img"
      aria-label={ariaBits.join('; ')}
      className={clsx('relative', className)}
      style={{ width, height }}
    >
      {/* Full track (muted). */}
      <div className="absolute inset-0 rounded-full bg-surface-3 border border-card-border" />

      {/* Optimal band (accent-tinted). */}
      <div
        className="absolute top-0 bottom-0 bg-accent/20 border-y border-accent/30"
        style={{ left: `${optimalLeftPct}%`, width: `${optimalRightPct - optimalLeftPct}%` }}
      />

      {/* Bryan's tick — amber diamond rendered via CSS rotation, behind user tick. */}
      {bryanPct !== null && (
        <div
          className="absolute -top-0.5 w-2 h-2 rotate-45 bg-amber-400 border border-amber-300 shadow-sm"
          style={{ left: `calc(${bryanPct}% - 4px)` }}
          title={`Bryan Johnson: ${bryanValue}${unit ? ` ${unit}` : ''}`}
        />
      )}

      {/* User tick — solid colored dot positioned on the track. Color reflects
          whether the value is in range (accent) or outside (danger). */}
      <div
        className={clsx('absolute top-0 bottom-0 w-[3px] rounded-full',
          inRange ? 'bg-accent' : 'bg-danger')}
        style={{ left: `calc(${userPct}% - 1.5px)` }}
        title={`You: ${userValue}${unit ? ` ${unit}` : ''}`}
      />
    </div>
  );
}
