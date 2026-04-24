'use client';

// Interactive search/filter/sort for the /biomarkers index.
//
// The outer page is a server component (SEO-friendly URL → server-rendered
// links to every biomarker page). This client island layers search, category
// filter, and three sort orders on top without breaking static rendering —
// if JS is blocked, the user still sees the SSR-rendered grouped index
// (this component fades in and takes over the grid).

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Search, ArrowRight, X } from 'lucide-react';
import clsx from 'clsx';

// Mirror the shape the page passes down — we don't import BIOMARKER_DB here
// because the server component is the single source for the data and we
// want this to stay trivially testable with mock input.
export interface BiomarkerCard {
  code: string;
  name: string;
  shortName: string;
  category: string;
  categoryLabel: string;
  unit: string;
  longevityOptimalLow: number;
  longevityOptimalHigh: number;
  bryanJohnsonValue?: number;
  populationAvgLow: number;
  populationAvgHigh: number;
}

type SortKey = 'alpha' | 'bryan-first' | 'category';

export function BiomarkerFinder({ items }: { items: BiomarkerCard[] }) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>('category');

  const categories = useMemo(() => {
    const seen = new Map<string, string>();
    for (const b of items) if (!seen.has(b.category)) seen.set(b.category, b.categoryLabel);
    return [...seen.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [items]);

  // Filtered + sorted dataset. Re-runs only when the user types/clicks —
  // the items array itself is stable from the SSR payload.
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let arr = items;
    if (category) arr = arr.filter(b => b.category === category);
    if (q) {
      const words = q.split(/\s+/);
      arr = arr.filter(b => {
        const hay = `${b.code} ${b.name} ${b.shortName} ${b.categoryLabel}`.toLowerCase();
        return words.every(w => hay.includes(w));
      });
    }
    const sorted = [...arr];
    if (sortKey === 'alpha') {
      sorted.sort((a, b) => a.shortName.localeCompare(b.shortName));
    } else if (sortKey === 'bryan-first') {
      sorted.sort((a, b) => {
        const ab = a.bryanJohnsonValue !== undefined ? 1 : 0;
        const bb = b.bryanJohnsonValue !== undefined ? 1 : 0;
        if (ab !== bb) return bb - ab;
        return a.shortName.localeCompare(b.shortName);
      });
    } else {
      // category group → alpha within
      sorted.sort((a, b) => {
        const c = a.categoryLabel.localeCompare(b.categoryLabel);
        return c !== 0 ? c : a.shortName.localeCompare(b.shortName);
      });
    }
    return sorted;
  }, [items, query, category, sortKey]);

  return (
    <div className="space-y-5">
      {/* Search + sort controls */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-muted-foreground absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search biomarkers by name, code, or category…"
            aria-label="Search biomarkers"
            className="w-full pl-10 pr-10 py-3 rounded-xl bg-surface-2 border border-card-border text-sm outline-none focus:border-accent/50 placeholder:text-muted-foreground/50"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              aria-label="Clear search"
              className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-surface-3 transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        <select
          value={sortKey}
          onChange={e => setSortKey(e.target.value as SortKey)}
          aria-label="Sort biomarkers"
          className="px-3 py-3 rounded-xl bg-surface-2 border border-card-border text-sm outline-none focus:border-accent/50 cursor-pointer"
        >
          <option value="category">Group by category</option>
          <option value="alpha">A–Z</option>
          <option value="bryan-first">Bryan Johnson first</option>
        </select>
      </div>

      {/* Category pills */}
      <div className="flex flex-wrap gap-1.5">
        <button
          onClick={() => setCategory(null)}
          className={clsx('text-[11px] font-medium px-2.5 py-1 rounded-full border transition-colors',
            category === null ? 'bg-accent/10 text-accent border-accent/30' : 'bg-surface-2 text-muted-foreground border-card-border hover:text-foreground')}
        >
          All · {items.length}
        </button>
        {categories.map(([key, label]) => {
          const count = items.filter(b => b.category === key).length;
          const active = category === key;
          return (
            <button
              key={key}
              onClick={() => setCategory(active ? null : key)}
              className={clsx('text-[11px] font-medium px-2.5 py-1 rounded-full border transition-colors',
                active ? 'bg-accent/10 text-accent border-accent/30' : 'bg-surface-2 text-muted-foreground border-card-border hover:text-foreground')}
            >
              {label} · {count}
            </button>
          );
        })}
      </div>

      {/* Result count — confirms the filter took effect. */}
      <p className="text-[11px] text-muted font-mono">
        {filtered.length === items.length ? `${items.length} biomarkers` : `${filtered.length} of ${items.length}`}
      </p>

      {/* Grid */}
      {filtered.length === 0 ? (
        <div className="p-8 rounded-2xl bg-surface-2 border border-dashed border-card-border text-center">
          <p className="text-sm text-muted-foreground">No biomarkers match your search.</p>
          <button
            onClick={() => { setQuery(''); setCategory(null); }}
            className="mt-2 text-xs text-accent hover:underline"
          >Reset filters</button>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map(b => (
            <Link
              key={b.code}
              href={`/biomarkers/${b.code.toLowerCase()}`}
              className="glass-card rounded-2xl p-4 hover:border-accent/40 transition-colors group"
            >
              <div className="flex items-baseline justify-between gap-2">
                <p className="text-sm font-semibold tracking-tight">{b.shortName}</p>
                <ArrowRight className="w-3.5 h-3.5 text-muted group-hover:text-accent transition-colors shrink-0" />
              </div>
              <p className="text-xs text-muted mt-0.5 font-mono uppercase tracking-wider">{b.code}</p>
              <p className="text-xs text-muted-foreground mt-2 leading-snug line-clamp-2">
                Optimal {b.longevityOptimalLow}–{b.longevityOptimalHigh} {b.unit}
                {b.bryanJohnsonValue !== undefined && <span className="text-accent"> · Bryan {b.bryanJohnsonValue}</span>}
              </p>
              <p className="text-xs text-muted mt-1.5">{b.categoryLabel}</p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
