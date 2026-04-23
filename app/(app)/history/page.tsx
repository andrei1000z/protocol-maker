'use client';

import { useState, useMemo } from 'react';
import { useMyData, useProtocolHistory, useProtocolDiff } from '@/lib/hooks/useApiData';
import {
  FileText, TrendingUp, TrendingDown, Minus, Calendar, GitCompareArrows,
  Activity, Sparkles, Clock,
} from 'lucide-react';
import { BIOMARKER_DB } from '@/lib/engine/biomarkers';
import clsx from 'clsx';
import dynamic from 'next/dynamic';
import { SectionCard as Section, StatTile as Stat } from '@/components/ui/SectionCard';
import { ProtocolCompare } from '@/components/history/ProtocolCompare';

// Defer Recharts to this page's first chart render — keeps /dashboard +
// /tracking from paying the ~60KB bundle cost.
const MetricLineChart = dynamic(() => import('@/components/charts/MetricLineChart'), {
  ssr: false,
  loading: () => <div className="h-[220px] rounded-lg bg-surface-3/30 animate-pulse" />,
});

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────
interface BloodTest {
  id: string;
  taken_at: string;
  biomarkers: { code: string; value: number; unit: string }[];
}

interface ProtocolRow {
  id: string;
  created_at: string;
  longevity_score: number | null;
  biological_age: number | null;
  biological_age_decimal: number | null;
  aging_pace: number | null;
  model_used: string | null;
  generation_source: string | null;
}

// Lower = better for these codes
const LOWER_BETTER = new Set([
  'LDL', 'TRIG', 'HSCRP', 'HOMOCYS', 'HBA1C', 'GLUC', 'INSULIN',
  'ALT', 'AST', 'GGT', 'CREAT', 'URIC_ACID', 'WBC', 'CORTISOL', 'APOB',
]);

// ─────────────────────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────────────────────
export default function HistoryPage() {
  const { data: myData, isLoading: loadingMy } = useMyData();
  const { data: historyData, isLoading: loadingHist } = useProtocolHistory();
  const { data: diffData } = useProtocolDiff();
  const loading = loadingMy || loadingHist;

  const tests = useMemo(() => {
    const raw = (myData?.bloodTests as BloodTest[] | undefined) ?? [];
    return [...raw].sort((a, b) => new Date(a.taken_at).getTime() - new Date(b.taken_at).getTime());
  }, [myData]);
  const protocols = (historyData?.protocols as unknown as ProtocolRow[] | undefined) ?? [];

  const [selected, setSelected] = useState<[string | null, string | null]>([null, null]);

  // Derived data — protocol timeline chart
  const protocolChartData = useMemo(() =>
    protocols.map(p => ({
      date: new Date(p.created_at).toLocaleDateString('ro-RO', { month: 'short', day: 'numeric' }),
      score: p.longevity_score,
      bioAge: p.biological_age_decimal ?? p.biological_age,
      pace: p.aging_pace,
    })), [protocols]
  );

  // Biggest biomarker changes (when ≥2 blood tests exist)
  const biomarkerChanges = useMemo(() => {
    if (tests.length < 2) return [];
    const first = tests[0];
    const latest = tests[tests.length - 1];
    const map1 = new Map(first.biomarkers.map(b => [b.code, b.value]));
    const map2 = new Map(latest.biomarkers.map(b => [b.code, b.value]));
    const changes: { code: string; name: string; from: number; to: number; pctChange: number; improved: boolean; unit: string }[] = [];
    for (const [code, v2] of map2.entries()) {
      const v1 = map1.get(code);
      if (v1 === undefined || v1 === 0) continue;
      const ref = BIOMARKER_DB.find(r => r.code === code);
      const pctChange = ((v2 - v1) / v1) * 100;
      const lowerBetter = LOWER_BETTER.has(code);
      const improved = lowerBetter ? pctChange < 0 : pctChange > 0;
      changes.push({
        code,
        name: ref?.shortName || code,
        from: v1,
        to: v2,
        pctChange,
        improved,
        unit: ref?.unit || '',
      });
    }
    return changes.sort((a, b) => Math.abs(b.pctChange) - Math.abs(a.pctChange)).slice(0, 10);
  }, [tests]);

  if (loading) return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 space-y-4">
      {[1, 2, 3].map(i => (
        <div key={i} className="glass-card rounded-2xl p-6 animate-pulse">
          <div className="h-6 w-48 bg-surface-3 rounded mb-3" />
          <div className="h-4 w-full bg-surface-3 rounded mb-2" />
          <div className="h-24 w-full bg-surface-3 rounded-xl" />
        </div>
      ))}
    </div>
  );

  const toggleSelect = (id: string) => {
    if (selected[0] === id) setSelected([null, selected[1]]);
    else if (selected[1] === id) setSelected([selected[0], null]);
    else if (!selected[0]) setSelected([id, selected[1]]);
    else if (!selected[1]) setSelected([selected[0], id]);
    else setSelected([selected[1], id]);
  };

  const getTest = (id: string) => tests.find(t => t.id === id);
  const test1 = selected[0] ? getTest(selected[0]) : null;
  const test2 = selected[1] ? getTest(selected[1]) : null;

  const compareMarkers = () => {
    if (!test1 || !test2) return [];
    const map1 = new Map(test1.biomarkers.map(b => [b.code, b.value]));
    const map2 = new Map(test2.biomarkers.map(b => [b.code, b.value]));
    const allCodes = [...new Set([...map1.keys(), ...map2.keys()])];
    return allCodes.map(code => {
      const ref = BIOMARKER_DB.find(r => r.code === code);
      const v1 = map1.get(code);
      const v2 = map2.get(code);
      const delta = v1 !== undefined && v2 !== undefined ? v2 - v1 : null;
      const pctChange = v1 !== undefined && v2 !== undefined && v1 !== 0 ? ((v2 - v1) / v1) * 100 : null;
      const lowerBetter = LOWER_BETTER.has(code);
      const improved = delta !== null ? (lowerBetter ? delta < 0 : delta > 0) : null;
      return { code, name: ref?.shortName || code, v1, v2, delta, pctChange, improved, unit: ref?.unit || '' };
    }).sort((a, b) => {
      // Sort: improved markers first, then neutral, then declined
      const rank = (x: typeof a) => x.improved === true ? 0 : x.improved === false ? 2 : 1;
      return rank(a) - rank(b);
    });
  };

  // Overall stats
  const daysTracked = tests.length > 0
    ? Math.round((Date.now() - new Date(tests[0].taken_at).getTime()) / 864e5)
    : 0;
  const latestScore = protocols.length > 0 ? protocols[protocols.length - 1].longevity_score : null;
  const earliestScore = protocols.length > 0 ? protocols[0].longevity_score : null;
  const scoreDelta = (latestScore !== null && earliestScore !== null && protocols.length >= 2)
    ? latestScore - earliestScore
    : null;
  const totalBiomarkers = new Set(tests.flatMap(t => t.biomarkers.map(b => b.code))).size;

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-5 print:max-w-none print:px-0">
      {/* Page header */}
      <div className="flex items-end justify-between gap-4 animate-fade-in flex-wrap">
        <div>
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">History</h1>
          <p className="text-sm text-muted-foreground mt-1">Your longevity journey over time — tests, protocols, trends.</p>
        </div>
        <button
          onClick={() => typeof window !== 'undefined' && window.print()}
          className="shrink-0 text-xs px-3.5 py-2 rounded-xl bg-surface-2 border border-card-border hover:border-accent/40 text-muted-foreground hover:text-accent transition-all flex items-center gap-1.5 print:hidden"
          title="Print a doctor-friendly summary of your history"
        >
          🖨️ Print / save PDF
        </button>
      </div>

      {/* Medical print-mode header — only visible when printing */}
      <div className="hidden print:block">
        <h1 className="text-2xl font-bold">Protocol — Patient History Report</h1>
        <p className="text-xs mt-1">Generated {new Date().toLocaleDateString('ro-RO', { year: 'numeric', month: 'long', day: 'numeric' })} · Protocol-tawny.vercel.app</p>
        <p className="text-[10px] mt-2 text-gray-600">
          This report is generated from user-entered data and AI-derived analysis.
          It is <strong>not a medical diagnosis</strong>. Reference ranges follow longevity-optimal bands
          (Levine 2018 PhenoAge + Bryan Johnson Blueprint), which are stricter than population-average lab normals.
        </p>
        <hr className="my-3 border-gray-300" />
      </div>

      {/* Empty state */}
      {tests.length === 0 && protocols.length === 0 && (
        <Section icon={FileText} title="Nothing tracked yet" subtitle="Complete onboarding to start building history">
          <div className="text-center py-10 space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-surface-2 border border-card-border mx-auto flex items-center justify-center">
              <Clock className="w-7 h-7 text-muted" />
            </div>
            <div>
              <p className="text-sm font-medium">Your timeline starts with your first protocol</p>
              <p className="text-xs text-muted-foreground mt-1.5 max-w-sm mx-auto leading-relaxed">
                Once you complete onboarding, every regeneration + blood test lands here. You&apos;ll see trends the moment you have 2+ data points.
              </p>
            </div>
            <a href="/onboarding" className="inline-block px-5 py-2.5 rounded-xl bg-accent text-black text-sm font-semibold hover:bg-accent-bright transition-colors">
              Start onboarding
            </a>
          </div>
        </Section>
      )}

      {/* Overview stats */}
      {(tests.length > 0 || protocols.length > 0) && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 animate-fade-in-up">
          <Stat
            label="Tests"
            value={tests.length}
            subtext={totalBiomarkers > 0 && <span className="text-muted-foreground">{totalBiomarkers} unique markers</span>}
          />
          <Stat
            label="Protocols"
            value={protocols.length}
            tone={protocols.length > 0 ? 'accent' : 'default'}
            subtext={protocols.length > 0 && <span className="text-muted-foreground">{protocols[protocols.length - 1].generation_source || 'ai'}</span>}
          />
          <Stat
            label="Days tracked"
            value={daysTracked || '—'}
            subtext={daysTracked > 0 && <span className="text-muted-foreground">since first test</span>}
          />
          <Stat
            label="Score Δ"
            value={scoreDelta !== null ? `${scoreDelta > 0 ? '+' : ''}${scoreDelta}` : '—'}
            tone={scoreDelta !== null ? (scoreDelta > 0 ? 'accent' : scoreDelta < 0 ? 'danger' : 'default') : 'default'}
            subtext={scoreDelta !== null && (
              <span className="text-muted-foreground">{scoreDelta > 0 ? 'improving' : scoreDelta < 0 ? 'declining' : 'steady'}</span>
            )}
          />
        </div>
      )}

      {/* Protocol timeline chart */}
      {protocols.length >= 2 && (
        <Section icon={Activity} title="Score over time" subtitle={`${protocols.length} updates across ${Math.round((new Date(protocols[protocols.length - 1].created_at).getTime() - new Date(protocols[0].created_at).getTime()) / 864e5)} days`}>
          <div className="rounded-xl bg-surface-2 border border-card-border p-4 -mx-1">
            <MetricLineChart
              data={protocolChartData.map(p => ({ date: p.date, dateLabel: p.date, value: p.score }))}
              height={220}
              lineColor="#34d399"
              domainY={[0, 100]}
            />
          </div>

          {/* Bio age timeline — compact */}
          {protocolChartData.some(p => p.bioAge !== null) && (
            <div className="rounded-xl bg-surface-2 border border-card-border p-4 -mx-1">
              <p className="text-[10px] uppercase tracking-widest text-muted mb-2">Biological age</p>
              <MetricLineChart
                data={protocolChartData.map(p => ({ date: p.date, dateLabel: p.date, value: p.bioAge }))}
                height={140}
                lineColor="#6ee7b7"
                decimals={1}
              />
            </div>
          )}
        </Section>
      )}

      {/* Biggest biomarker movers */}
      {biomarkerChanges.length > 0 && (
        <Section icon={Sparkles} title="What's moved the most" subtitle={`Top ${biomarkerChanges.length} biomarkers, first panel vs latest`}>
          <div className="space-y-1.5">
            {biomarkerChanges.map(c => (
              <div key={c.code} className="flex items-center justify-between gap-3 p-3 rounded-xl bg-surface-2 border border-card-border hover:border-card-border-hover transition-colors">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  {c.improved
                    ? <TrendingUp className="w-4 h-4 text-accent shrink-0" />
                    : <TrendingDown className="w-4 h-4 text-danger shrink-0" />}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{c.name}</p>
                    <p className="text-[10px] text-muted font-mono">
                      {c.from.toFixed(1)} <span className="text-muted/60">→</span> {c.to.toFixed(1)} {c.unit}
                    </p>
                  </div>
                </div>
                <span className={clsx('text-xs font-mono font-semibold px-2.5 py-1 rounded-md shrink-0',
                  c.improved ? 'pill-optimal' : 'pill-critical')}>
                  {c.pctChange > 0 ? '+' : ''}{c.pctChange.toFixed(1)}%
                </span>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Pick-any-two comparator — renders only when ≥ 3 protocols exist,
          so it doesn't overlap with the Latest-vs-Previous block below. */}
      {protocols.length >= 3 && <ProtocolCompare protocols={protocols} />}

      {/* Protocol v2 vs v1 diff — full breakdown */}
      {diffData?.diff && (() => {
        const d = diffData.diff;
        const overallPositive = (d.score.delta > 0 ? 1 : -1) + (d.bioAge.delta < 0 ? 1 : -1) > 0;
        return (
          <Section
            icon={GitCompareArrows}
            title="Latest protocol vs previous"
            subtitle={`Generated ${d.daysBetween} days apart · ${d.totalChanges} supplement change${d.totalChanges === 1 ? '' : 's'}`}
          >
            {/* Hero comparison */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className={clsx('p-4 rounded-xl border',
                d.score.delta > 0 ? 'bg-accent/[0.04] border-accent/25' :
                d.score.delta < 0 ? 'bg-red-500/[0.04] border-red-500/20' :
                'bg-surface-2 border-card-border')}>
                <p className="text-[10px] uppercase tracking-widest text-muted">Longevity score</p>
                <div className="flex items-baseline gap-2 mt-2">
                  <span className="text-2xl font-bold font-mono tabular-nums text-muted">{d.score.prev ?? '—'}</span>
                  <span className="text-muted">→</span>
                  <span className={clsx('text-2xl font-bold font-mono tabular-nums', d.score.delta > 0 ? 'text-accent' : d.score.delta < 0 ? 'text-danger' : 'text-foreground')}>{d.score.curr ?? '—'}</span>
                </div>
                {d.score.delta !== 0 && (
                  <p className={clsx('text-xs font-mono mt-2', d.score.delta > 0 ? 'text-accent' : 'text-danger')}>
                    {d.score.delta > 0 ? '+' : ''}{d.score.delta} pts
                  </p>
                )}
              </div>

              <div className={clsx('p-4 rounded-xl border',
                d.bioAge.delta < 0 ? 'bg-accent/[0.04] border-accent/25' :
                d.bioAge.delta > 0 ? 'bg-red-500/[0.04] border-red-500/20' :
                'bg-surface-2 border-card-border')}>
                <p className="text-[10px] uppercase tracking-widest text-muted">Biological age</p>
                <div className="flex items-baseline gap-2 mt-2">
                  <span className="text-2xl font-bold font-mono tabular-nums text-muted">{d.bioAge.prev?.toFixed(1) ?? '—'}</span>
                  <span className="text-muted">→</span>
                  <span className={clsx('text-2xl font-bold font-mono tabular-nums', d.bioAge.delta < 0 ? 'text-accent' : d.bioAge.delta > 0 ? 'text-danger' : 'text-foreground')}>{d.bioAge.curr?.toFixed(1) ?? '—'}</span>
                </div>
                {Math.abs(d.bioAge.delta) >= 0.1 && (
                  <p className={clsx('text-xs font-mono mt-2', d.bioAge.delta < 0 ? 'text-accent' : 'text-danger')}>
                    {d.bioAge.delta > 0 ? '+' : ''}{d.bioAge.delta.toFixed(1)}y
                  </p>
                )}
              </div>

              <div className={clsx('p-4 rounded-xl border',
                d.agingPace.delta < 0 ? 'bg-accent/[0.04] border-accent/25' :
                d.agingPace.delta > 0 ? 'bg-red-500/[0.04] border-red-500/20' :
                'bg-surface-2 border-card-border')}>
                <p className="text-[10px] uppercase tracking-widest text-muted">Aging pace</p>
                <div className="flex items-baseline gap-2 mt-2">
                  <span className="text-2xl font-bold font-mono tabular-nums text-muted">{d.agingPace.prev?.toFixed(2) ?? '—'}×</span>
                  <span className="text-muted">→</span>
                  <span className={clsx('text-2xl font-bold font-mono tabular-nums', d.agingPace.delta < 0 ? 'text-accent' : d.agingPace.delta > 0 ? 'text-danger' : 'text-foreground')}>{d.agingPace.curr?.toFixed(2) ?? '—'}×</span>
                </div>
                {Math.abs(d.agingPace.delta) >= 0.01 && (
                  <p className={clsx('text-xs font-mono mt-2', d.agingPace.delta < 0 ? 'text-accent' : 'text-danger')}>
                    {d.agingPace.delta > 0 ? '+' : ''}{d.agingPace.delta.toFixed(2)}
                  </p>
                )}
              </div>
            </div>

            {/* Supplement diff */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="p-4 rounded-xl bg-accent/[0.04] border border-accent/20">
                <p className="text-[10px] uppercase tracking-widest text-accent font-semibold">+ Added ({d.supplements.addedCount})</p>
                {d.supplements.added.length > 0 ? (
                  <ul className="mt-2 space-y-1">
                    {d.supplements.added.map(s => (
                      <li key={s} className="text-xs text-foreground/90 flex gap-1.5"><span className="text-accent">·</span>{s}</li>
                    ))}
                  </ul>
                ) : <p className="text-xs text-muted-foreground mt-1.5 italic">No new supplements</p>}
              </div>

              <div className="p-4 rounded-xl bg-surface-2 border border-card-border">
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">− Removed ({d.supplements.removedCount})</p>
                {d.supplements.removed.length > 0 ? (
                  <ul className="mt-2 space-y-1">
                    {d.supplements.removed.map(s => (
                      <li key={s} className="text-xs text-foreground/90 flex gap-1.5"><span className="text-muted">·</span><span className="line-through text-muted">{s}</span></li>
                    ))}
                  </ul>
                ) : <p className="text-xs text-muted-foreground mt-1.5 italic">Nothing dropped</p>}
              </div>

              <div className="p-4 rounded-xl bg-surface-2 border border-card-border">
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">= Kept ({d.supplements.keptCount})</p>
                {d.supplements.kept.length > 0 ? (
                  <p className="text-xs text-muted-foreground mt-2 leading-relaxed">{d.supplements.kept.slice(0, 6).join(', ')}{d.supplements.kept.length > 6 ? ` + ${d.supplements.kept.length - 6} more` : ''}</p>
                ) : <p className="text-xs text-muted-foreground mt-1.5 italic">Stack rebuilt from scratch</p>}
              </div>
            </div>

            <div className={clsx('p-3 rounded-xl border', overallPositive ? 'bg-gradient-to-r from-accent/[0.04] to-transparent border-accent/15' : 'bg-gradient-to-r from-amber-500/[0.04] to-transparent border-amber-500/15')}>
              <p className="text-xs text-foreground/95 leading-relaxed">
                {overallPositive
                  ? '↑ Trending in the right direction. Whatever you changed is working — keep going.'
                  : 'Numbers slipped slightly. Check the supplement changes + your tracking trends. Could be tracked-data drift, missed adherence, or a new lab panel showing different markers.'}
              </p>
            </div>
          </Section>
        );
      })()}

      {/* Blood test sub-empty — shown when user has at least a protocol but
          no blood work yet. The top-level empty state only fires when both
          lists are empty, so this catches the "onboarded lifestyle-only" case. */}
      {tests.length === 0 && protocols.length > 0 && (
        <Section icon={FileText} title="Blood tests" subtitle="Add a lab panel to unlock biomarker-level advice">
          <div className="rounded-2xl border border-dashed border-card-border bg-surface-2/40 p-6 text-center space-y-3">
            <p className="text-sm font-medium">No labs uploaded yet</p>
            <p className="text-[11px] text-muted-foreground max-w-sm mx-auto leading-relaxed">
              Right now your protocol runs on lifestyle answers only. Add a panel from Synevo, Regina Maria, MedLife, or Bioclinica and get 20-30 extra adjustments keyed to your actual numbers.
            </p>
            <a href="/settings" className="inline-block px-4 py-2 rounded-xl bg-accent text-black text-xs font-semibold hover:bg-accent-bright transition-colors">
              Upload a PDF
            </a>
          </div>
        </Section>
      )}

      {/* Blood test list */}
      {tests.length > 0 && (
        <Section
          icon={FileText}
          title="Blood tests"
          subtitle={tests.length === 1 ? '1 test on file · upload another to compare' : `Select any two to compare (${tests.length} on file)`}
        >
          <div className="space-y-2">
            {[...tests].reverse().map((test) => {
              const isSelected = selected.includes(test.id);
              const role = selected[0] === test.id ? 'older' : selected[1] === test.id ? 'newer' : null;
              return (
                <button
                  key={test.id}
                  onClick={() => toggleSelect(test.id)}
                  className={clsx('w-full flex items-center gap-3 p-4 rounded-xl border transition-all text-left',
                    isSelected
                      ? 'bg-accent/8 border-accent/40'
                      : 'bg-surface-2 border-card-border hover:border-card-border-hover')}
                >
                  <div className={clsx('w-10 h-10 rounded-lg flex items-center justify-center shrink-0 transition-colors',
                    isSelected ? 'bg-accent/15' : 'bg-surface-3')}>
                    <Calendar className={clsx('w-4 h-4', isSelected ? 'text-accent' : 'text-muted-foreground')} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {new Date(test.taken_at).toLocaleDateString('ro-RO', { year: 'numeric', month: 'long', day: 'numeric' })}
                    </p>
                    <p className="text-[11px] text-muted-foreground">{test.biomarkers.length} biomarkers</p>
                  </div>
                  {role && (
                    <span className={clsx('text-[10px] font-semibold uppercase tracking-wider px-2.5 py-1 rounded-full shrink-0',
                      role === 'older' ? 'pill-suboptimal' : 'pill-optimal')}>
                      {role}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          {tests.length === 1 && (
            <div className="mt-2 p-3 rounded-xl bg-surface-2 border border-dashed border-card-border">
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Upload a second test (via onboarding regeneration) to unlock side-by-side comparison + % change trends.
              </p>
            </div>
          )}
        </Section>
      )}

      {/* Comparison view — only when 2 selected */}
      {test1 && test2 && (() => {
        const markers = compareMarkers();
        const improvedCount = markers.filter(m => m.improved === true).length;
        const declinedCount = markers.filter(m => m.improved === false).length;
        return (
          <Section
            icon={GitCompareArrows}
            title="Test comparison"
            subtitle={`${new Date(test1.taken_at).toLocaleDateString('ro-RO', { month: 'short', day: 'numeric', year: 'numeric' })} → ${new Date(test2.taken_at).toLocaleDateString('ro-RO', { month: 'short', day: 'numeric', year: 'numeric' })}`}
          >
            <div className="grid grid-cols-3 gap-2 mb-2">
              <Stat label="Improved" value={improvedCount} tone="accent" />
              <Stat label="Declined" value={declinedCount} tone={declinedCount > 0 ? 'danger' : 'default'} />
              <Stat label="Tracked" value={markers.length} />
            </div>

            <div className="space-y-1 mt-3">
              {/* Column headers */}
              <div className="grid grid-cols-12 gap-3 px-3 pb-2 text-[10px] text-muted uppercase tracking-widest border-b border-card-border">
                <span className="col-span-4">Marker</span>
                <span className="col-span-3 text-right">Older</span>
                <span className="col-span-3 text-right">Newer</span>
                <span className="col-span-2 text-right">Change</span>
              </div>
              {markers.map(m => (
                <div key={m.code} className="grid grid-cols-12 gap-3 px-3 py-2.5 items-center text-xs rounded-lg hover:bg-surface-2 transition-colors">
                  <span className="col-span-4 font-medium truncate">{m.name}</span>
                  <span className="col-span-3 text-right font-mono text-muted-foreground tabular-nums">{m.v1?.toFixed(1) ?? '—'}</span>
                  <span className="col-span-3 text-right font-mono font-semibold tabular-nums">{m.v2?.toFixed(1) ?? '—'}</span>
                  <div className="col-span-2 flex items-center justify-end gap-1">
                    {m.delta !== null ? (
                      <>
                        {m.improved === true && <TrendingUp className="w-3 h-3 text-accent" />}
                        {m.improved === false && <TrendingDown className="w-3 h-3 text-danger" />}
                        {m.improved === null && <Minus className="w-3 h-3 text-muted" />}
                        <span className={clsx('font-mono font-semibold tabular-nums',
                          m.improved === true ? 'text-accent' : m.improved === false ? 'text-danger' : 'text-muted')}>
                          {m.pctChange !== null ? `${m.pctChange > 0 ? '+' : ''}${m.pctChange.toFixed(0)}%` : ''}
                        </span>
                      </>
                    ) : <span className="text-muted">—</span>}
                  </div>
                </div>
              ))}
            </div>
          </Section>
        );
      })()}

      {/* Protocol regeneration log */}
      {protocols.length > 0 && (
        <Section icon={Clock} title="Protocol regenerations" subtitle={`${protocols.length} generation${protocols.length === 1 ? '' : 's'} saved`}>
          <div className="space-y-1.5">
            {[...protocols].reverse().slice(0, 10).map((p, i, arr) => {
              const prev = arr[i + 1];
              const scoreDiff = prev && p.longevity_score !== null && prev.longevity_score !== null
                ? p.longevity_score - prev.longevity_score
                : null;
              return (
                <div key={p.id} className="flex items-center gap-3 p-3 rounded-xl bg-surface-2 border border-card-border">
                  <div className="w-10 h-10 rounded-lg bg-surface-3 flex items-center justify-center shrink-0">
                    <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">{p.generation_source?.slice(0, 4) || 'prot'}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {new Date(p.created_at).toLocaleString('ro-RO', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </p>
                    <div className="flex items-center gap-2 text-[11px] text-muted-foreground mt-0.5">
                      {p.longevity_score !== null && <span>Score <span className="text-accent font-mono">{p.longevity_score}</span></span>}
                      {p.biological_age_decimal !== null && <span>· Bio {p.biological_age_decimal.toFixed(1)}y</span>}
                      {p.aging_pace !== null && <span>· Pace {p.aging_pace}×</span>}
                    </div>
                  </div>
                  {scoreDiff !== null && scoreDiff !== 0 && (
                    <span className={clsx('text-[11px] font-mono font-semibold px-2 py-0.5 rounded-md shrink-0',
                      scoreDiff > 0 ? 'pill-optimal' : 'pill-critical')}>
                      {scoreDiff > 0 ? '+' : ''}{scoreDiff}
                    </span>
                  )}
                </div>
              );
            })}
            {protocols.length > 10 && (
              <p className="text-[11px] text-center text-muted pt-2">Showing latest 10 of {protocols.length}</p>
            )}
          </div>
        </Section>
      )}

      <p className="text-[11px] text-center text-muted pt-2">
        New data logged daily via tracking. Protocol auto-regenerates every night at 3 AM Romania time.
      </p>
    </div>
  );
}
