'use client';

// Empty-state inside a section card. When `allowRegenerate` is true an
// inline button fires /api/generate-protocol so the user doesn't have to
// scroll to the footer to refresh a partial protocol.

export interface DashboardEmptyStateProps {
  message: string;
  allowRegenerate?: boolean;
}

export function DashboardEmptyState({ message, allowRegenerate }: DashboardEmptyStateProps) {
  const regen = async () => {
    const res = await fetch('/api/generate-protocol', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ profile: {}, biomarkers: [] }),
    });
    if (res.ok) window.location.href = '/dashboard';
    else window.location.href = '/onboarding';
  };
  return (
    <div className="p-8 rounded-xl bg-background/50 border border-dashed border-card-border text-center space-y-3">
      <p className="text-xs text-muted-foreground">{message}</p>
      {allowRegenerate ? (
        <div className="space-y-2">
          <p className="text-xs text-muted">Pare o generare incompletă — regenerează ca să se completeze.</p>
          <button onClick={regen} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent text-black text-xs font-semibold hover:bg-accent-bright transition-colors">
            ↻ Regenerează protocolul
          </button>
        </div>
      ) : (
        <p className="text-xs text-muted mt-1.5">Adaugă analize sau completează onboarding pentru date mai bogate.</p>
      )}
    </div>
  );
}
