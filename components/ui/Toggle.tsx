'use client';

import clsx from 'clsx';
import { Check } from 'lucide-react';

export function Toggle({
  checked,
  onChange,
  label,
  sublabel,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  sublabel?: string;
}) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className="flex items-center gap-3 w-full text-left py-2 active:scale-[0.98] transition-transform"
    >
      <div
        className={clsx(
          'w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all shrink-0',
          checked
            ? 'bg-primary border-primary'
            : 'border-card-border'
        )}
      >
        {checked && <Check className="w-4 h-4 text-white" />}
      </div>
      <div className="flex flex-col min-w-0">
        <span className={clsx('text-sm transition-colors', checked ? 'text-foreground' : 'text-muted-foreground')}>
          {label}
        </span>
        {sublabel && <span className="text-xs text-muted">{sublabel}</span>}
      </div>
    </button>
  );
}
