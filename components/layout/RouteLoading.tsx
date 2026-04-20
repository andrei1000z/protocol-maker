// Small centered spinner + one-line copy, shared by every app-route loading.tsx
// Server-renderable (no hooks, no state) so Next can show it the instant
// the navigation starts.
export function RouteLoading({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="text-center space-y-4">
        <div className="w-10 h-10 border-2 border-accent border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-sm text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}
