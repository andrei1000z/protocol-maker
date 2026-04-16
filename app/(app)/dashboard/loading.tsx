export default function DashboardLoading() {
  return (
    <div className="flex items-center justify-center min-h-dvh">
      <div className="text-center space-y-4">
        <div className="w-10 h-10 border-2 border-accent border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-sm text-muted-foreground">Se încarcă protocolul...</p>
      </div>
    </div>
  );
}
