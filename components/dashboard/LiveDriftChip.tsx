'use client';

// Small chip next to a hero metric showing a live-refinement delta vs the
// locked-in protocol value. "up" = improving (accent green); "down" =
// declining (danger red). Pulses subtly to signal that the number is live.

import clsx from 'clsx';

export interface LiveDriftChipProps {
  label: string;
  direction: 'up' | 'down';
  value: string;
  title?: string;
}

export function LiveDriftChip({ label, direction, value, title }: LiveDriftChipProps) {
  const tone = direction === 'up'
    ? 'bg-accent/10 text-accent border-accent/25'
    : 'bg-red-500/10 text-danger border-red-500/25';
  const arrow = direction === 'up' ? '↑' : '↓';
  return (
    <span
      title={title}
      className={clsx(
        'inline-flex items-center gap-1 mt-2 ml-2 text-xs font-mono px-2 py-0.5 rounded-full border',
        tone,
      )}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
      {label} {arrow} {value}
    </span>
  );
}
