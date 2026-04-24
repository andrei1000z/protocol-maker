'use client';

export default function HistoryError({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="flex items-center justify-center min-h-[60vh] px-6">
      <div className="text-center space-y-4 max-w-sm">
        <p className="text-4xl">⚠️</p>
        <h2 className="text-xl font-bold">Istoricul nu s-a încărcat</h2>
        <p className="text-sm text-muted-foreground">{error.message || 'Nu am putut încărca istoricul protocolului acum.'}</p>
        <div className="flex gap-3 justify-center">
          <button onClick={reset} className="px-4 py-2 bg-accent text-black rounded-xl text-sm font-medium">Încearcă din nou</button>
          <a href="/dashboard" className="px-4 py-2 bg-card border border-card-border rounded-xl text-sm text-muted-foreground">Înapoi la protocol</a>
        </div>
      </div>
    </div>
  );
}
