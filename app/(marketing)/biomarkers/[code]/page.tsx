// Programmatic SEO page — one for each biomarker in BIOMARKER_DB (33 pages).
// Targets long-tail searches: "what is hsCRP optimal range", "ApoB Bryan
// Johnson", "homocysteine high what to do". No auth; public; statically
// generated at build time so it's fast + indexable.

import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { BIOMARKER_DB, CATEGORY_LABELS, getBiomarkerRef } from '@/lib/engine/biomarkers';
import { getPatternsForBiomarker } from '@/lib/engine/patterns';
import { BryanGapBar } from '@/components/dashboard/BryanGapBar';
import { SITE_URL } from '@/lib/config';
import { ArrowRight, Target, AlertTriangle, Leaf, Pill, Activity, Utensils, Stethoscope, Sparkles } from 'lucide-react';

// Pre-render all 33 biomarker pages at build time.
export async function generateStaticParams() {
  return BIOMARKER_DB.map(b => ({ code: b.code.toLowerCase() }));
}

// Per-page title/description pulled from the same BIOMARKER_DB the engine
// uses — keeps marketing copy in sync with the protocol scoring.
export async function generateMetadata({ params }: { params: Promise<{ code: string }> }): Promise<Metadata> {
  const { code } = await params;
  const b = getBiomarkerRef(code.toUpperCase());
  if (!b) return { title: 'Biomarker not found' };

  const title = `${b.shortName} (${b.name}) — Longevity-Optimal Range, Bryan Johnson Target`;
  const description = `What ${b.shortName} is, why it matters for longevity, the optimal range (${b.longevityOptimalLow}-${b.longevityOptimalHigh} ${b.unit}), Bryan Johnson's target${b.bryanJohnsonValue !== undefined ? ` (${b.bryanJohnsonValue} ${b.unit})` : ''}, and what to do if yours is off.`;

  return {
    title,
    description,
    alternates: { canonical: `${SITE_URL}/biomarkers/${code.toLowerCase()}` },
    openGraph: {
      title,
      description,
      url: `${SITE_URL}/biomarkers/${code.toLowerCase()}`,
      type: 'article',
    },
  };
}

export default async function BiomarkerPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const b = getBiomarkerRef(code.toUpperCase());
  if (!b) return notFound();

  const categoryLabel = CATEGORY_LABELS[b.category] || b.category;
  const hasBryan = b.bryanJohnsonValue !== undefined;
  const relatedPatterns = getPatternsForBiomarker(b.code);

  // JSON-LD structured data so search engines treat this as a medical
  // reference article, not generic content. MedicalCondition/MedicalTest
  // schemas are appropriate for biomarker definitions.
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'MedicalTest',
    name: b.name,
    alternateName: b.shortName,
    description: b.description,
    usedToDiagnose: categoryLabel,
    normalRange: `${b.longevityOptimalLow}-${b.longevityOptimalHigh} ${b.unit}`,
  };

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* Header nav */}
      <header className="border-b border-card-border bg-background/80 backdrop-blur-xl sticky top-0 z-40">
        <div className="max-w-4xl mx-auto px-6 py-3 flex items-center justify-between">
          <Link href="/" className="text-accent font-bold text-lg tracking-tight">Protocol</Link>
          <Link href="/login" className="text-xs font-medium text-muted-foreground hover:text-accent transition-colors">
            Get your protocol →
          </Link>
        </div>
      </header>

      <article className="max-w-3xl mx-auto px-6 py-10 sm:py-16 space-y-10">
        {/* Breadcrumb */}
        <nav className="text-xs text-muted flex items-center gap-1.5">
          <Link href="/" className="hover:text-accent transition-colors">Home</Link>
          <span>·</span>
          <Link href="/biomarkers" className="hover:text-accent transition-colors">Biomarkers</Link>
          <span>·</span>
          <span className="text-foreground">{b.shortName}</span>
        </nav>

        {/* Hero */}
        <div className="space-y-4">
          <span className="inline-block text-xs font-mono uppercase tracking-widest text-accent bg-accent/10 border border-accent/25 rounded-full px-3 py-1">
            {categoryLabel}
          </span>
          <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight">
            {b.name} <span className="text-muted-foreground font-normal">({b.shortName})</span>
          </h1>
          <p className="text-sm sm:text-base text-muted-foreground leading-relaxed max-w-2xl">
            {b.description}
          </p>
        </div>

        {/* Visual anchor: where the population average sits vs optimal + Bryan.
            Users immediately see what it means to be "in range" before they
            get to the numbers. Uses the population midpoint as a stand-in for
            "you if you're typical" — the protocol itself renders the same
            bar with the user's real value for authed sessions. */}
        {hasBryan && b.bryanJohnsonValue !== undefined && (
          <section className="glass-card rounded-2xl p-5 space-y-3">
            <div className="flex items-baseline justify-between gap-2">
              <p className="text-xs font-mono uppercase tracking-widest text-muted">Where people fall vs Bryan</p>
              <p className="text-xs text-muted">
                <span className="inline-block w-2 h-2 rounded-full bg-accent align-middle" /> optimal band
                <span className="mx-2">·</span>
                <span className="inline-block w-2 h-2 rotate-45 bg-amber-400 align-middle" /> Bryan
                <span className="mx-2">·</span>
                <span className="inline-block w-[3px] h-3 bg-muted-foreground align-middle" /> population avg
              </p>
            </div>
            <BryanGapBar
              userValue={(b.populationAvgLow + b.populationAvgHigh) / 2}
              bryanValue={b.bryanJohnsonValue}
              optimalLow={b.longevityOptimalLow}
              optimalHigh={b.longevityOptimalHigh}
              unit={b.unit}
              height={14}
            />
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Population average: <span className="text-foreground font-medium">{((b.populationAvgLow + b.populationAvgHigh) / 2).toFixed(1)} {b.unit}</span>.
              Bryan targets <span className="text-accent font-medium">{b.bryanJohnsonValue} {b.unit}</span> — {b.bryanJohnsonValue >= b.longevityOptimalLow && b.bryanJohnsonValue <= b.longevityOptimalHigh ? 'squarely inside the longevity-optimal band' : 'at the tight edge of longevity-optimal'}.
            </p>
          </section>
        )}

        {/* Range table */}
        <section className="grid sm:grid-cols-3 gap-3">
          <div className="glass-card rounded-2xl p-5 space-y-2">
            <div className="flex items-center gap-2 text-accent">
              <Target className="w-4 h-4" />
              <span className="text-xs font-mono uppercase tracking-widest">Longevity-optimal</span>
            </div>
            <p className="text-2xl font-semibold font-mono tabular-nums">
              {b.longevityOptimalLow}<span className="text-muted text-lg">–</span>{b.longevityOptimalHigh}
              <span className="text-sm text-muted ml-1">{b.unit}</span>
            </p>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Tighter than standard lab ranges — derived from longevity literature.
            </p>
          </div>
          <div className="glass-card rounded-2xl p-5 space-y-2">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Activity className="w-4 h-4" />
              <span className="text-xs font-mono uppercase tracking-widest">Lab reference</span>
            </div>
            <p className="text-2xl font-semibold font-mono tabular-nums text-muted-foreground">
              {b.populationAvgLow}<span className="text-muted text-lg">–</span>{b.populationAvgHigh}
              <span className="text-sm text-muted ml-1">{b.unit}</span>
            </p>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Standard population-based range your lab flags.
            </p>
          </div>
          {hasBryan && (
            <div className="glass-card rounded-2xl p-5 space-y-2 border-accent/30">
              <div className="flex items-center gap-2 text-accent">
                <span className="text-sm">🎯</span>
                <span className="text-xs font-mono uppercase tracking-widest">Bryan Johnson</span>
              </div>
              <p className="text-2xl font-semibold font-mono tabular-nums text-accent">
                {b.bryanJohnsonValue}
                <span className="text-sm text-muted ml-1">{b.unit}</span>
              </p>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Bryan&apos;s measured value from Blueprint protocol.
              </p>
            </div>
          )}
        </section>

        {/* What to do if HIGH */}
        {b.interventionsIfHigh && (b.interventionsIfHigh.lifestyle.length > 0 || b.interventionsIfHigh.supplements.length > 0) && (
          <section className="space-y-4">
            <h2 className="text-xl font-semibold tracking-tight flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-400" />
              If your {b.shortName} is high
            </h2>

            {b.interventionsIfHigh.lifestyle.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-accent mb-2 flex items-center gap-1.5">
                  <Leaf className="w-3.5 h-3.5" /> Lifestyle
                </h3>
                <ul className="space-y-1.5 text-sm text-muted-foreground">
                  {b.interventionsIfHigh.lifestyle.map((l, i) => <li key={i} className="flex gap-2"><span className="text-accent">•</span>{l}</li>)}
                </ul>
              </div>
            )}

            {b.interventionsIfHigh.supplements.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-accent mb-2 flex items-center gap-1.5">
                  <Pill className="w-3.5 h-3.5" /> Supplements (discuss with doctor)
                </h3>
                <ul className="space-y-1.5 text-sm text-muted-foreground">
                  {b.interventionsIfHigh.supplements.map((s, i) => (
                    <li key={i} className="flex gap-2">
                      <span className="text-accent">•</span>
                      <span><strong className="text-foreground">{s.name}</strong> — {s.dose} <span className="text-xs uppercase tracking-wider text-muted ml-1">[{s.priority}]</span></span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {b.interventionsIfHigh.foods_add.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-accent mb-2 flex items-center gap-1.5">
                  <Utensils className="w-3.5 h-3.5" /> Foods to add
                </h3>
                <p className="text-sm text-muted-foreground">{b.interventionsIfHigh.foods_add.join(' · ')}</p>
              </div>
            )}

            {b.interventionsIfHigh.foods_avoid.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-danger mb-2">Foods to avoid</h3>
                <p className="text-sm text-muted-foreground">{b.interventionsIfHigh.foods_avoid.join(' · ')}</p>
              </div>
            )}

            {b.interventionsIfHigh.medical.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-accent mb-2 flex items-center gap-1.5">
                  <Stethoscope className="w-3.5 h-3.5" /> Medical follow-up
                </h3>
                <ul className="space-y-1.5 text-sm text-muted-foreground">
                  {b.interventionsIfHigh.medical.map((m, i) => <li key={i} className="flex gap-2"><span className="text-accent">•</span>{m}</li>)}
                </ul>
              </div>
            )}
          </section>
        )}

        {/* What to do if LOW */}
        {b.interventionsIfLow && (b.interventionsIfLow.lifestyle.length > 0 || b.interventionsIfLow.supplements.length > 0) && (
          <section className="space-y-4">
            <h2 className="text-xl font-semibold tracking-tight flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-400" />
              If your {b.shortName} is low
            </h2>

            {b.interventionsIfLow.lifestyle.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-accent mb-2 flex items-center gap-1.5">
                  <Leaf className="w-3.5 h-3.5" /> Lifestyle
                </h3>
                <ul className="space-y-1.5 text-sm text-muted-foreground">
                  {b.interventionsIfLow.lifestyle.map((l, i) => <li key={i} className="flex gap-2"><span className="text-accent">•</span>{l}</li>)}
                </ul>
              </div>
            )}

            {b.interventionsIfLow.supplements.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-accent mb-2 flex items-center gap-1.5">
                  <Pill className="w-3.5 h-3.5" /> Supplements (discuss with doctor)
                </h3>
                <ul className="space-y-1.5 text-sm text-muted-foreground">
                  {b.interventionsIfLow.supplements.map((s, i) => (
                    <li key={i} className="flex gap-2">
                      <span className="text-accent">•</span>
                      <span><strong className="text-foreground">{s.name}</strong> — {s.dose} <span className="text-xs uppercase tracking-wider text-muted ml-1">[{s.priority}]</span></span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {b.interventionsIfLow.foods_add.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-accent mb-2 flex items-center gap-1.5">
                  <Utensils className="w-3.5 h-3.5" /> Foods to add
                </h3>
                <p className="text-sm text-muted-foreground">{b.interventionsIfLow.foods_add.join(' · ')}</p>
              </div>
            )}

            {b.interventionsIfLow.medical.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-accent mb-2 flex items-center gap-1.5">
                  <Stethoscope className="w-3.5 h-3.5" /> Medical follow-up
                </h3>
                <ul className="space-y-1.5 text-sm text-muted-foreground">
                  {b.interventionsIfLow.medical.map((m, i) => <li key={i} className="flex gap-2"><span className="text-accent">•</span>{m}</li>)}
                </ul>
              </div>
            )}
          </section>
        )}

        {/* Retest cadence */}
        {b.retestIntervalWeeks > 0 && (
          <section className="glass-card rounded-2xl p-5">
            <p className="text-sm">
              <strong>Retest every {b.retestIntervalWeeks} {b.retestIntervalWeeks === 1 ? 'week' : 'weeks'}</strong>
              <span className="text-muted-foreground"> after starting an intervention to see if it&apos;s working.</span>
            </p>
          </section>
        )}

        {/* Related patterns — internal SEO link juice + user comprehension */}
        {relatedPatterns.length > 0 && (
          <section className="space-y-4">
            <h2 className="text-xl font-semibold tracking-tight flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-accent" />
              Clinical patterns {b.shortName} can trigger
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {relatedPatterns.map(p => (
                <Link
                  key={p.slug}
                  href={`/patterns/${p.slug}`}
                  className="group rounded-xl p-3.5 bg-surface-2 border border-card-border hover:border-accent/40 transition-colors flex items-center justify-between gap-2"
                >
                  <span className="text-sm font-medium text-foreground group-hover:text-accent transition-colors">{p.name}</span>
                  <ArrowRight className="w-4 h-4 text-muted group-hover:text-accent group-hover:translate-x-0.5 transition-all shrink-0" />
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* CTA */}
        <section className="rounded-3xl bg-gradient-to-br from-accent/10 via-accent/[0.03] to-transparent border border-accent/25 p-6 sm:p-8 text-center space-y-4">
          <h2 className="text-xl sm:text-2xl font-semibold tracking-tight">
            Get a protocol tuned to <span className="text-accent">your</span> {b.shortName}
          </h2>
          <p className="text-sm text-muted-foreground max-w-md mx-auto leading-relaxed">
            Upload a lab panel, get a personalized longevity protocol in under 60 seconds. Free during beta.
          </p>
          <Link
            href="/login?mode=register"
            className="inline-flex items-center gap-2 bg-accent text-black font-semibold text-sm px-6 py-3 rounded-xl hover:bg-accent-bright transition-colors"
          >
            Get started <ArrowRight className="w-4 h-4" />
          </Link>
        </section>

        {/* Disclaimer */}
        <p className="text-xs text-muted text-center leading-relaxed">
          Educational content · not medical advice · always discuss changes with your doctor
        </p>
      </article>
    </div>
  );
}
