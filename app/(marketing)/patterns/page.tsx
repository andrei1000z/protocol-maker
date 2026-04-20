import type { Metadata } from 'next';
import Link from 'next/link';
import { PATTERN_REFERENCE } from '@/lib/engine/patterns';
import { SITE_URL } from '@/lib/config';
import { ArrowRight } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Clinical Patterns Protocol Detects — Metabolic Syndrome, Prediabetes, and more',
  description: `${PATTERN_REFERENCE.length} patterns Protocol detects from your bloodwork — each with a plain-English explanation and reversible-intervention roadmap.`,
  alternates: { canonical: `${SITE_URL}/patterns` },
};

export default function PatternIndex() {
  return (
    <div className="min-h-dvh bg-background text-foreground">
      <header className="border-b border-card-border bg-background/80 backdrop-blur-xl sticky top-0 z-40">
        <div className="max-w-5xl mx-auto px-6 py-3 flex items-center justify-between">
          <Link href="/" className="text-accent font-bold text-lg tracking-tight">Protocol</Link>
          <Link href="/login" className="text-xs font-medium text-muted-foreground hover:text-accent transition-colors">
            Get your protocol →
          </Link>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-10 sm:py-16 space-y-10">
        <div className="space-y-3 max-w-2xl">
          <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight">Clinical patterns</h1>
          <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">
            Protocol detects <strong className="text-foreground">{PATTERN_REFERENCE.length}</strong> patterns in your bloodwork — each one triggers a reversible intervention roadmap.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 gap-3">
          {PATTERN_REFERENCE.map(p => (
            <Link
              key={p.slug}
              href={`/patterns/${p.slug}`}
              className="glass-card rounded-2xl p-5 hover:border-accent/40 transition-colors group"
            >
              <div className="flex items-baseline justify-between gap-2 mb-2">
                <p className="text-base font-semibold tracking-tight">{p.name}</p>
                <ArrowRight className="w-3.5 h-3.5 text-muted group-hover:text-accent transition-colors shrink-0" />
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed line-clamp-3">
                {p.description}
              </p>
            </Link>
          ))}
        </div>
      </main>
    </div>
  );
}
