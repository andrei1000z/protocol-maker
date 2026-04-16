'use client';

import clsx from 'clsx';

export function Input({
  label,
  value,
  onChange,
  type = 'text',
  placeholder,
  className,
  min,
  max,
  step,
}: {
  label?: string;
  value: string | number;
  onChange: (value: string) => void;
  type?: 'text' | 'number' | 'email' | 'password';
  placeholder?: string;
  className?: string;
  min?: number;
  max?: number;
  step?: number;
}) {
  return (
    <div className={clsx('flex flex-col gap-1.5', className)}>
      {label && <label className="text-sm text-muted-foreground">{label}</label>}
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        min={min}
        max={max}
        step={step}
        className="w-full rounded-xl bg-card border border-card-border px-4 py-2.5 text-foreground placeholder:text-muted outline-none focus:border-primary transition-colors"
      />
    </div>
  );
}
