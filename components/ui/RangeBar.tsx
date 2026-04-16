'use client';

import clsx from 'clsx';

export function RangeBar({ value, optimalLow, optimalHigh, popLow, popHigh, bryanValue, unit, className }: {
  value: number;
  optimalLow: number;
  optimalHigh: number;
  popLow: number;
  popHigh: number;
  bryanValue?: number;
  unit?: string;
  className?: string;
}) {
  const min = Math.min(popLow * 0.4, value * 0.7, optimalLow * 0.4);
  const max = Math.max(popHigh * 1.4, value * 1.3, optimalHigh * 1.6);
  const range = max - min || 1;
  const toPercent = (v: number) => Math.max(0, Math.min(100, ((v - min) / range) * 100));

  return (
    <div className={clsx('relative h-7 rounded-full bg-background border border-card-border overflow-hidden', className)}>
      {/* Population range */}
      <div className="absolute top-0 bottom-0 bg-card-border/20" style={{ left: `${toPercent(popLow)}%`, width: `${toPercent(popHigh) - toPercent(popLow)}%` }} />
      {/* Optimal range */}
      <div className="absolute top-0 bottom-0 bg-accent/10 border-l-2 border-r-2 border-accent/30" style={{ left: `${toPercent(optimalLow)}%`, width: `${toPercent(optimalHigh) - toPercent(optimalLow)}%` }} />
      {/* Bryan's marker */}
      {bryanValue !== undefined && (
        <div className="absolute top-1 bottom-1 w-1 bg-amber-400/70 rounded-full" style={{ left: `${toPercent(bryanValue)}%` }} title={`Bryan: ${bryanValue} ${unit || ''}`} />
      )}
      {/* Your marker */}
      <div className="absolute top-0.5 bottom-0.5 w-4 rounded-full bg-accent shadow-[0_0_8px_rgba(0,255,136,0.4)] border-2 border-black -translate-x-1/2 z-10"
        style={{ left: `${toPercent(value)}%` }} />
    </div>
  );
}
