'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { RotateCcw, AlertOctagon } from 'lucide-react';

/**
 * Global error boundary. Catches any unhandled exception in the app layout
 * tree and shows a friendly retry page. Logs to console (and Vercel logs)
 * for post-mortem.
 */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error('Unhandled app error:', error);
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
            <p className="text-[10px] text-muted mt-3 font-mono">error id: {error.digest}</p>
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
