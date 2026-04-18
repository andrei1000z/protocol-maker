'use client';

export default function OnboardingError({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="flex items-center justify-center min-h-[60vh] px-6">
      <div className="text-center space-y-4 max-w-sm">
        <p className="text-4xl">⚠️</p>
        <h2 className="text-xl font-bold">Onboarding hit a snag</h2>
        <p className="text-sm text-muted-foreground">{error.message || 'Something went wrong while saving your progress. Your answers are cached locally — try again.'}</p>
        <div className="flex gap-3 justify-center">
          <button onClick={reset} className="px-4 py-2 bg-accent text-black rounded-xl text-sm font-medium">Try again</button>
          <a href="/dashboard" className="px-4 py-2 bg-card border border-card-border rounded-xl text-sm text-muted-foreground">Back to dashboard</a>
        </div>
      </div>
    </div>
  );
}
