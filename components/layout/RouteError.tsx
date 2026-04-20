'use client';

// Shared error-boundary UI used by each `app/.../error.tsx`. Keeps the
// visual + logging contract consistent across marketing / auth / app / share
// routes without copy-pasting the same 40 lines five times.

import { useEffect } from 'react';
import Link from 'next/link';
import { RotateCcw, AlertOctagon } from 'lucide-react';

interface Props {
  error: Error & { digest?: string };
  reset: () => void;
  /** One-line context for the error event sent to the server logger. */
  scope: string;
  /** Friendly title shown to the user. */
  title?: string;
  /** Friendly body text. */
  body?: string;
  /** Where "Back" should go (defaults to home). */
  backHref?: string;
  backLabel?: string;
}

export function RouteError({
  error, reset, scope,
  title = 'Something broke',
  body = 'This is on us, not you. Your data is safe. Try once more, and if it persists, refresh the page.',
  backHref = '/',
  backLabel = 'Back to home',
}: Props) {
  useEffect(() => {
    fetch('/api/client-log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event: `client.${scope}.error`,
        digest: error?.digest || null,
        message: (error?.message || '').slice(0, 500),
        name: error?.name || null,
        url: typeof window !== 'undefined' ? window.location.href : null,
      }),
      keepalive: true,
    }).catch(() => { /* ignore */ });
  }, [error, scope]);

  return (
    <div className="min-h-dvh flex items-center justify-center px-6">
      <div className="max-w-md w-full text-center space-y-6 animate-fade-in-up">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/25 text-danger">
          <AlertOctagon className="w-8 h-8" />
        </div>
        <div>
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">{title}</h1>
          <p className="text-sm text-muted-foreground mt-3 leading-relaxed">{body}</p>
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
            href={backHref}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-surface-2 border border-card-border text-sm text-muted-foreground hover:text-foreground hover:border-card-border-hover transition-colors"
          >
            {backLabel}
          </Link>
        </div>
      </div>
    </div>
  );
}
