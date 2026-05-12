'use client';

// Generic glass-card section with an emoji icon header. Used by every block
// on the dashboard so spacing + animation timing stay consistent.

import clsx from 'clsx';

export interface SectionProps {
  id?: string;
  title: string;
  icon: string;
  subtitle?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

export function Section({ id, title, icon, subtitle, action, children, className }: SectionProps) {
  return (
    <div id={id} className={clsx('glass-card rounded-2xl p-6 space-y-5 scroll-mt-20 animate-fade-in-up', className)}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <h2 className="text-xl font-semibold tracking-tight flex items-center gap-2.5">
            <span className="text-2xl">{icon}</span>{title}
          </h2>
          {subtitle && <p className="text-xs text-muted-foreground mt-1.5 max-w-lg leading-relaxed">{subtitle}</p>}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
      {children}
    </div>
  );
}
