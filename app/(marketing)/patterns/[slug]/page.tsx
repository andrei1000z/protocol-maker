// Programmatic SEO page — one for each clinical pattern. Targets searches
// like "metabolic syndrome how to reverse", "prediabetes natural interventions",
// "liver stress supplements". Static-generated at build.

import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PATTERN_REFERENCE, getPatternRef } from '@/lib/engine/patterns';
import { BIOMARKER_DB } from '@/lib/engine/biomarkers';
import { SITE_URL } from '@/lib/config';
import { ArrowRight, Sparkles, Activity } from 'lucide-react';

export async function generateStaticParams() {
  return PATTERN_REFERENCE.map(p => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const p = getPatternRef(slug);
  if (!p) return { title: 'Pattern not found' };

  const title = `${p.name} — What It Means + How to Reverse It`;
  const description = p.description.length > 155 ? p.description.slice(0, 152) + '…' : p.description;
  return {
    title,
    description,
    alternates: { canonical: `${SITE_URL}/patterns/${slug}` },
    openGraph: { title, description, url: `${SITE_URL}/patterns/${slug}`, type: 'article' },
  };
}

export default async function PatternPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const p = getPatternRef(slug);
  if (!p) return notFound();

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'MedicalCondition',
    name: p.name,
    description: p.description,
  };

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <header className="border-b border-card-border bg-background/80 backdrop-blur-xl sticky top-0 z-40">
        <div className="max-w-4xl mx-auto px-6 py-3 flex items-center justify-between">
          <Link href="/" className="text-accent font-bold text-lg tracking-tight">Protocol</Link>
          <Link href="/login" className="text-xs font-medium text-muted-foreground hover:text-accent transition-colors">
            Vreau protocolul →
          </Link>
        </div>
      </header>

      <article className="max-w-3xl mx-auto px-6 py-10 sm:py-16 space-y-10">
        <nav className="text-xs text-muted flex items-center gap-1.5">
          <Link href="/" className="hover:text-accent transition-colors">Acasă</Link>
          <span>·</span>
          <Link href="/patterns" className="hover:text-accent transition-colors">Tipare</Link>
          <span>·</span>
          <span className="text-foreground">{p.name}</span>
        </nav>

        <div className="space-y-4">
          <span className="inline-block text-xs font-mono uppercase tracking-widest text-accent bg-accent/10 border border-accent/25 rounded-full px-3 py-1">
            Tipar clinic
          </span>
          <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight">{p.name}</h1>
          <p className="text-sm sm:text-base text-muted-foreground leading-relaxed max-w-2xl">
            {p.description}
          </p>
        </div>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold tracking-tight flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-accent" />
            Cum îl adresezi
          </h2>
          <ul className="space-y-2.5">
            {p.recommendations.map((r, i) => (
              <li key={i} className="flex gap-3 items-start p-3.5 rounded-xl bg-surface-2 border border-card-border">
                <span className="w-6 h-6 rounded-full bg-accent/10 border border-accent/25 flex items-center justify-center text-xs font-semibold text-accent shrink-0">
                  {i + 1}
                </span>
                <span className="text-sm text-foreground/90 leading-relaxed">{r}</span>
              </li>
            ))}
          </ul>
        </section>

        {p.triggeringCodes.length > 0 && (
          <section className="space-y-4">
            <h2 className="text-xl font-semibold tracking-tight flex items-center gap-2">
              <Activity className="w-5 h-5 text-accent" />
              Biomarkerii care declanșează acest tipar
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {p.triggeringCodes.map(code => {
                const ref = BIOMARKER_DB.find(b => b.code === code);
                if (!ref) return null;
                return (
                  <Link
                    key={code}
                    href={`/biomarkers/${code.toLowerCase()}`}
                    className="group rounded-xl p-3 bg-surface-2 border border-card-border hover:border-accent/40 transition-colors"
                  >
                    <p className="text-xs font-semibold text-foreground group-hover:text-accent transition-colors">{ref.shortName || ref.name}</p>
                    <p className="text-xs text-muted mt-0.5 uppercase tracking-widest">{code}</p>
                  </Link>
                );
              })}
            </div>
          </section>
        )}

        <section className="rounded-3xl bg-gradient-to-br from-accent/10 via-accent/[0.03] to-transparent border border-accent/25 p-6 sm:p-8 text-center space-y-4">
          <h2 className="text-xl sm:text-2xl font-semibold tracking-tight">
            Vezi dacă ai {p.name.toLowerCase()}
          </h2>
          <p className="text-sm text-muted-foreground max-w-md mx-auto leading-relaxed">
            Urcă buletinul de analize și Protocol detectează {PATTERN_REFERENCE.length} tipare clinice, apoi generează un plan personalizat să le inversezi pe cele pe care le ai.
          </p>
          <Link
            href="/login?mode=register"
            className="inline-flex items-center gap-2 bg-accent text-black font-semibold text-sm px-6 py-3 rounded-xl hover:bg-accent-bright transition-colors"
          >
            Începe <ArrowRight className="w-4 h-4" />
          </Link>
        </section>

        <p className="text-xs text-muted text-center leading-relaxed">
          Conținut educațional · nu e sfat medical · discută întotdeauna modificările cu medicul tău
        </p>
      </article>
    </div>
  );
}
