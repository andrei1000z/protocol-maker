import clsx from 'clsx';

// Unified card used by tracking / statistics / history / settings pages.
// Dashboard has its own variant (emoji icon + larger title).
export function SectionCard({ icon: Icon, title, subtitle, action, children, className }: {
  icon: React.ElementType;
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={clsx('glass-card rounded-2xl p-5 sm:p-6 space-y-4 animate-fade-in-up', className)}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-accent/10 border border-accent/20 flex items-center justify-center shrink-0">
            <Icon className="w-4 h-4 text-accent" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-base sm:text-lg font-semibold tracking-tight">{title}</h2>
            {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
          </div>
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
      {children}
    </div>
  );
}

export function StatTile({ label, value, subtext, tone = 'default' }: {
  label: string;
  value: React.ReactNode;
  subtext?: React.ReactNode;
  tone?: 'default' | 'accent' | 'danger' | 'warning';
}) {
  const color =
    tone === 'accent' ? 'text-accent'
    : tone === 'danger' ? 'text-danger'
    : tone === 'warning' ? 'text-warning'
    : 'text-foreground';
  return (
    <div className="metric-tile">
      <p className="text-[10px] text-muted uppercase tracking-widest">{label}</p>
      <p className={clsx('text-2xl sm:text-3xl font-bold font-mono tabular-nums mt-2 leading-none', color)}>{value}</p>
      {subtext && <div className="mt-2 text-[11px]">{subtext}</div>}
    </div>
  );
}

export function ProgressRing({ value, size = 64, stroke = 6 }: { value: number; size?: number; stroke?: number }) {
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (Math.max(0, Math.min(100, value)) / 100) * circumference;
  return (
    <svg className="progress-ring" width={size} height={size}>
      <circle cx={size / 2} cy={size / 2} r={radius} strokeWidth={stroke} fill="none" className="progress-ring-bg" />
      <circle
        cx={size / 2} cy={size / 2} r={radius} strokeWidth={stroke} fill="none"
        stroke="var(--accent)" strokeLinecap="round"
        strokeDasharray={circumference} strokeDashoffset={offset}
        style={{ transition: 'stroke-dashoffset 0.8s cubic-bezier(0.4, 0, 0.2, 1)' }}
      />
    </svg>
  );
}
