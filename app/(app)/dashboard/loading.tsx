export default function DashboardLoading() {
  // Smaller min-h than dvh so it aligns with the rest of the app's loading
  // states + consistent EN copy (the whole app UI is English; only marketing
  // copy should be translated per README § Positioning).
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="text-center space-y-4">
        <div className="w-10 h-10 border-2 border-accent border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-sm text-muted-foreground">Loading your protocol…</p>
      </div>
    </div>
  );
}
