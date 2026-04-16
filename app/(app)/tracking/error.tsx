'use client';

export default function TrackingError({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="flex items-center justify-center min-h-[60vh] px-6">
      <div className="text-center space-y-4">
        <p className="text-4xl">⚠️</p>
        <h2 className="text-xl font-bold">Failed to load tracking</h2>
        <p className="text-sm text-muted-foreground">{error.message}</p>
        <button onClick={reset} className="px-4 py-2 bg-accent text-black rounded-xl text-sm font-medium">Try again</button>
      </div>
    </div>
  );
}
