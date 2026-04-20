// Biomarker index — one link per entry in BIOMARKER_DB, grouped by category.
// Acts as a sitemap-like hub for SEO: internal-link anchor for every per-
// biomarker page, also a useful reference page in its own right.

import type { Metadata } from 'next';
import Link from 'next/link';
import { BIOMARKER_DB, CATEGORY_LABELS } from '@/lib/engine/biomarkers';
import { SITE_URL } from '@/lib/config';
import { ArrowRight } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Biomarker Reference — Longevity-Optimal Ranges + Bryan Johnson Targets',
  description: `All ${BIOMARKER_DB.length} biomarkers Protocol analyzes, with longevity-optimal ranges tighter than standard lab ranges, Bryan Johnson's measured values, and what to do if yours are off.`,
  alternates: { canonical: `${SITE_URL}/biomarkers` },
};

export default function BiomarkerIndex() {
  // Group by category, sorted alphabetically within each category
  const byCategory: Record<string, typeof BIOMARKER_DB> = {};
  for (const b of BIOMARKER_DB) {
    (byCategory[b.category] ??= []).push(b);
  }
  for (const c of Object.keys(byCategory)) {
    byCategory[c].sort((a, b) => a.shortName.localeCompare(b.shortName));
  }

  const orderedCategories = Object.keys(byCategory).sort((a, b) =>
    (CATEGORY_LABELS[a] || a).localeCompare(CATEGORY_LABELS[b] || b)
  );

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

      <main className="max-w-5xl mx-auto px-6 py-10 sm:py-16 space-y-10">
        <div className="space-y-3 max-w-2xl">
          <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight">
            Biomarker reference
          </h1>
          <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">
            {BIOMARKER_DB.length} biomarkers with <strong className="text-foreground">longevity-optimal</strong> ranges (tighter than lab-normal), Bryan Johnson&apos;s measured values where known, and actionable interventions if yours are off.
          </p>
        </div>

        {orderedCategories.map(cat => (
          <section key={cat} className="space-y-4">
            <h2 className="text-xl font-semibold tracking-tight">
              {CATEGORY_LABELS[cat] || cat}
              <span className="text-sm font-normal text-muted-foreground ml-2">({byCategory[cat].length})</span>
            </h2>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {byCategory[cat].map(b => (
                <Link
                  key={b.code}
                  href={`/biomarkers/${b.code.toLowerCase()}`}
                  className="glass-card rounded-2xl p-4 hover:border-accent/40 transition-colors group"
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="text-sm font-semibold tracking-tight">{b.shortName}</p>
                    <ArrowRight className="w-3.5 h-3.5 text-muted group-hover:text-accent transition-colors shrink-0" />
                  </div>
                  <p className="text-[10px] text-muted mt-0.5 font-mono">{b.name}</p>
                  <p className="text-xs text-muted-foreground mt-2 leading-snug line-clamp-2">
                    Optimal {b.longevityOptimalLow}–{b.longevityOptimalHigh} {b.unit}
                    {b.bryanJohnsonValue !== undefined && <span className="text-accent"> · Bryan {b.bryanJohnsonValue}</span>}
                  </p>
                </Link>
              ))}
            </div>
          </section>
        ))}
      </main>
    </div>
  );
}
