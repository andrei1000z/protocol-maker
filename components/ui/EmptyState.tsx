'use client';

// Reusable empty-state card.
//
// Replaces ~6 different per-page "no data yet" UIs that all looked
// slightly different. Now: one component, one tone, one shape — pages
// pick a primary action, optional icon, optional secondary CTA.
//
// Empty states are easy to underinvest in but high-leverage. The first
// visit to a page after signup IS an empty state — first impressions
// of every feature live or die here.

import Link from 'next/link';
import clsx from 'clsx';

export interface EmptyStateProps {
  icon?: React.ElementType;
  /** Bold one-liner — the first thing the user reads. */
  title: string;
  /** Optional 1-2 sentences explaining what unlocks once they take the action. */
  description?: string;
  /** Primary CTA. Either an internal link (`href`) or a click handler (`onClick`). */
  primary?: { label: string; href?: string; onClick?: () => void };
  /** Optional secondary action — usually a "Learn more" link or alternative path. */
  secondary?: { label: string; href?: string; onClick?: () => void };
  /** Tone — accent for nudge / muted for "nothing here yet". */
  tone?: 'accent' | 'muted';
  className?: string;
}

export function EmptyState({
  icon: Icon, title, description, primary, secondary, tone = 'muted', className,
}: EmptyStateProps) {
  const containerTone = tone === 'accent'
    ? 'bg-accent/[0.03] border-accent/25'
    : 'bg-surface-2/60 border-dashed border-card-border';
  const iconTone = tone === 'accent'
    ? 'bg-accent/10 border-accent/30 text-accent'
    : 'bg-surface-3 border-card-border text-muted-foreground';

  return (
    <div className={clsx(
      'rounded-2xl p-6 sm:p-8 border flex flex-col items-center text-center gap-3',
      containerTone, className,
    )}>
      {Icon && (
        <div className={clsx('w-12 h-12 rounded-2xl border flex items-center justify-center', iconTone)}>
          <Icon className="w-5 h-5" />
        </div>
      )}
      <div className="space-y-1.5 max-w-sm">
        <h3 className="text-base font-semibold tracking-tight">{title}</h3>
        {description && (
          <p className="text-[12px] text-muted-foreground leading-relaxed">{description}</p>
        )}
      </div>
      {(primary || secondary) && (
        <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
          {primary && <CtaButton {...primary} variant="primary" />}
          {secondary && <CtaButton {...secondary} variant="secondary" />}
        </div>
      )}
    </div>
  );
}

function CtaButton({
  label, href, onClick, variant,
}: {
  label: string;
  href?: string;
  onClick?: () => void;
  variant: 'primary' | 'secondary';
}) {
  const className = variant === 'primary'
    ? 'inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-accent text-black text-xs font-semibold hover:bg-accent-bright transition-colors'
    : 'inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-surface-3 border border-card-border text-xs font-medium text-muted-foreground hover:text-foreground transition-colors';
  if (href) return <Link href={href} className={className}>{label}</Link>;
  return <button onClick={onClick} className={className}>{label}</button>;
}
