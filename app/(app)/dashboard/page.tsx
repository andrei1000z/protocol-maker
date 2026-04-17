'use client';

import { useEffect, useState } from 'react';
import { ProtocolOutput, Classification } from '@/lib/types';
import { getClassificationColor, getClassificationBg } from '@/lib/engine/classifier';
import { AnimatedNumber } from '@/components/ui/AnimatedNumber';
import { DashboardTOC } from '@/components/layout/DashboardTOC';
import clsx from 'clsx';
import {
  Radar, RadarChart, PolarGrid, PolarAngleAxis, ResponsiveContainer,
} from 'recharts';

const TOC_ITEMS = [
  { id: 'diagnostic', label: 'Diagnostic', icon: '🎯' },
  { id: 'organs', label: 'Organ Systems', icon: '🫀' },
  { id: 'bryan', label: 'vs Bryan', icon: '🏆' },
  { id: 'biomarkers', label: 'Biomarkers', icon: '🔬' },
  { id: 'nutrition', label: 'Nutrition', icon: '🥗' },
  { id: 'supplements', label: 'Supplements', icon: '💊' },
  { id: 'schedule', label: 'Daily Schedule', icon: '⏰' },
  { id: 'exercise', label: 'Exercise', icon: '🏋️' },
  { id: 'sleep', label: 'Sleep', icon: '🌙' },
  { id: 'tips', label: 'Universal Tips', icon: '💡' },
  { id: 'tracking', label: 'What to Track', icon: '📊' },
  { id: 'painpoints', label: 'Pain Points', icon: '🎯' },
  { id: 'flex', label: 'Flex Rules', icon: '🧘' },
  { id: 'weekplan', label: 'Next 4 Weeks', icon: '📅' },
  { id: 'doctor', label: 'Doctor', icon: '👨‍⚕️' },
  { id: 'roadmap', label: '12-Week Roadmap', icon: '🗺️' },
  { id: 'shopping', label: 'Shopping List', icon: '🛒' },
];

function Section({ id, title, icon, subtitle, children, className }: { id?: string; title: string; icon: string; subtitle?: string; children: React.ReactNode; className?: string }) {
  return (
    <div id={id} className={clsx('glass-card rounded-2xl p-6 space-y-5 scroll-mt-20 animate-fade-in-up', className)}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold tracking-tight flex items-center gap-2.5">
            <span className="text-2xl">{icon}</span>{title}
          </h2>
          {subtitle && <p className="text-xs text-muted-foreground mt-1.5 max-w-lg leading-relaxed">{subtitle}</p>}
        </div>
      </div>
      {children}
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="p-8 rounded-xl bg-background/50 border border-dashed border-card-border text-center">
      <p className="text-xs text-muted-foreground">{message}</p>
      <p className="text-[10px] text-muted mt-1.5">Upload blood work or complete more onboarding for richer data.</p>
    </div>
  );
}

function ProgressRing({ value, size = 120, stroke = 8, color = 'var(--accent)' }: { value: number; size?: number; stroke?: number; color?: string }) {
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (value / 100) * circumference;
  return (
    <svg className="progress-ring" width={size} height={size}>
      <circle cx={size / 2} cy={size / 2} r={radius} strokeWidth={stroke} fill="none" className="progress-ring-bg" />
      <circle
        cx={size / 2} cy={size / 2} r={radius} strokeWidth={stroke} fill="none"
        stroke={color}
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        style={{ transition: 'stroke-dashoffset 1.2s cubic-bezier(0.4, 0, 0.2, 1)' }}
      />
    </svg>
  );
}

function Badge({ classification }: { classification: Classification }) {
  return (
    <span className={clsx('text-[9px] font-mono px-2 py-0.5 rounded-full border', getClassificationBg(classification), getClassificationColor(classification))}>
      {classification.replace('_', ' ')}
    </span>
  );
}

function BiomarkerBar({ value, low, high, popLow, popHigh, bryanVal, unit }: {
  value: number; low: number; high: number; popLow: number; popHigh: number; bryanVal?: number; unit: string;
}) {
  const min = Math.min(popLow * 0.5, value * 0.8, low * 0.5);
  const max = Math.max(popHigh * 1.3, value * 1.2, high * 1.5);
  const range = max - min;
  const toPercent = (v: number) => Math.max(0, Math.min(100, ((v - min) / range) * 100));

  return (
    <div className="relative h-6 rounded-full bg-background border border-card-border overflow-hidden mt-1">
      {/* Population range */}
      <div className="absolute top-0 bottom-0 bg-card-border/30" style={{ left: `${toPercent(popLow)}%`, width: `${toPercent(popHigh) - toPercent(popLow)}%` }} />
      {/* Optimal range */}
      <div className="absolute top-0 bottom-0 bg-accent/15 border-l border-r border-accent/30" style={{ left: `${toPercent(low)}%`, width: `${toPercent(high) - toPercent(low)}%` }} />
      {/* Bryan's value */}
      {bryanVal !== undefined && (
        <div className="absolute top-0 bottom-0 w-0.5 bg-amber-400/60" style={{ left: `${toPercent(bryanVal)}%` }} title={`Bryan: ${bryanVal} ${unit}`} />
      )}
      {/* Your value */}
      <div className="absolute top-1 bottom-1 w-3 rounded-full bg-accent border-2 border-black -translate-x-1/2" style={{ left: `${toPercent(value)}%` }} />
    </div>
  );
}

export default function DashboardPage() {
  const [data, setData] = useState<{ protocol: ProtocolOutput; longevityScore: number; biologicalAge: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedBiomarker, setExpandedBiomarker] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/my-data')
      .then((r) => r.json())
      .then((d) => {
        if (d.protocol) {
          setData({ protocol: d.protocol.protocol_json, longevityScore: d.protocol.longevity_score, biologicalAge: d.protocol.biological_age });
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-5">
      <div className="text-center space-y-2">
        <div className="h-8 w-32 mx-auto rounded-xl bg-card-border/30 animate-pulse" />
        <div className="h-4 w-48 mx-auto rounded-lg bg-card-border/30 animate-pulse" />
      </div>
      <div className="rounded-2xl bg-card border border-card-border p-6">
        <div className="grid grid-cols-3 gap-3">
          {[1, 2, 3].map(i => <div key={i} className="p-4 rounded-xl bg-background border border-card-border"><div className="h-10 w-16 mx-auto rounded-lg bg-card-border/30 animate-pulse" /><div className="h-3 w-20 mx-auto mt-2 rounded bg-card-border/30 animate-pulse" /></div>)}
        </div>
      </div>
      {[1, 2, 3, 4].map(i => <div key={i} className="rounded-2xl bg-card border border-card-border p-5 space-y-3"><div className="h-5 w-32 rounded bg-card-border/30 animate-pulse" /><div className="h-4 w-full rounded bg-card-border/30 animate-pulse" /><div className="h-20 w-full rounded-xl bg-card-border/30 animate-pulse" /></div>)}
    </div>
  );

  if (!data) return (
    <div className="flex items-center justify-center min-h-[60vh] px-6">
      <div className="text-center space-y-4">
        <p className="text-4xl">🧬</p>
        <p className="text-xl font-bold">No protocol generated yet</p>
        <p className="text-sm text-muted-foreground">Complete onboarding to get your personalized longevity protocol.</p>
        <a href="/onboarding" className="inline-block px-6 py-3 bg-accent text-black rounded-xl font-semibold text-sm">Generate Protocol</a>
      </div>
    </div>
  );

  const { protocol: p, longevityScore, biologicalAge } = data;
  const diag = p.diagnostic;
  const radarData = diag?.organSystemScores
    ? Object.entries(diag.organSystemScores).map(([key, val]) => ({ name: key.charAt(0).toUpperCase() + key.slice(1), score: val as number }))
    : [];

  // Prefer DB decimal column → diagnostic block → integer fallback
  const bioAgeDecimal = typeof diag?.biologicalAge === 'number' ? diag.biologicalAge : biologicalAge;
  // (biological_age_decimal from DB is already threaded into diag.biologicalAge via the
  //  generate-protocol route's diagnostic injection, so the above covers all cases.)
  const bioYears = Math.floor(bioAgeDecimal);
  const bioMonths = Math.round((bioAgeDecimal - bioYears) * 12);
  const bioAgeLabel = bioMonths === 12 ? `${bioYears + 1}y 0m` : `${bioYears}y ${bioMonths}m`;
  const chronoAge = typeof diag?.chronologicalAge === 'number' ? diag.chronologicalAge : null;
  const ageDelta = chronoAge ? bioAgeDecimal - chronoAge : null;

  const velocity = typeof diag?.agingVelocityNumber === 'number'
    ? diag.agingVelocityNumber
    : (diag?.agingVelocity === 'decelerated' ? 0.85 : diag?.agingVelocity === 'accelerated' ? 1.18 : 1.0);
  const totalSupCost = p.supplements?.reduce((s, sup) => s + (sup.monthlyCostRon || 0), 0) || 0;

  const organsDetailed = diag?.organSystemsDetailed || [];
  const bryanSummary = diag?.bryanSummary;
  const estimatedBiomarkers = diag?.estimatedBiomarkers || [];

  return (
    <div className="max-w-[1200px] mx-auto px-4 py-6 flex gap-6">
      <DashboardTOC items={TOC_ITEMS} />

      <div className="flex-1 min-w-0 space-y-5 max-w-3xl">
      {/* ═══════════════ HERO DIAGNOSTIC ═══════════════ */}
      <div id="diagnostic" className="hero-card rounded-3xl p-8 scroll-mt-20 animate-fade-in-up relative overflow-hidden">
        <div className="flex items-start justify-between gap-4 mb-8">
          <div>
            <p className="text-[10px] uppercase tracking-[0.2em] text-muted mb-2">Longevity Protocol</p>
            <h1 className="text-3xl font-semibold tracking-tight">Your diagnostic</h1>
            {diag?.summary && <p className="text-sm text-muted-foreground mt-3 max-w-xl leading-relaxed">{diag.summary}</p>}
          </div>
          <button onClick={() => window.print()} className="no-print shrink-0 text-xs px-3.5 py-2 rounded-xl bg-surface-2 border border-card-border hover:border-accent/40 text-muted-foreground hover:text-accent transition-all">
            Print / PDF
          </button>
        </div>

        {/* Three big metric tiles */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Longevity Score — progress ring */}
          <div className="metric-tile relative">
            <div className="flex items-center gap-5">
              <div className="relative w-[88px] h-[88px] shrink-0">
                <ProgressRing value={longevityScore} size={88} stroke={7} />
                <div className="absolute inset-0 flex items-center justify-center">
                  <AnimatedNumber value={longevityScore} duration={1500} className="text-2xl font-bold font-mono" />
                </div>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-widest text-muted">Longevity</p>
                <p className="text-sm font-medium text-foreground mt-0.5">Score</p>
                <p className="text-[11px] text-muted-foreground mt-1.5 leading-tight">{longevityScore >= 85 ? 'Elite tier' : longevityScore >= 70 ? 'Above average' : longevityScore >= 55 ? 'Room to improve' : 'Needs attention'}</p>
              </div>
            </div>
          </div>

          {/* Bio Age */}
          <div className="metric-tile">
            <p className="text-[10px] uppercase tracking-widest text-muted">Biological Age</p>
            <div className={clsx('text-4xl font-bold font-mono tracking-tight mt-2', ageDelta !== null ? (ageDelta < -0.5 ? 'text-accent' : ageDelta > 0.5 ? 'text-danger' : 'text-foreground') : 'text-foreground')}>
              {bioAgeLabel}
            </div>
            {ageDelta !== null && (
              <div className="flex items-center gap-1.5 mt-2">
                <span className={clsx('text-xs font-mono px-2 py-0.5 rounded-md', ageDelta < -0.5 ? 'pill-optimal' : ageDelta > 0.5 ? 'pill-critical' : 'bg-surface-3 text-muted-foreground')}>
                  {ageDelta < 0 ? '−' : '+'}{Math.abs(ageDelta).toFixed(1)}y
                </span>
                <span className="text-[11px] text-muted">vs {chronoAge}y chronological</span>
              </div>
            )}
          </div>

          {/* Aging Speed */}
          <div className="metric-tile">
            <p className="text-[10px] uppercase tracking-widest text-muted">Aging Speed</p>
            <div className="flex items-baseline gap-2 mt-2">
              <AnimatedNumber value={velocity} duration={1500} decimals={2} className={clsx('text-4xl font-bold font-mono tracking-tight', velocity < 0.9 ? 'text-accent' : velocity > 1.1 ? 'text-danger' : 'text-foreground')} />
              <span className="text-xs text-muted-foreground">× clock</span>
            </div>
            <p className="text-[11px] text-muted-foreground mt-2 leading-tight">
              {velocity < 0.85 ? 'Aging slower than real time — top percentile' : velocity < 0.95 ? 'Slower than clock — ahead' : velocity <= 1.05 ? 'Pacing with real time' : velocity <= 1.25 ? 'Accelerated — reversible' : 'Rapidly accelerated — act now'}
            </p>
          </div>
        </div>

        {/* Wins + Risks */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
          <div className="p-5 rounded-2xl bg-gradient-to-br from-emerald-500/[0.04] to-transparent border border-emerald-500/15">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-1.5 h-1.5 rounded-full bg-accent" />
              <p className="text-xs font-semibold text-accent uppercase tracking-wider">Top Wins</p>
            </div>
            <ul className="space-y-2">
              {(diag?.topWins || []).slice(0, 4).map((w, i) => (
                <li key={i} className="text-sm text-foreground/90 leading-snug flex gap-2">
                  <span className="text-accent shrink-0 mt-0.5">✓</span>
                  <span>{w}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="p-5 rounded-2xl bg-gradient-to-br from-red-500/[0.04] to-transparent border border-red-500/15">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-1.5 h-1.5 rounded-full bg-danger" />
              <p className="text-xs font-semibold text-danger uppercase tracking-wider">Top Risks</p>
            </div>
            <ul className="space-y-2">
              {(diag?.topRisks || []).slice(0, 4).map((r, i) => (
                <li key={i} className="text-sm text-foreground/90 leading-snug flex gap-2">
                  <span className="text-danger shrink-0 mt-0.5">!</span>
                  <span>{r}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* ═══════════════ ORGAN SYSTEMS ═══════════════ */}
      <Section id="organs" title="Organ Systems" icon="🫀" subtitle="Eight body systems scored independently. Each score is a blend of your lifestyle inputs plus any matching biomarkers — so you see strengths, gaps, and the two highest-leverage moves per system.">
        {/* Radar overview */}
        {radarData.length > 0 && (
          <div className="rounded-2xl bg-surface-2 border border-card-border p-4 -mx-1">
            <ResponsiveContainer width="100%" height={300}>
              <RadarChart data={radarData}>
                <PolarGrid stroke="#1d2128" />
                <PolarAngleAxis dataKey="name" tick={{ fontSize: 11, fill: '#9ca3af' }} />
                <Radar dataKey="score" stroke="#34d399" fill="#34d399" fillOpacity={0.18} strokeWidth={2.5} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Per-system detail cards */}
        {organsDetailed.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {organsDetailed.map((sys) => {
              const scoreColor = sys.score >= 80 ? 'text-accent' : sys.score >= 60 ? 'text-foreground' : sys.score >= 40 ? 'text-warning' : 'text-danger';
              const barColor = sys.score >= 80 ? 'bg-accent' : sys.score >= 60 ? 'bg-accent/70' : sys.score >= 40 ? 'bg-warning' : 'bg-danger';
              return (
                <div key={sys.key} className="p-4 rounded-xl bg-surface-2 border border-card-border hover:border-card-border-hover transition-colors">
                  <div className="flex items-baseline justify-between gap-3 mb-1.5">
                    <div className="flex items-center gap-1.5">
                      <p className="text-sm font-semibold">{sys.label}</p>
                      {sys.estimated && <span className="text-[9px] px-1.5 py-0.5 rounded bg-surface-3 text-muted uppercase tracking-wider">est.</span>}
                    </div>
                    <span className={clsx('text-2xl font-bold font-mono tabular-nums', scoreColor)}>{sys.score}</span>
                  </div>
                  <div className="h-1 rounded-full bg-surface-3 overflow-hidden mb-3">
                    <div className={clsx('h-full rounded-full transition-all duration-1000', barColor)} style={{ width: `${sys.score}%` }} />
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-relaxed mb-3">{sys.description}</p>
                  {sys.drivers.length > 0 && (
                    <div className="space-y-1 mb-2">
                      {sys.drivers.slice(0, 2).map((d, i) => (
                        <p key={i} className="text-[11px] text-muted-foreground flex gap-1.5">
                          <span className="text-muted">·</span>{d}
                        </p>
                      ))}
                    </div>
                  )}
                  {sys.improvers.length > 0 && (
                    <div className="pt-2 border-t border-card-border">
                      <p className="text-[9px] uppercase tracking-widest text-accent mb-1">Next move</p>
                      <p className="text-[11px] text-foreground/90 leading-snug">{sys.improvers[0]}</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
        {organsDetailed.length === 0 && radarData.length === 0 && <EmptyState message="Organ scores will populate after protocol generation." />}
      </Section>

      {/* ═══════════════ YOU VS BRYAN ═══════════════ */}
      <Section id="bryan" title="You vs Bryan Johnson" icon="🏆" subtitle="Bryan runs the most documented longevity protocol on earth. These numbers show how far you are from his benchmarks — and what % younger (or older) you're aging biologically.">
        {/* Hero comparison */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="metric-tile">
            <p className="text-[10px] uppercase tracking-widest text-muted">Bio Age vs Chrono</p>
            {bryanSummary ? (
              <>
                <div className={clsx('text-3xl font-bold font-mono mt-2 tracking-tight', bryanSummary.bioAgePctDifference > 0 ? 'text-accent' : bryanSummary.bioAgePctDifference < 0 ? 'text-danger' : 'text-foreground')}>
                  {bryanSummary.bioAgePctDifference > 0 ? '−' : bryanSummary.bioAgePctDifference < 0 ? '+' : ''}{Math.abs(bryanSummary.bioAgePctDifference)}%
                </div>
                <p className="text-[11px] text-muted-foreground mt-2">
                  {bryanSummary.bioAgePctDifference > 0 ? 'Biologically younger' : bryanSummary.bioAgePctDifference < 0 ? 'Biologically older' : 'Exactly on pace'}
                </p>
              </>
            ) : <div className="text-3xl font-mono text-muted mt-2">—</div>}
          </div>
          <div className="metric-tile">
            <p className="text-[10px] uppercase tracking-widest text-muted">Longevity Score</p>
            <div className="flex items-baseline gap-2 mt-2">
              <span className="text-3xl font-bold font-mono tracking-tight">{longevityScore}</span>
              <span className="text-sm text-muted">/ 94</span>
            </div>
            <p className="text-[11px] text-muted-foreground mt-2">
              {longevityScore >= 94 ? 'At/above Bryan tier' : `${94 - longevityScore} points to close the gap`}
            </p>
          </div>
          <div className="metric-tile">
            <p className="text-[10px] uppercase tracking-widest text-muted">Aging Speed</p>
            <div className="flex items-baseline gap-2 mt-2">
              <span className={clsx('text-3xl font-bold font-mono tracking-tight', velocity <= 0.7 ? 'text-accent' : velocity <= 0.95 ? 'text-foreground' : 'text-danger')}>{velocity.toFixed(2)}×</span>
              <span className="text-xs text-muted">vs 0.64×</span>
            </div>
            <p className="text-[11px] text-muted-foreground mt-2">
              {velocity <= 0.7 ? 'Matching Bryan\'s pace' : velocity <= 0.95 ? 'Slower than clock' : 'Faster than clock'}
            </p>
          </div>
        </div>

        {bryanSummary?.verdict && (
          <div className="p-4 rounded-xl bg-gradient-to-r from-amber-500/[0.05] to-transparent border border-amber-500/15">
            <p className="text-sm text-foreground/95 leading-relaxed">{bryanSummary.verdict}</p>
          </div>
        )}

        {/* Per-biomarker gap list */}
        {p.bryanComparison && p.bryanComparison.length > 0 ? (
          <div className="space-y-1.5">
            <p className="text-[10px] uppercase tracking-widest text-muted mb-2">Biomarker gaps</p>
            {p.bryanComparison.map((c, i) => (
              <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-surface-2 border border-card-border hover:border-card-border-hover transition-colors">
                <span className="text-sm font-medium flex-1 truncate">{c.marker}</span>
                <div className="flex items-center gap-3 text-xs font-mono shrink-0">
                  <span className="text-foreground">{c.yourValue}</span>
                  <span className="text-muted">→</span>
                  <span className="text-amber-400">{c.bryanValue}</span>
                </div>
                <span className={clsx('ml-3 text-[10px] px-2.5 py-1 rounded-full font-medium shrink-0',
                  c.verdict.includes('Ahead') ? 'pill-optimal' :
                  c.verdict.includes('Close') ? 'bg-blue-500/15 text-blue-400 border border-blue-500/20' :
                  c.verdict.includes('Priority') ? 'pill-critical' :
                  'pill-suboptimal'
                )}>{c.verdict}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-4 rounded-xl bg-surface-2 border border-dashed border-card-border text-center">
            <p className="text-xs text-muted-foreground">Upload blood work to see per-biomarker gaps vs Bryan&apos;s published values.</p>
          </div>
        )}
      </Section>

      {/* ═══════════════ BIOMARKERS ═══════════════ */}
      <Section id="biomarkers" title="Biomarkers" icon="🔬" subtitle={
        p.biomarkerReadout && p.biomarkerReadout.length > 0
          ? 'Your measured values positioned against longevity-optimal ranges and Bryan\'s published numbers.'
          : 'No blood work yet — below are estimated ranges based on your lifestyle. Upload a lab PDF to replace these with real values.'
      }>
        {p.biomarkerReadout && p.biomarkerReadout.length > 0 ? (
          <div className="space-y-1.5">
            {p.biomarkerReadout.map((b) => (
              <button key={b.code} onClick={() => setExpandedBiomarker(expandedBiomarker === b.code ? null : b.code)} className="w-full text-left">
                <div className="p-4 rounded-xl bg-surface-2 border border-card-border hover:border-accent/30 transition-all">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5 flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate">{b.shortName || b.name}</p>
                      <Badge classification={b.classification} />
                    </div>
                    <div className="flex items-baseline gap-1.5 shrink-0">
                      <span className={clsx('text-lg font-bold font-mono tabular-nums', getClassificationColor(b.classification))}>{b.value}</span>
                      <span className="text-[10px] text-muted">{b.unit}</span>
                    </div>
                  </div>
                  <BiomarkerBar value={b.value} low={b.longevityOptimalRange[0]} high={b.longevityOptimalRange[1]} popLow={b.labRange[0]} popHigh={b.labRange[1]} bryanVal={b.bryanValue} unit={b.unit} />
                  <div className="flex justify-between mt-2 text-[10px] text-muted">
                    <span>Optimal: <span className="text-accent/70 font-mono">{b.longevityOptimalRange[0]}–{b.longevityOptimalRange[1]}</span></span>
                    {b.bryanValue && <span>Bryan: <span className="text-amber-400 font-mono">{b.bryanValue}</span></span>}
                  </div>
                  {expandedBiomarker === b.code && b.whyItMatters && (
                    <p className="text-xs text-muted-foreground mt-3 pt-3 border-t border-card-border leading-relaxed">{b.whyItMatters}</p>
                  )}
                </div>
              </button>
            ))}
          </div>
        ) : estimatedBiomarkers.length > 0 ? (
          <div className="space-y-1.5">
            {estimatedBiomarkers.map((e) => {
              const color = e.expectedClassification === 'likely_optimal' ? 'text-accent' : e.expectedClassification === 'likely_borderline' ? 'text-warning' : 'text-danger';
              const pillClass = e.expectedClassification === 'likely_optimal' ? 'pill-optimal' : e.expectedClassification === 'likely_borderline' ? 'pill-suboptimal' : 'pill-critical';
              return (
                <div key={e.code} className="p-4 rounded-xl bg-surface-2 border border-card-border">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5 flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate">{e.shortName}</p>
                      <span className={clsx('text-[9px] font-medium px-2 py-0.5 rounded-full', pillClass)}>
                        {e.expectedClassification.replace('likely_', '~ ').toUpperCase()}
                      </span>
                    </div>
                    <div className="flex items-baseline gap-1.5 shrink-0">
                      <span className={clsx('text-lg font-bold font-mono tabular-nums', color)}>
                        ~{e.estimatedLow}–{e.estimatedHigh}
                      </span>
                      <span className="text-[10px] text-muted">{e.unit}</span>
                    </div>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-2 leading-relaxed">
                    <span className="text-muted">Basis: </span>{e.rationale}
                  </p>
                </div>
              );
            })}
            <div className="mt-3 p-3 rounded-xl bg-amber-500/[0.04] border border-amber-500/15">
              <p className="text-[11px] text-amber-400/90 leading-relaxed">
                ⓘ These are model-based estimates. For actual values, order a lab panel (Synevo, Regina Maria, MedLife, LabCorp) and upload the PDF — the protocol will auto-update.
              </p>
            </div>
          </div>
        ) : (
          <EmptyState message="Biomarker data will appear once you upload bloodwork or complete onboarding." />
        )}
      </Section>

      {/* Nutrition */}
      <Section id="nutrition" title="Nutrition" icon="🥗">
        {!p.nutrition ? <EmptyState message="Nutrition plan will generate after onboarding." /> : (<>
          <div className="grid grid-cols-4 gap-2 text-center">
            <div className="p-3 rounded-xl bg-background border border-card-border">
              <p className="text-xl font-bold font-mono">{p.nutrition.dailyCalories}</p>
              <p className="text-[10px] text-muted">kcal/day</p>
            </div>
            <div className="p-3 rounded-xl bg-background border border-card-border">
              <p className="text-xl font-bold font-mono text-red-400">{p.nutrition.macros?.protein}g</p>
              <p className="text-[10px] text-muted">Protein</p>
            </div>
            <div className="p-3 rounded-xl bg-background border border-card-border">
              <p className="text-xl font-bold font-mono text-blue-400">{p.nutrition.macros?.carbs}g</p>
              <p className="text-[10px] text-muted">Carbs</p>
            </div>
            <div className="p-3 rounded-xl bg-background border border-card-border">
              <p className="text-xl font-bold font-mono text-amber-400">{p.nutrition.macros?.fat}g</p>
              <p className="text-[10px] text-muted">Fats</p>
            </div>
          </div>
          {p.nutrition.eatingWindow && <p className="text-sm text-muted-foreground">Eating window: <span className="text-accent font-mono">{p.nutrition.eatingWindow}</span></p>}
          {p.nutrition.meals?.map((m, i) => (
            <div key={i} className="p-3 rounded-xl bg-background border border-card-border">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">{m.name}</p>
                {m.time && <span className="text-[10px] text-accent font-mono">{m.time}</span>}
                {m.calories && <span className="text-[10px] text-muted font-mono">{m.calories} kcal</span>}
              </div>
              <p className="text-xs text-muted-foreground mt-1">{m.description}</p>
              {m.recipe && <p className="text-[10px] text-muted mt-1">{m.recipe}</p>}
            </div>
          ))}
          {p.nutrition.foodsToAdd && p.nutrition.foodsToAdd.length > 0 && (
            <div><p className="text-xs text-accent font-medium mb-1">+ Add to diet</p>
              {p.nutrition.foodsToAdd.map((f, i) => <p key={i} className="text-xs text-muted-foreground">• <span className="text-foreground">{f.food}</span> — {f.why}</p>)}
            </div>
          )}
        </>)}
      </Section>

      {/* Supplements timeline */}
      <Section id="supplements" title="Supplements" icon="💊">
        {(!p.supplements || p.supplements.length === 0) ? <EmptyState message="Supplement stack will be generated based on your biomarkers." /> : (<>
          <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
            <span>{p.supplements.length} supplements</span>
            <span className="text-accent font-mono font-bold">{totalSupCost} RON/mo</span>
          </div>
          {['morning', 'with food', 'evening', 'bedtime'].map((time) => {
            const timeSups = p.supplements.filter(s => s.timing?.toLowerCase().includes(time));
            if (timeSups.length === 0) return null;
            return (
              <div key={time} className="mb-3">
                <p className="text-[10px] text-accent uppercase tracking-wider mb-1.5">☀️ {time}</p>
                <div className="space-y-2">
                  {timeSups.map((s, i) => (
                    <div key={i} className={clsx('p-3 rounded-xl border', s.priority === 'MUST' ? 'bg-accent/5 border-accent/20' : s.priority === 'STRONG' ? 'bg-blue-500/5 border-blue-500/20' : 'bg-card border-card-border')}>
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="text-sm font-semibold">{s.name}</p>
                          <p className="text-[10px] text-muted-foreground">{s.dose} • {s.form}</p>
                        </div>
                        <span className={clsx('text-[9px] font-mono px-2 py-0.5 rounded-full', s.priority === 'MUST' ? 'bg-accent/20 text-accent' : s.priority === 'STRONG' ? 'bg-blue-500/20 text-blue-400' : 'bg-card-border text-muted')}>{s.priority}</span>
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-1.5">{s.justification}</p>
                      {s.startWeek && s.startWeek > 1 && <p className="text-[10px] text-amber-400 mt-1">Start week {s.startWeek}</p>}
                      <a href={`https://www.emag.ro/search/${encodeURIComponent(s.emagSearchQuery || s.name + ' ' + (s.form || ''))}`}
                        target="_blank" rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 mt-1.5 text-[10px] text-accent hover:underline">🛒 Find on eMAG</a>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
          {/* Unsorted supplements */}
          {p.supplements.filter(s => !['morning', 'with food', 'evening', 'bedtime'].some(t => s.timing?.toLowerCase().includes(t))).length > 0 && (
            <div>
              <p className="text-[10px] text-accent uppercase tracking-wider mb-1.5">📋 Other</p>
              {p.supplements.filter(s => !['morning', 'with food', 'evening', 'bedtime'].some(t => s.timing?.toLowerCase().includes(t))).map((s, i) => (
                <div key={i} className="p-3 rounded-xl border bg-card border-card-border mb-2">
                  <p className="text-sm font-semibold">{s.name} <span className="text-[10px] text-muted font-normal">{s.dose} • {s.timing}</span></p>
                  <p className="text-[10px] text-muted-foreground mt-1">{s.justification}</p>
                </div>
              ))}
            </div>
          )}
        </>)}
      </Section>

      {/* Daily Schedule */}
      <Section id="schedule" title="Daily Schedule" icon="⏰">
        {(!p.dailySchedule || p.dailySchedule.length === 0) ? <EmptyState message="Daily timeline will appear once your protocol generates." /> : (
          <div className="space-y-1">
            {p.dailySchedule.map((item, i) => (
              <div key={i} className="flex items-start gap-3 py-2">
                <span className="text-xs font-mono text-accent w-12 shrink-0">{item.time}</span>
                <div className="w-0.5 h-full bg-accent/20 shrink-0 self-stretch" />
                <div>
                  <p className="text-sm">{item.activity}</p>
                  {item.duration && <p className="text-[10px] text-muted">{item.duration}{item.notes ? ` — ${item.notes}` : ''}</p>}
                </div>
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* Exercise */}
      <Section id="exercise" title="Exercise" icon="🏋️">
        {!p.exercise ? <EmptyState message="Exercise plan will generate based on your activity level and goals." /> : (<>
          <div className="flex gap-4 text-xs text-muted-foreground mb-3">
            <span>Zone 2: <span className="text-accent font-mono">{p.exercise.zone2Target} min/wk</span></span>
            <span>Strength: <span className="text-accent font-mono">{p.exercise.strengthSessions}x/wk</span></span>
            {p.exercise.dailyStepsTarget && <span>Steps: <span className="text-accent font-mono">{p.exercise.dailyStepsTarget?.toLocaleString()}/day</span></span>}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {(p.exercise.weeklyPlan || []).map((d, i) => (
              <div key={i} className={clsx('p-2 rounded-xl text-center border', d.intensity?.toLowerCase().includes('rest') ? 'bg-card border-card-border' : 'bg-accent/5 border-accent/20')}>
                <p className="text-[9px] font-mono text-accent">{d.day?.slice(0, 3)}</p>
                <p className="text-[10px] mt-1 leading-tight">{d.activity?.split(' ').slice(0, 3).join(' ')}</p>
                <p className="text-[9px] text-muted mt-0.5">{d.duration}</p>
              </div>
            ))}
          </div>
        </>)}
      </Section>

      {/* Sleep */}
      <Section id="sleep" title="Sleep" icon="🌙">
        {!p.sleep ? <EmptyState message="Sleep protocol will be calibrated to your chronotype and schedule." /> : (<>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="p-3 rounded-xl bg-background border border-card-border">
              <p className="text-lg font-bold font-mono">{p.sleep.targetBedtime}</p>
              <p className="text-[10px] text-muted">Bedtime</p>
            </div>
            <div className="p-3 rounded-xl bg-background border border-card-border">
              <p className="text-lg font-bold font-mono">{p.sleep.targetWakeTime || '06:00'}</p>
              <p className="text-[10px] text-muted">Wake</p>
            </div>
            <div className="p-3 rounded-xl bg-background border border-card-border">
              <p className="text-lg font-bold font-mono text-accent">{p.sleep.morningLightMinutes}m</p>
              <p className="text-[10px] text-muted">AM Light</p>
            </div>
          </div>
          {p.sleep.windDownRoutine?.length > 0 && (
            <div><p className="text-xs text-accent font-medium mb-1">Wind-down routine</p>
              {p.sleep.windDownRoutine.map((s, i) => <p key={i} className="text-xs text-muted-foreground">• {typeof s === 'string' ? s : `${s.time}: ${s.action}`}</p>)}
            </div>
          )}
        </>)}
      </Section>

      {/* Universal Tips */}
      <Section id="tips" title="Universal Longevity Tips" icon="💡">
        {(!p.universalTips || p.universalTips.length === 0) ? <EmptyState message="Universal longevity tips are available after protocol generation." /> : (<>
          {p.universalTips.map((cat, i) => (
            <div key={i}>
              <p className="text-xs text-accent font-medium mb-1">{cat.category}</p>
              {cat.tips.map((t, j) => (
                <div key={j} className="flex items-start gap-2 mb-1.5">
                  <span className={clsx('text-[9px] px-1.5 py-0.5 rounded shrink-0 mt-0.5',
                    t.difficulty === 'easy' ? 'bg-accent/20 text-accent' : t.difficulty === 'medium' ? 'bg-amber-500/20 text-amber-400' : 'bg-red-500/20 text-red-400'
                  )}>{t.difficulty}</span>
                  <div>
                    <p className="text-xs">{t.tip}</p>
                    <p className="text-[10px] text-muted">{t.why}</p>
                  </div>
                </div>
              ))}
            </div>
          ))}
        </>)}
      </Section>

      {/* Tracking */}
      <Section id="tracking" title="What to Track" icon="📊">
        {!p.tracking ? <EmptyState message="Tracking metrics will appear after protocol generation." /> : (<>
          {p.tracking.daily && <div><p className="text-xs text-accent font-medium mb-1">Daily</p>{p.tracking.daily.map((d, i) => <p key={i} className="text-xs text-muted-foreground">• {d}</p>)}</div>}
          {p.tracking.retestSchedule && p.tracking.retestSchedule.length > 0 && (
            <div><p className="text-xs text-accent font-medium mb-1">Retest Schedule</p>
              {p.tracking.retestSchedule.map((r, i) => <p key={i} className="text-xs text-muted-foreground">• <span className="text-foreground">{r.marker}</span> in {r.weeks} weeks — {r.why}</p>)}
            </div>
          )}
        </>)}
      </Section>

      {/* Pain Point Solutions */}
      <Section id="painpoints" title="Your Pain Points" icon="🎯">
        {(!p.painPointSolutions || p.painPointSolutions.length === 0) ? <EmptyState message="Describe your pain points in onboarding to get personalized solutions." /> : (
          <div className="space-y-3">
            {p.painPointSolutions.map((pp, i) => (
              <div key={i} className="p-4 rounded-xl bg-background border border-card-border space-y-2">
                <p className="text-sm font-semibold text-accent">⚡ {pp.problem}</p>
                <div className="space-y-1 text-xs">
                  <p className="text-muted-foreground"><span className="text-amber-400 font-medium">Cause:</span> {pp.likelyCause}</p>
                  <p className="text-muted-foreground"><span className="text-accent font-medium">Solution:</span> {pp.solution}</p>
                  <p className="text-muted"><span className="text-muted-foreground font-medium">Timeline:</span> {pp.expectedTimeline}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* Flex Rules */}
      <Section id="flex" title="Flex Strategies" icon="🧘">
        {(!p.flexRules || p.flexRules.length === 0) ? <EmptyState message="Describe your non-negotiables (pizza nights, morning coffee) in onboarding to get flex strategies." /> : (<>
          <p className="text-[10px] text-muted-foreground">Life strategies that keep your non-negotiables without derailing the protocol.</p>
          <div className="space-y-2">
            {p.flexRules.map((f, i) => (
              <div key={i} className="p-3 rounded-xl bg-background border border-card-border">
                <p className="text-sm font-medium text-accent mb-1">🎯 {f.scenario}</p>
                <p className="text-xs text-muted-foreground">{f.strategy}</p>
              </div>
            ))}
          </div>
        </>)}
      </Section>

      {/* Week-by-Week Plan */}
      <Section id="weekplan" title="Next 4 Weeks — Concrete" icon="📅">
        {(!p.weekByWeekPlan || p.weekByWeekPlan.length === 0) ? <EmptyState message="4-week actionable plan will be generated with your protocol." /> : (
          <div className="space-y-3">
            {p.weekByWeekPlan.slice(0, 4).map((w, i) => (
              <div key={i} className="p-3 rounded-xl bg-background border border-card-border space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono text-accent font-bold">Week {w.week}</span>
                  <span className="text-xs text-muted-foreground">{w.focus}</span>
                </div>
                {w.mondayActions && w.mondayActions.length > 0 && <div><p className="text-[10px] text-accent uppercase tracking-wider">Monday</p>{w.mondayActions.map((a, j) => <p key={j} className="text-xs text-muted-foreground">• {a}</p>)}</div>}
                {w.wednesdayActions && w.wednesdayActions.length > 0 && <div><p className="text-[10px] text-accent uppercase tracking-wider">Wednesday</p>{w.wednesdayActions.map((a, j) => <p key={j} className="text-xs text-muted-foreground">• {a}</p>)}</div>}
                {w.fridayActions && w.fridayActions.length > 0 && <div><p className="text-[10px] text-accent uppercase tracking-wider">Friday</p>{w.fridayActions.map((a, j) => <p key={j} className="text-xs text-muted-foreground">• {a}</p>)}</div>}
                {w.weekendActions && w.weekendActions.length > 0 && <div><p className="text-[10px] text-accent uppercase tracking-wider">Weekend</p>{w.weekendActions.map((a, j) => <p key={j} className="text-xs text-muted-foreground">• {a}</p>)}</div>}
                {w.endOfWeekCheck && w.endOfWeekCheck.length > 0 && <div><p className="text-[10px] text-amber-400 uppercase tracking-wider">End-of-week check</p>{w.endOfWeekCheck.map((a, j) => <p key={j} className="text-xs text-muted-foreground">• {a}</p>)}</div>}
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* Doctor Questions */}
      <Section id="doctor-questions" title="Questions for Your Doctor" icon="📋">
        {(!p.doctorQuestions || p.doctorQuestions.length === 0) ? <EmptyState message="Printable questions for your next doctor visit will appear here." /> : (<>
          <p className="text-[10px] text-muted-foreground">Print this for your next appointment.</p>
          <div className="space-y-2">
            {p.doctorQuestions.map((q, i) => (
              <div key={i} className="flex gap-3 p-3 rounded-xl bg-background border border-card-border">
                <span className="text-xs font-mono text-accent shrink-0">{i + 1}.</span>
                <p className="text-sm">{q}</p>
              </div>
            ))}
          </div>
        </>)}
      </Section>

      {/* Doctor Discussion */}
      <Section id="doctor" title="Doctor Discussion" icon="👨‍⚕️">
        {!p.doctorDiscussion || (!p.doctorDiscussion.redFlags?.length && !p.doctorDiscussion.rxSuggestions?.length && !p.doctorDiscussion.specialistReferrals?.length) ? <EmptyState message="No red flags or referrals detected from your data. Good news!" /> : (
          <div className="rounded-xl bg-warning/5 border border-warning/20 p-3">
            <p className="text-[10px] text-warning font-medium mb-2">⚠️ These recommendations do NOT replace medical consultation.</p>
            {p.doctorDiscussion.redFlags?.map((f, i) => <p key={i} className="text-xs text-danger mb-1">🚩 {f}</p>)}
            {p.doctorDiscussion.rxSuggestions?.map((r, i) => <p key={i} className="text-xs text-muted-foreground mb-1">💊 {r}</p>)}
            {p.doctorDiscussion.specialistReferrals?.map((s, i) => <p key={i} className="text-xs text-muted-foreground mb-1">🏥 {s}</p>)}
            {p.doctorDiscussion.testsToOrder?.map((t, i) => <p key={i} className="text-xs text-muted-foreground mb-1">🧪 {t}</p>)}
          </div>
        )}
      </Section>

      {/* Roadmap */}
      <Section id="roadmap" title="12-Week Roadmap" icon="🗺️">
        {(!p.roadmap || p.roadmap.length === 0) ? <EmptyState message="12-week roadmap will appear after protocol generation." /> : (
          <>{p.roadmap.map((r, i) => (
            <div key={i} className="flex gap-3">
              <div className="flex flex-col items-center">
                <div className={clsx('w-3 h-3 rounded-full shrink-0', i === 0 ? 'bg-accent' : 'bg-card-border')} />
                {i < p.roadmap.length - 1 && <div className="w-0.5 flex-1 bg-card-border" />}
              </div>
              <div className="pb-4">
                <p className="text-sm font-medium text-accent">{r.week}{r.title ? ` — ${r.title}` : ''}</p>
                {r.actions.map((a, j) => <p key={j} className="text-xs text-muted-foreground mt-0.5">• {a}</p>)}
              </div>
            </div>
          ))}</>
        )}
      </Section>

      {/* Shopping List */}
      <Section id="shopping" title="Shopping List" icon="🛒">
        {(!p.shoppingList || p.shoppingList.length === 0) ? <EmptyState message="Shopping list with eMAG links will generate with your protocol." /> : (<>
          {p.costBreakdown && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center mb-3">
              <div className="p-2 rounded-xl bg-background border border-card-border">
                <p className="text-sm font-bold font-mono">{p.costBreakdown.monthlySupplements}</p>
                <p className="text-[9px] text-muted">Supplements</p>
              </div>
              <div className="p-2 rounded-xl bg-background border border-card-border">
                <p className="text-sm font-bold font-mono">{p.costBreakdown.monthlyFood}</p>
                <p className="text-[9px] text-muted">Food</p>
              </div>
              <div className="p-2 rounded-xl bg-background border border-card-border">
                <p className="text-sm font-bold font-mono">{p.costBreakdown.oneTimeEquipment}</p>
                <p className="text-[9px] text-muted">Equipment</p>
              </div>
              <div className="p-2 rounded-xl bg-background border border-accent/30">
                <p className="text-sm font-bold font-mono text-accent">{p.costBreakdown.totalMonthlyOngoing}</p>
                <p className="text-[9px] text-accent">Total/mo</p>
              </div>
            </div>
          )}
          {p.shoppingList.map((cat, i) => (
            <div key={i}>
              <p className="text-xs text-accent font-medium mb-1">{cat.category}</p>
              {cat.items?.map((item, j) => (
                <div key={j} className="flex items-center justify-between py-1.5 text-xs border-b border-card-border last:border-0">
                  <a href={`https://www.emag.ro/search/${encodeURIComponent(item.emagQuery || item.name)}`} target="_blank" rel="noopener noreferrer" className="hover:text-accent transition-colors">{item.name} ↗</a>
                  <div className="flex items-center gap-2 shrink-0 ml-2">
                    {item.priority && <span className={clsx('text-[9px] px-1.5 py-0.5 rounded', item.priority === 'buy now' ? 'bg-accent/20 text-accent' : 'bg-card-border text-muted')}>{item.priority}</span>}
                    <span className="text-muted font-mono">{item.estimatedCostRon} RON</span>
                  </div>
                </div>
              ))}
            </div>
          ))}
        </>)}
      </Section>

      {/* Footer */}
      <div className="text-center py-6 space-y-2">
        <p className="text-xs text-muted">Generated by <span className="text-accent">Protocol AI Engine</span></p>
        <p className="text-[10px] text-muted">This is not medical advice. Consult a doctor before making changes.</p>
        <button onClick={async () => { await fetch('/api/reset-onboarding', { method: 'POST' }); window.location.href = '/onboarding'; }} className="text-xs text-accent hover:underline">Regenerate protocol</button>
      </div>
      </div>
    </div>
  );
}
