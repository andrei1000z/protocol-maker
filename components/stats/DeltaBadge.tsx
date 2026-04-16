'use client';

import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import clsx from 'clsx';

export function DeltaBadge({ current, previous, unit, inverted }: {
  current: number;
  previous: number;
  unit?: string;
  inverted?: boolean;
}) {
  if (!previous || !current) return null;
  const delta = current - previous;
  const isPositive = inverted ? delta < 0 : delta > 0;
  const isNeutral = delta === 0;

  return (
    <span className={clsx(
      'inline-flex items-center gap-0.5 text-xs font-medium',
      isNeutral && 'text-muted',
      !isNeutral && isPositive && 'text-emerald-400',
      !isNeutral && !isPositive && 'text-red-400',
    )}>
      {isNeutral ? <Minus className="w-3 h-3" /> : isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
      {delta > 0 ? '+' : ''}{Math.round(delta * 10) / 10}{unit || ''}
    </span>
  );
}
