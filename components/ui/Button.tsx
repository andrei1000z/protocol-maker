'use client';

import clsx from 'clsx';

const variants = {
  primary: 'bg-primary text-white hover:bg-primary-light',
  secondary: 'bg-card border border-card-border text-foreground hover:bg-card-border',
  danger: 'bg-danger/20 text-danger hover:bg-danger/30',
  ghost: 'text-muted-foreground hover:text-foreground hover:bg-card',
};

const sizes = {
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-4 py-2.5 text-sm',
  lg: 'px-6 py-3 text-base',
};

export function Button({
  children,
  variant = 'primary',
  size = 'md',
  className,
  disabled,
  onClick,
  type = 'button',
}: {
  children: React.ReactNode;
  variant?: keyof typeof variants;
  size?: keyof typeof sizes;
  className?: string;
  disabled?: boolean;
  onClick?: () => void;
  type?: 'button' | 'submit';
}) {
  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className={clsx(
        'rounded-xl font-medium transition-all active:scale-95 disabled:opacity-40 disabled:pointer-events-none',
        variants[variant],
        sizes[size],
        className
      )}
    >
      {children}
    </button>
  );
}
