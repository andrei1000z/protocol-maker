// Dashboard skeleton. Matches the real layout's rough proportions so the
// page doesn't jump when the protocol JSON arrives — stable perceived
// performance is a bigger UX win than the spinner-over-blank we used to show.
//
// Design: uses `animate-pulse` on the skeleton rectangles with a subtle
// brightness variation for depth. Three visible sections match the top of
// the real dashboard (hero tiles, organ radar, and first content card).
export default function DashboardLoading() {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 space-y-6 animate-fade-in">
      {/* Hero tiles row — mirrors the three-metric strip on the real dashboard. */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[0, 1, 2].map(i => (
          <div key={i} className="relative overflow-hidden rounded-2xl border border-card-border bg-surface-2 p-5 h-[160px]">
            <div className="h-3 w-24 rounded bg-surface-3 animate-pulse" />
            <div className="h-10 w-28 rounded bg-surface-3 animate-pulse mt-3" />
            <div className="h-2 w-40 rounded bg-surface-3 animate-pulse mt-3" />
            <div className="h-2 w-20 rounded bg-surface-3 animate-pulse mt-2" />
          </div>
        ))}
      </div>

      {/* Organ radar placeholder — square. */}
      <div className="rounded-2xl border border-card-border bg-surface-2 p-5 space-y-3">
        <div className="h-3 w-32 rounded bg-surface-3 animate-pulse" />
        <div className="h-[280px] w-full rounded-xl bg-surface-3/60 animate-pulse" />
      </div>

      {/* Biomarkers list placeholder — three rows. */}
      <div className="rounded-2xl border border-card-border bg-surface-2 p-5 space-y-3">
        <div className="h-3 w-24 rounded bg-surface-3 animate-pulse" />
        {[0, 1, 2, 3].map(i => (
          <div key={i} className="flex items-center justify-between rounded-xl border border-card-border bg-surface-3/50 px-4 py-3">
            <div className="space-y-2">
              <div className="h-3 w-24 rounded bg-surface-3 animate-pulse" />
              <div className="h-2 w-40 rounded bg-surface-3 animate-pulse" />
            </div>
            <div className="h-6 w-16 rounded bg-surface-3 animate-pulse" />
          </div>
        ))}
      </div>

      <p className="text-[11px] text-muted text-center font-mono">Loading your protocol…</p>
    </div>
  );
}
