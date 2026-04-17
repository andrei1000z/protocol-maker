import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export const metadata = {
  title: 'Not found — Protocol',
  description: 'The page you\'re looking for doesn\'t exist.',
};

export default function NotFound() {
  return (
    <div className="min-h-dvh flex items-center justify-center px-6">
      <div className="max-w-md w-full text-center space-y-6 animate-fade-in-up">
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl hero-card text-accent text-5xl font-bold font-mono">
          404
        </div>
        <div>
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">Page not found</h1>
          <p className="text-sm text-muted-foreground mt-3 leading-relaxed">
            The page you&apos;re looking for moved, got renamed, or never existed. That&apos;s OK —
            your protocol is still right where you left it.
          </p>
        </div>
        <div className="flex items-center justify-center gap-2 flex-wrap">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-accent text-black text-sm font-semibold hover:bg-accent-bright transition-colors glow-cta"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to dashboard
          </Link>
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-surface-2 border border-card-border text-sm text-muted-foreground hover:text-foreground hover:border-card-border-hover transition-colors"
          >
            Home
          </Link>
        </div>
      </div>
    </div>
  );
}
