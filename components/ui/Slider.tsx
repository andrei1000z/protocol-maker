'use client';

import clsx from 'clsx';

export function Slider({
  label,
  value,
  onChange,
  min = 1,
  max = 10,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">{label}</span>
        <span className="text-sm font-bold text-primary">{value || '-'}</span>
      </div>
      <div className="flex gap-1">
        {Array.from({ length: max - min + 1 }, (_, i) => i + min).map((n) => (
          <button
            key={n}
            onClick={() => onChange(n)}
            className={clsx(
              'flex-1 h-8 rounded-lg text-xs font-medium transition-all active:scale-90',
              value === n
                ? 'bg-primary text-white'
                : value > 0 && n <= value
                  ? 'bg-primary/20 text-primary'
                  : 'bg-card border border-card-border text-muted'
            )}
          >
            {n}
          </button>
        ))}
      </div>
    </div>
  );
}
