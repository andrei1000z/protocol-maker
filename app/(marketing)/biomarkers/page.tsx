// Biomarker index — one link per entry in BIOMARKER_DB.
// Server-renders a JSON-serializable item list, then hands it to an
// interactive client island (BiomarkerFinder) for search/filter/sort. The
// SSR payload stays indexable — only the filter UI needs JS.

import type { Metadata } from 'next';
import Link from 'next/link';
import { BIOMARKER_DB, CATEGORY_LABELS } from '@/lib/engine/biomarkers';
import { SITE_URL } from '@/lib/config';
import { BiomarkerFinder, type BiomarkerCard } from '@/components/biomarkers/BiomarkerFinder';

export const metadata: Metadata = {
  title: 'Ghid biomarkeri — Intervale optime pentru longevitate + Țintele lui Bryan Johnson',
  description: `Toți cei ${BIOMARKER_DB.length} biomarkeri analizați de Protocol, cu intervale optime pentru longevitate mai stricte decât cele standard, valorile măsurate ale lui Bryan Johnson și ce să faci dacă ai tăi sunt în afara țintei.`,
  alternates: { canonical: `${SITE_URL}/biomarkers` },
};

export default function BiomarkerIndex() {
  const items: BiomarkerCard[] = BIOMARKER_DB.map(b => ({
    code: b.code,
    name: b.name,
    shortName: b.shortName,
    category: b.category,
    categoryLabel: CATEGORY_LABELS[b.category] || b.category,
    unit: b.unit,
    longevityOptimalLow: b.longevityOptimalLow,
    longevityOptimalHigh: b.longevityOptimalHigh,
    bryanJohnsonValue: b.bryanJohnsonValue,
    populationAvgLow: b.populationAvgLow,
    populationAvgHigh: b.populationAvgHigh,
  }));

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <header className="border-b border-card-border bg-background/80 backdrop-blur-xl sticky top-0 z-40">
        <div className="max-w-5xl mx-auto px-6 py-3 flex items-center justify-between">
          <Link href="/" className="text-accent font-bold text-lg tracking-tight">Protocol</Link>
          <Link href="/login" className="text-xs font-medium text-muted-foreground hover:text-accent transition-colors">
            Vreau protocolul →
          </Link>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-10 sm:py-16 space-y-8">
        <div className="space-y-3 max-w-2xl">
          <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight">
            Ghid biomarkeri
          </h1>
          <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">
            {BIOMARKER_DB.length} biomarkeri cu intervale <strong className="text-foreground">optime pentru longevitate</strong> (mai stricte decât normalul de laborator), valorile măsurate ale lui Bryan Johnson acolo unde sunt cunoscute și intervenții concrete dacă ai tăi sunt în afara țintei.
          </p>
        </div>

        <BiomarkerFinder items={items} />

        {/* Fallback list for no-JS + SEO: hidden when the finder is
            interactive (it renders its own grid). Since this is a single
            page, we lean on the finder's SSR-rendered initial paint and
            skip the extra markup; the finder renders the complete grid
            on first render. */}
      </main>
    </div>
  );
}
