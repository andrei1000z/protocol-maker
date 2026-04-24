'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { RotateCcw, AlertOctagon } from 'lucide-react';

/**
 * Global error boundary. Catches any unhandled exception in the app layout
 * tree and shows a friendly retry page. Posts a structured error event to
 * the server logger so ops can find it alongside API errors (instead of
 * a bare console.error that would bypass our redaction pipeline).
 */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // Fire-and-forget — ignore failures. The page already renders a useful
    // fallback regardless of whether the log call succeeds.
    const payload = {
      event: 'client.unhandled_error',
      digest: error?.digest || null,
      message: (error?.message || '').slice(0, 500),
      name: error?.name || null,
      url: typeof window !== 'undefined' ? window.location.href : null,
    };
    fetch('/api/client-log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      keepalive: true,
    }).catch(() => { /* offline / network gone — nothing to do */ });
  }, [error]);

  return (
    <div className="min-h-dvh flex items-center justify-center px-6">
      <div className="max-w-md w-full text-center space-y-6 animate-fade-in-up">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/25 text-danger">
          <AlertOctagon className="w-8 h-8" />
        </div>
        <div>
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">Something broke</h1>
          <p className="text-sm text-muted-foreground mt-3 leading-relaxed">
            This is on us, not you. Your data is safe. Try once more, and if it persists, refresh the page.
          </p>
          {error?.digest && (
            <p className="text-xs text-muted mt-3 font-mono">error id: {error.digest}</p>
          )}
        </div>
        <div className="flex items-center justify-center gap-2 flex-wrap">
          <button
            onClick={reset}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-accent text-black text-sm font-semibold hover:bg-accent-bright transition-colors glow-cta"
          >
            <RotateCcw className="w-4 h-4" />
            Try again
          </button>
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-surface-2 border border-card-border text-sm text-muted-foreground hover:text-foreground hover:border-card-border-hover transition-colors"
          >
            Back to dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
