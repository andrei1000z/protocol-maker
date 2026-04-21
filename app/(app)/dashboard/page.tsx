'use client';

import { useState, useEffect, useMemo } from 'react';
import { ProtocolOutput, Classification } from '@/lib/types';
import { getClassificationColor, getClassificationBg } from '@/lib/engine/classifier';
import { computeBiomarkerTrends, computeRetestDue, type BiomarkerTrend } from '@/lib/engine/biomarker-trends';
import { extractPhenoAgeInputs, assessPhenoAgeConfidence } from '@/lib/engine/phenoage';
import { AskAIPill } from '@/components/dashboard/AskAIPill';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { AnimatedNumber } from '@/components/ui/AnimatedNumber';
import { DashboardTOC } from '@/components/layout/DashboardTOC';
import { useMyData, useProtocolDiff, useLiveScores } from '@/lib/hooks/useApiData';
import { SAMPLE_PROTOCOL, SAMPLE_LONGEVITY_SCORE, SAMPLE_BIO_AGE } from '@/lib/engine/sample-protocol';
import { BRYAN } from '@/lib/engine/bryan-constants';
import { pickTodaysFocus, type ScheduleEntry, type FocusPick } from '@/lib/engine/todays-focus';
import { ProgressRing } from '@/components/ui/SectionCard';
import clsx from 'clsx';
import dynamic from 'next/dynamic';

// Radar chart lives in its own file + loads lazily on the client — keeps
// recharts (~150 KB) out of the critical-path bundle. Dashboard renders
// everything else immediately; the radar fades in once the chunk arrives.
const OrganRadar = dynamic(() => import('@/components/dashboard/OrganRadar'), {
  ssr: false,
  loading: () => (
    <div className="h-[300px] flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
    </div>
  ),
});

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
];

function Section({ id, title, icon, subtitle, action, children, className }: { id?: string; title: string; icon: string; subtitle?: string; action?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <div id={id} className={clsx('glass-card rounded-2xl p-6 space-y-5 scroll-mt-20 animate-fade-in-up', className)}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <h2 className="text-xl font-semibold tracking-tight flex items-center gap-2.5">
            <span className="text-2xl">{icon}</span>{title}
          </h2>
          {subtitle && <p className="text-xs text-muted-foreground mt-1.5 max-w-lg leading-relaxed">{subtitle}</p>}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
      {children}
    </div>
  );
}

function EmptyState({ message, allowRegenerate }: { message: string; allowRegenerate?: boolean }) {
  // When `allowRegenerate` is true, show an inline button so the user can
  // trigger a fresh AI generation right from the missing section instead
  // of scrolling to the footer.
  const regen = async () => {
    // Hit the regenerate endpoint directly (no onboarding reset needed if the
    // user already has a profile). Redirect to dashboard with a cache-buster
    // so SWR re-reads the fresh protocol.
    const res = await fetch('/api/generate-protocol', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ profile: {}, biomarkers: [] }),
    });
    if (res.ok) window.location.href = '/dashboard';
    else window.location.href = '/onboarding';  // fallback: let onboarding resync
  };
  return (
    <div className="p-8 rounded-xl bg-background/50 border border-dashed border-card-border text-center space-y-3">
      <p className="text-xs text-muted-foreground">{message}</p>
      {allowRegenerate ? (
        <div className="space-y-2">
          <p className="text-[10px] text-muted">This looks like an incomplete generation — regenerate to fill it in.</p>
          <button onClick={regen} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent text-black text-xs font-semibold hover:bg-accent-bright transition-colors">
            ↻ Regenerate protocol
          </button>
        </div>
      ) : (
        <p className="text-[10px] text-muted mt-1.5">Upload blood work or complete more onboarding for richer data.</p>
      )}
    </div>
  );
}

// Alerts the user that their currently-stored protocol is missing required
// sections (usually because an older AI generation returned a sparse JSON
// that slipped past our validation layer). Offers an inline regenerate.
// Tight UX: one sentence + one button. Regeneration fires /api/generate-protocol
// which, post Round 14 fix, will merge in any still-missing fallback sections.
function IncompleteProtocolBanner({ missing }: { missing: string[] }) {
  const [regenerating, setRegenerating] = useState(false);
  const doRegen = async () => {
    setRegenerating(true);
    try {
      const res = await fetch('/api/generate-protocol', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profile: {}, biomarkers: [] }),
      });
      if (res.ok) {
        window.location.href = '/dashboard';
        return;
      }
    } catch { /* network — fall through to onboarding */ }
    window.location.href = '/onboarding';
  };
  return (
    <div className="rounded-2xl bg-amber-500/[0.06] border border-amber-500/30 p-4 flex items-start gap-3 animate-fade-in-up">
      <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center shrink-0">
        <span className="text-base">⚠️</span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-warning">Your protocol is incomplete — missing {missing.join(' + ')}</p>
        <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
          The AI returned a partial response last time. One tap to regenerate fills every section with fresh data based on your profile and biomarkers.
        </p>
      </div>
      <button
        onClick={doRegen}
        disabled={regenerating}
        className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent text-black text-xs font-semibold hover:bg-accent-bright disabled:opacity-60 transition-colors"
      >
        {regenerating ? 'Regenerating…' : '↻ Regenerate now'}
      </button>
    </div>
  );
}

// Notifies the user their protocol was auto-regenerated by the 3 AM cron
// since their last visit, so new numbers on the dashboard don't feel like
// they came from nowhere. Dismissal is stored per protocol id in localStorage,
// so the banner won't come back until the NEXT cron regenerates.
// Small chip that surfaces a live-refinement delta next to a hero metric.
// "direction: up" = improvement (accent green), "down" = decline (danger red).
function LiveDriftChip({ label, direction, value, title }: {
  label: string;
  direction: 'up' | 'down';
  value: string;
  title?: string;
}) {
  const tone = direction === 'up'
    ? 'bg-accent/10 text-accent border-accent/25'
    : 'bg-red-500/10 text-danger border-red-500/25';
  const arrow = direction === 'up' ? '↑' : '↓';
  return (
    <span
      title={title}
      className={clsx(
        'inline-flex items-center gap-1 mt-2 ml-2 text-[10px] font-mono px-2 py-0.5 rounded-full border',
        tone,
      )}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
      {label} {arrow} {value}
    </span>
  );
}

// One-shot toast showing the delta from the user's most recent regen.
// Written by the tracking page's Refresh button into localStorage; we read
// it on mount, render it once, then clear so a refresh doesn't re-show.
function RegenDiffToast() {
  const [diff, setDiff] = useState<{
    scoreDelta: number | null;
    bioAgeDelta: number | null;
    paceDelta: number | null;
    supplementsAdded: number;
    supplementsRemoved: number;
  } | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const raw = localStorage.getItem('protocol:regen-diff:latest');
      if (!raw) return;
      const parsed = JSON.parse(raw) as { diff?: unknown; ts?: number };
      // 5-minute TTL so stale diffs don't pop up after a cache hit
      if (parsed?.ts && Date.now() - parsed.ts < 5 * 60_000 && parsed.diff) {
        setDiff(parsed.diff as typeof diff);
      }
      localStorage.removeItem('protocol:regen-diff:latest');
    } catch { /* corrupt or quota — ignore */ }
  }, []);

  if (!diff || dismissed) return null;
  const bits: string[] = [];
  if (typeof diff.scoreDelta === 'number' && diff.scoreDelta !== 0) {
    bits.push(`${diff.scoreDelta > 0 ? '+' : ''}${diff.scoreDelta} score`);
  }
  if (typeof diff.bioAgeDelta === 'number' && Math.abs(diff.bioAgeDelta) >= 0.1) {
    bits.push(`${diff.bioAgeDelta > 0 ? '+' : ''}${diff.bioAgeDelta.toFixed(1)}y bio age`);
  }
  if (typeof diff.paceDelta === 'number' && Math.abs(diff.paceDelta) >= 0.01) {
    bits.push(`${diff.paceDelta > 0 ? '+' : ''}${diff.paceDelta.toFixed(2)} pace`);
  }
  if (diff.supplementsAdded > 0) bits.push(`+${diff.supplementsAdded} supplements`);
  if (diff.supplementsRemoved > 0) bits.push(`−${diff.supplementsRemoved} supplements`);

  return (
    <div className="rounded-2xl bg-gradient-to-r from-accent/[0.12] to-accent/[0.04] border border-accent/30 p-4 flex items-center gap-3 animate-fade-in-up no-print">
      <span className="text-xl shrink-0">✨</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-accent">Protocol refreshed</p>
        <p className="text-[11px] text-muted-foreground mt-0.5">
          {bits.length > 0 ? bits.join(' · ') : 'No major changes from last version.'}
        </p>
      </div>
      <button
        onClick={() => setDismissed(true)}
        aria-label="Dismiss"
        className="shrink-0 text-[11px] text-muted-foreground hover:text-foreground px-2 py-1"
      >
        Dismiss
      </button>
    </div>
  );
}

// Today's Focus — pulls 1-2 entries from dailySchedule matching the current
// time window + priority ranking. Re-computes every 60s so urgency transitions
// (upcoming → soon → now → past) happen live without a full page refresh.
function TodaysFocusBlock({ schedule }: { schedule: ScheduleEntry[] }) {
  const [picks, setPicks] = useState<FocusPick[]>(() => pickTodaysFocus(schedule));
  useEffect(() => {
    // Initial compute on mount (client time).
    setPicks(pickTodaysFocus(schedule));
    const tick = setInterval(() => setPicks(pickTodaysFocus(schedule)), 60_000);
    return () => clearInterval(tick);
  }, [schedule]);

  if (picks.length === 0) return null;

  const urgencyStyle = {
    now:      { label: 'Now',      bg: 'from-accent/15 border-accent/30',     pill: 'bg-accent text-black' },
    soon:     { label: 'Soon',     bg: 'from-accent/[0.08] border-accent/20', pill: 'bg-accent/20 text-accent border border-accent/30' },
    upcoming: { label: 'Later',    bg: 'from-surface-3/50 border-card-border', pill: 'bg-surface-3 text-muted-foreground border border-card-border' },
  } as const;

  const relative = (min: number) => {
    if (Math.abs(min) < 1) return 'right now';
    if (min < 0)  return `${Math.abs(min)} min ago`;
    if (min < 60) return `in ${min} min`;
    const h = Math.floor(min / 60);
    return `in ${h}h ${min - h * 60}m`;
  };

  return (
    <div className="glass-card rounded-2xl p-5 space-y-3 scroll-mt-20 animate-fade-in-up no-print">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-sm font-semibold tracking-tight flex items-center gap-2">
          <span className="text-base">🎯</span>
          Today&apos;s focus
        </h2>
        <p className="text-[10px] text-muted font-mono">From your daily schedule</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        {picks.map((p, i) => {
          const s = urgencyStyle[p.urgency];
          return (
            <div
              key={`${p.time}-${i}`}
              className={clsx('rounded-xl bg-gradient-to-br bg-surface-2 border p-3.5 space-y-1.5', s.bg)}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] font-mono tabular-nums text-muted-foreground">
                  {p.time} · {relative(p.minutesUntil)}
                </span>
                <span className={clsx('text-[9px] uppercase tracking-widest px-1.5 py-0.5 rounded', s.pill)}>
                  {s.label}
                </span>
              </div>
              <p className="text-sm font-semibold leading-snug">{p.title}</p>
              {p.mechanism && (
                <p className="text-[11px] text-muted-foreground leading-relaxed line-clamp-2">{p.mechanism}</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function CronRegenBanner({ createdAt, protocolId }: { createdAt: string; protocolId: string }) {
  const [dismissed, setDismissed] = useState<boolean | null>(null);

  useEffect(() => {
    // Client-only check — localStorage isn't available during SSR
    try {
      const seen = localStorage.getItem(`protocol:cron-banner-seen:${protocolId}`);
      setDismissed(seen === '1');
    } catch { setDismissed(false); }
  }, [protocolId]);

  // Only show if the cron ran in the last 48h (older = user clearly knows already)
  const hoursOld = (Date.now() - new Date(createdAt).getTime()) / 3_600_000;
  if (dismissed !== false || hoursOld > 48) return null;

  const dismiss = () => {
    try { localStorage.setItem(`protocol:cron-banner-seen:${protocolId}`, '1'); } catch { /* ignore */ }
    setDismissed(true);
  };

  const when = hoursOld < 12 ? 'overnight' : hoursOld < 24 ? 'earlier today' : 'yesterday';
  return (
    <div className="rounded-2xl bg-gradient-to-r from-blue-500/[0.08] to-accent/[0.05] border border-blue-500/25 p-4 flex items-center gap-3 animate-fade-in-up">
      <div className="w-10 h-10 rounded-xl bg-blue-500/15 border border-blue-500/30 flex items-center justify-center shrink-0">
        <span className="text-base">🌙</span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-blue-400">Your protocol was refreshed {when}</p>
        <p className="text-[11px] text-muted-foreground mt-0.5">Fresh analysis based on your latest tracked data. Scroll down to see what changed vs the previous version.</p>
      </div>
      <button
        onClick={dismiss}
        className="shrink-0 px-3 py-1.5 rounded-lg bg-surface-2 border border-card-border text-xs font-medium text-muted-foreground hover:text-foreground hover:border-accent/30 transition-colors"
      >
        Dismiss
      </button>
    </div>
  );
}

function Badge({ classification }: { classification: Classification }) {
  return (
    <span className={clsx('text-[10px] font-mono px-2 py-0.5 rounded-full border', getClassificationBg(classification), getClassificationColor(classification))}>
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
  const { data: myData, isLoading } = useMyData();
  const { data: diffData } = useProtocolDiff();
  // Compute per-biomarker delta vs previous blood test + retest-due markers
  // from the user's actual lab history. Both are derived inline so the
  // dashboard has no extra fetch — the data is already in myData.bloodTests.
  const biomarkerTrends = useMemo<Map<string, BiomarkerTrend>>(
    () => computeBiomarkerTrends((myData?.bloodTests ?? []) as Parameters<typeof computeBiomarkerTrends>[0]),
    [myData?.bloodTests],
  );
  const retestDue = useMemo(() => {
    const tests = (myData?.bloodTests ?? []) as NonNullable<Parameters<typeof computeRetestDue>[0]>[];
    // Latest test is the one with the most recent taken_at — defensive sort.
    const sorted = [...tests].sort((a, b) => new Date(b.taken_at).getTime() - new Date(a.taken_at).getTime());
    return computeRetestDue(sorted[0] ?? null);
  }, [myData?.bloodTests]);
  // PhenoAge confidence — how many of the 9 blood markers the algorithm
  // actually has. Below 4, the biological-age number is largely a population
  // average with profile noise. Dashboard shows this next to bio age.
  const phenoConfidence = useMemo(() => {
    const tests = (myData?.bloodTests ?? []) as Array<{ taken_at: string; biomarkers: Array<{ code: string; value: number; unit?: string }> }>;
    if (tests.length === 0) return null;
    const sorted = [...tests].sort((a, b) => new Date(b.taken_at).getTime() - new Date(a.taken_at).getTime());
    const latest = sorted[0];
    if (!latest?.biomarkers) return null;
    // extractPhenoAgeInputs only reads `code` + `value`; coerce unit to empty
    // string to satisfy BiomarkerValue's stricter typing at the boundary.
    const normalized = latest.biomarkers.map(b => ({ code: b.code, value: b.value, unit: b.unit ?? '' }));
    return assessPhenoAgeConfidence(extractPhenoAgeInputs(normalized));
  }, [myData?.bloodTests]);
  // Live refined scores — computed against current profile + bloodwork +
  // last-30d daily metrics without the AI in the loop. Updates whenever the
  // tracking page saves a metric (invalidate.liveScores()) so the dashboard
  // hero reflects new data instantly instead of waiting for a full regen.
  const { data: liveScores } = useLiveScores();
  const [expandedBiomarker, setExpandedBiomarker] = useState<string | null>(null);
  const [demoMode, setDemoMode] = useState(false);
  const [showEstimatedBiomarkers, setShowEstimatedBiomarkers] = useState(false);

  // Detect ?demo=1 — render sample data instead of fetching the user's protocol.
  // Powers the landing-page "Try with sample data" CTA without forcing signup.
  useEffect(() => {
    if (typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('demo')) {
      setDemoMode(true);
    }
  }, []);

  // Derive stable view-model from cached data — or use sample data in demo mode
  const data = demoMode
    ? { protocol: SAMPLE_PROTOCOL, longevityScore: SAMPLE_LONGEVITY_SCORE, biologicalAge: SAMPLE_BIO_AGE }
    : myData?.protocol ? {
        protocol: myData.protocol.protocol_json as unknown as ProtocolOutput,
        longevityScore: myData.protocol.longevity_score ?? 0,
        biologicalAge: myData.protocol.biological_age ?? 0,
      } : null;

  // Skeleton mirrors the final responsive layout: max-w-[1200px] container,
  // TOC sidebar on lg+ (hidden below), hero card with 3 metric tiles, then
  // 4 content cards. Prevents the width-jump that the simpler narrower
  // skeleton used to cause on first load. CLS target: <0.05.
  if (!demoMode && isLoading && !data) return (
    <div className="max-w-[1200px] mx-auto px-4 py-6 flex gap-6">
      {/* Desktop TOC sidebar placeholder */}
      <aside className="hidden lg:block w-60 shrink-0 space-y-2 sticky top-20 h-fit">
        {[1, 2, 3, 4, 5, 6].map(i => <div key={i} className="h-7 rounded-lg bg-card-border/25 animate-pulse" />)}
      </aside>

      {/* Main column */}
      <div className="flex-1 min-w-0 space-y-5">
        {/* Hero card — 3 big metrics */}
        <div className="hero-card rounded-3xl p-6 sm:p-8 space-y-5">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-2 flex-1">
              <div className="h-3 w-32 rounded bg-card-border/30 animate-pulse" />
              <div className="h-8 w-48 rounded-xl bg-card-border/30 animate-pulse" />
              <div className="h-4 w-full max-w-md rounded-lg bg-card-border/30 animate-pulse" />
            </div>
            <div className="h-8 w-20 rounded-xl bg-card-border/30 animate-pulse shrink-0" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="metric-tile space-y-2">
                <div className="h-3 w-24 rounded bg-card-border/30 animate-pulse" />
                <div className="h-10 w-20 rounded-xl bg-card-border/30 animate-pulse" />
                <div className="h-3 w-28 rounded bg-card-border/30 animate-pulse" />
              </div>
            ))}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[1, 2].map(i => (
              <div key={i} className="p-5 rounded-2xl bg-surface-2 border border-card-border space-y-2">
                <div className="h-3 w-20 rounded bg-card-border/30 animate-pulse" />
                <div className="space-y-1.5">
                  {[1, 2, 3].map(j => <div key={j} className="h-3 w-full rounded bg-card-border/30 animate-pulse" />)}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 4 content section cards */}
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="glass-card rounded-2xl p-5 sm:p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-card-border/30 animate-pulse shrink-0" />
              <div className="space-y-1.5 flex-1">
                <div className="h-5 w-40 rounded bg-card-border/30 animate-pulse" />
                <div className="h-3 w-64 rounded bg-card-border/30 animate-pulse" />
              </div>
            </div>
            <div className="h-24 w-full rounded-xl bg-card-border/25 animate-pulse" />
          </div>
        ))}
      </div>
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

  // Cron-regen banner — surface overnight auto-regenerations the user hasn't
  // yet acknowledged. Without this, the dashboard silently changes while they
  // sleep and users wonder why numbers moved. Only relevant to real (non-demo)
  // protocols with a cron generation source and a fresh timestamp.
  const cronBannerInfo = !demoMode && myData?.protocol?.generation_source === 'cron' && myData.protocol.created_at
    ? { createdAt: myData.protocol.created_at, protocolId: myData.protocol.id }
    : null;
  // Prefer the live organ scores when present — re-computes on every tracking
  // save so the radar reflects new data without waiting for a regen. Falls
  // back to the snapshot saved at last generation.
  const organScoresSource = liveScores?.organScores ?? diag?.organSystemScores;
  const radarData = organScoresSource
    ? Object.entries(organScoresSource).map(([key, val]) => ({ name: key.charAt(0).toUpperCase() + key.slice(1), score: val as number }))
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

  // Live refined numbers for the hero — when they differ from the locked-in
  // protocol values by at least 1 pt / 0.1 yr / 0.02 pace, surface a subtle
  // chip ("live 72 · locked 69"). Hidden in demo + when scores are identical.
  const live = demoMode ? null : liveScores;
  const hasLive = !!(live?.configured);
  const liveLongevityScore = hasLive && typeof live.longevityScore === 'number' ? live.longevityScore : longevityScore;
  const liveBioAgeDecimal = hasLive && typeof live.biologicalAge === 'number' ? live.biologicalAge : bioAgeDecimal;
  const liveAgingPace = hasLive && typeof live.agingPace === 'number' ? live.agingPace : velocity;
  const scoreDrift = hasLive ? liveLongevityScore - longevityScore : 0;
  const bioAgeDrift = hasLive ? Math.round((liveBioAgeDecimal - bioAgeDecimal) * 10) / 10 : 0;
  const paceDrift = hasLive ? Math.round((liveAgingPace - velocity) * 100) / 100 : 0;
  const liveDelta = hasLive && (Math.abs(scoreDrift) >= 1 || Math.abs(bioAgeDrift) >= 0.1 || Math.abs(paceDrift) >= 0.02);

  const bioYearsLive = Math.floor(liveBioAgeDecimal);
  const bioMonthsLive = Math.round((liveBioAgeDecimal - bioYearsLive) * 12);
  const bioAgeLabelLive = bioMonthsLive === 12 ? `${bioYearsLive + 1}y 0m` : `${bioYearsLive}y ${bioMonthsLive}m`;

  return (
    <div className="max-w-[1200px] mx-auto px-4 py-6 flex gap-6">
      <DashboardTOC items={TOC_ITEMS} />

      <div className="flex-1 min-w-0 space-y-5 max-w-3xl">
      {/* ═══════════════ DEMO MODE BANNER ═══════════════ */}
      {demoMode && (
        <div className="rounded-2xl bg-gradient-to-r from-accent/[0.08] to-blue-500/[0.05] border border-accent/30 p-4 flex items-center gap-3 animate-fade-in-up">
          <div className="w-10 h-10 rounded-xl bg-accent/15 border border-accent/30 flex items-center justify-center shrink-0">
            <span className="text-base">👀</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-accent">Demo mode — sample protocol for a fictional 35-year-old</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">Real numbers from a real-feeling profile (mediterranean eater, mild metabolic risk, gym access). Sign up to get yours.</p>
          </div>
          <a href="/login" className="shrink-0 px-4 py-2 rounded-xl bg-accent text-black text-xs font-semibold hover:bg-accent-bright transition-colors glow-cta">
            Get mine →
          </a>
        </div>
      )}

      {/* ═══════════════ CRON REGEN BANNER — overnight auto-refresh notice ═══════════════ */}
      {cronBannerInfo && <CronRegenBanner createdAt={cronBannerInfo.createdAt} protocolId={cronBannerInfo.protocolId} />}

      {/* ═══════════════ INCOMPLETE-PROTOCOL BANNER ═══════════════
          Detects the "AI returned only {diagnostic:{...}}" failure mode that used
          to slip past Zod validation. If any of nutrition / supplements /
          dailySchedule is missing from the current protocol, surface a loud
          banner with a one-tap Regenerate button. Hidden in demo mode.
          Post Round 14 fix this should stop happening — but old protocols in
          the DB can still be in this state, so the affordance remains. */}
      {/* One-shot "+3 score · −0.4y bio" toast after a manual regen. Self-
          clearing from localStorage; 5-min TTL, dismissable. */}
      {!demoMode && <RegenDiffToast />}

      {!demoMode && (!p.nutrition || !p.supplements?.length || !p.dailySchedule?.length) && (
        <IncompleteProtocolBanner
          missing={[
            !p.nutrition ? 'Nutrition' : null,
            !p.supplements?.length ? 'Supplements' : null,
            !p.dailySchedule?.length ? 'Daily Schedule' : null,
          ].filter(Boolean) as string[]}
        />
      )}

      {/* ═══════════════ PROTOCOL CHANGE BANNER (v2 vs v1) ═══════════════ */}
      {diffData?.diff && (diffData.diff.totalChanges > 0 || diffData.diff.score.delta !== 0 || Math.abs(diffData.diff.bioAge.delta) >= 0.1) && (() => {
        const d = diffData.diff;
        const scoreUp = d.score.delta > 0;
        const bioYounger = d.bioAge.delta < 0;
        const overallPositive = (scoreUp ? 1 : -1) + (bioYounger ? 1 : -1) > 0;
        return (
          <div className={clsx(
            'rounded-2xl border p-5 animate-fade-in-up flex items-start gap-4',
            overallPositive
              ? 'bg-gradient-to-br from-accent/[0.06] to-transparent border-accent/25'
              : 'bg-gradient-to-br from-amber-500/[0.05] to-transparent border-amber-500/20'
          )}>
            <div className={clsx('w-10 h-10 rounded-xl border flex items-center justify-center shrink-0',
              overallPositive ? 'bg-accent/15 border-accent/30' : 'bg-amber-500/15 border-amber-500/30')}>
              <span className="text-base">{overallPositive ? '📈' : '🔄'}</span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline gap-2 flex-wrap">
                <p className={clsx('text-sm font-semibold', overallPositive ? 'text-accent' : 'text-amber-400')}>
                  Protocol updated — {d.totalChanges} change{d.totalChanges === 1 ? '' : 's'} from last version
                </p>
                <p className="text-[11px] text-muted-foreground">{d.daysBetween} day{d.daysBetween === 1 ? '' : 's'} ago</p>
              </div>
              <div className="flex flex-wrap gap-2 mt-2">
                {d.score.delta !== 0 && (
                  <span className={clsx('text-[11px] font-mono px-2 py-1 rounded-md', d.score.delta > 0 ? 'pill-optimal' : 'pill-critical')}>
                    Score {d.score.delta > 0 ? '+' : ''}{d.score.delta}
                  </span>
                )}
                {Math.abs(d.bioAge.delta) >= 0.1 && (
                  <span className={clsx('text-[11px] font-mono px-2 py-1 rounded-md', d.bioAge.delta < 0 ? 'pill-optimal' : 'pill-critical')}>
                    Bio age {d.bioAge.delta > 0 ? '+' : ''}{d.bioAge.delta.toFixed(1)}y
                  </span>
                )}
                {d.supplements.addedCount > 0 && (
                  <span className="text-[11px] font-mono px-2 py-1 rounded-md bg-accent/10 text-accent border border-accent/25">
                    +{d.supplements.addedCount} supp
                  </span>
                )}
                {d.supplements.removedCount > 0 && (
                  <span className="text-[11px] font-mono px-2 py-1 rounded-md bg-surface-3 text-muted-foreground border border-card-border">
                    −{d.supplements.removedCount} supp
                  </span>
                )}
                <a href="/history" className="text-[11px] text-accent hover:underline ml-auto">See full diff →</a>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ═══════════════ HERO DIAGNOSTIC ═══════════════ */}
      <div id="diagnostic" className="hero-card rounded-3xl p-8 scroll-mt-20 animate-fade-in-up relative overflow-hidden">
        <div className="flex items-start justify-between gap-4 mb-8">
          <div>
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <p className="text-[10px] uppercase tracking-[0.2em] text-muted">Longevity Protocol</p>
              {/* Visible positioning chip — makes it unambiguous that the
                  scores/bio-age/aging-pace below are lifestyle-optimization
                  targets, not clinical diagnoses. Legal footer lives at the
                  bottom; this is the version your users actually see. */}
              <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-accent/10 border border-accent/25 text-accent font-medium">
                Preventive optimization · not medical advice
              </span>
            </div>
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
                <ProgressRing value={longevityScore} size={88} stroke={7} transitionMs={1200} />
                <div className="absolute inset-0 flex items-center justify-center">
                  <AnimatedNumber value={longevityScore} duration={1500} className="text-2xl font-bold font-mono" />
                </div>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-widest text-muted">Longevity</p>
                <p className="text-sm font-medium text-foreground mt-0.5">Score</p>
                <p className="text-[11px] text-muted-foreground mt-1.5 leading-tight">{longevityScore >= 85 ? 'Top tier' : longevityScore >= 70 ? 'Above average' : longevityScore >= 55 ? 'Room to improve' : 'Needs attention'}</p>
              </div>
            </div>
            {liveDelta && Math.abs(scoreDrift) >= 1 && (
              <LiveDriftChip
                label="Live"
                direction={scoreDrift > 0 ? 'up' : 'down'}
                value={`${scoreDrift > 0 ? '+' : ''}${scoreDrift.toFixed(0)}`}
                title={`Based on new tracking data — engine estimates ${liveLongevityScore}. Refresh to lock in.`}
              />
            )}
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
            {/* Confidence chip — surfaces how much wearable/daily-log data
                fed the refinement. Prefer the LIVE signal-days count so new
                logs immediately bump "Low confidence" → "Medium confidence".
                Falls back to the diagnostic snapshot when live data is still
                loading. Thresholds match wearable-refinement.ts. */}
            {(() => {
              const d = typeof live?.wearableSignalDays === 'number'
                ? live.wearableSignalDays
                : (typeof diag?.wearableSignalDays === 'number' ? diag.wearableSignalDays : null);
              if (d === null) return null;
              const { label, tone } = d >= 25 ? { label: 'High confidence',   tone: 'text-accent bg-accent/10 border-accent/25' }
                                     : d >= 12 ? { label: 'Medium confidence', tone: 'text-amber-400 bg-amber-500/10 border-amber-500/25' }
                                     : d >= 5  ? { label: 'Low confidence',    tone: 'text-muted-foreground bg-surface-3 border-card-border' }
                                     :           { label: 'Profile-only',      tone: 'text-muted bg-surface-3/70 border-card-border' };
              return (
                <p className={clsx('mt-2 inline-flex items-center gap-1.5 text-[10px] font-mono px-2 py-0.5 rounded-full border', tone)}
                   title={d >= 5 ? `Refined using ${d} days of wearable/daily-log data` : 'No wearable data — score derived from profile + bloodwork only'}>
                  {label}{d > 0 ? ` · ${d}d` : ''}
                </p>
              );
            })()}
            {/* PhenoAge-coverage chip — how many of the 9 blood markers the
                Levine 2018 algorithm has. Sits next to the wearable-signal
                chip so the user sees what's feeding bio age at a glance. */}
            {phenoConfidence && phenoConfidence.inputsPresent > 0 && (() => {
              const tone = phenoConfidence.label === 'high'   ? 'text-accent bg-accent/10 border-accent/25'
                         : phenoConfidence.label === 'medium' ? 'text-amber-400 bg-amber-500/10 border-amber-500/25'
                         :                                       'text-muted-foreground bg-surface-3 border-card-border';
              return (
                <p className={clsx('ml-1.5 mt-2 inline-flex items-center gap-1.5 text-[10px] font-mono px-2 py-0.5 rounded-full border', tone)}
                   title={`PhenoAge uses 9 blood markers (Levine 2018). You have ${phenoConfidence.inputsPresent} — missing ones fall back to population averages.`}>
                  PhenoAge {phenoConfidence.inputsPresent}/9
                </p>
              );
            })()}
            {liveDelta && Math.abs(bioAgeDrift) >= 0.1 && (
              <LiveDriftChip
                label="Live"
                direction={bioAgeDrift < 0 ? 'up' : 'down'}   /* lower bio age = improvement */
                value={`${bioAgeDrift > 0 ? '+' : ''}${bioAgeDrift.toFixed(1)}y`}
                title={`Based on new tracking data — engine estimates ${bioAgeLabelLive}. Refresh to lock in.`}
              />
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
            {liveDelta && Math.abs(paceDrift) >= 0.02 && (
              <LiveDriftChip
                label="Live"
                direction={paceDrift < 0 ? 'up' : 'down'}      /* slower pace = improvement */
                value={`${paceDrift > 0 ? '+' : ''}${paceDrift.toFixed(2)}×`}
                title={`Based on new tracking data — engine estimates ${liveAgingPace.toFixed(2)}×. Refresh to lock in.`}
              />
            )}
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
              {(diag?.topWins || []).slice(0, 6).map((w, i) => (
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
              {(diag?.topRisks || []).slice(0, 6).map((r, i) => (
                <li key={i} className="text-sm text-foreground/90 leading-snug flex gap-2">
                  <span className="text-danger shrink-0 mt-0.5">!</span>
                  <span>{r}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* ═══ Percentile positioning — 2x2 grid of where you stand + trajectory ═══ */}
        {diag?.percentilePositioning && (diag.percentilePositioning.vsPeersOfSameAgeAndSex || diag.percentilePositioning.trajectoryIfNothingChanges) && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
            {diag.percentilePositioning.vsPeersOfSameAgeAndSex && (
              <div className="p-4 rounded-2xl bg-surface-2 border border-card-border">
                <p className="text-[10px] uppercase tracking-widest text-muted mb-2">vs peers of your age</p>
                <p className="text-sm leading-relaxed">{diag.percentilePositioning.vsPeersOfSameAgeAndSex}</p>
              </div>
            )}
            {diag.percentilePositioning.vsLongevityOptimalPopulation && (
              <div className="p-4 rounded-2xl bg-surface-2 border border-card-border">
                <p className="text-[10px] uppercase tracking-widest text-muted mb-2">vs longevity-optimal cohort</p>
                <p className="text-sm leading-relaxed">{diag.percentilePositioning.vsLongevityOptimalPopulation}</p>
              </div>
            )}
            {diag.percentilePositioning.trajectoryIfNothingChanges && (
              <div className="p-4 rounded-2xl bg-red-500/[0.04] border border-red-500/15">
                <p className="text-[10px] uppercase tracking-widest text-danger mb-2">If nothing changes (10y)</p>
                <p className="text-sm leading-relaxed text-foreground/90">{diag.percentilePositioning.trajectoryIfNothingChanges}</p>
              </div>
            )}
            {diag.percentilePositioning.trajectoryWithProtocol && (
              <div className="p-4 rounded-2xl bg-accent/[0.06] border border-accent/20">
                <p className="text-[10px] uppercase tracking-widest text-accent mb-2">If you follow this protocol (12mo)</p>
                <p className="text-sm leading-relaxed text-foreground/90">{diag.percentilePositioning.trajectoryWithProtocol}</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ═══════════════ LIFE JOURNEY — how you got here ═══════════════ */}
      {(() => {
        const lj = diag?.lifeJourney;
        if (!lj) return null;
        const decades = lj.likelyDecadeByDecade || [];
        const bets = lj.formativeLifestyleBets || [];
        const exposures = lj.cumulativeExposures || [];
        const headwinds = lj.geneticHeadwinds || [];
        const tailwinds = lj.geneticTailwinds || [];
        const citations = diag?.evidenceCitations || [];
        if (!lj.birthplaceContext && decades.length === 0 && bets.length === 0 && exposures.length === 0 && headwinds.length === 0 && tailwinds.length === 0 && citations.length === 0) return null;
        return (
          <Section id="life-journey" title="Your Life Journey" icon="🧬" subtitle="An honest reconstruction of how your biology got here — from birth, through the decades, to this lab result.">
            {lj.birthplaceContext && (
              <div className="p-4 rounded-2xl bg-surface-2 border border-card-border">
                <p className="text-[10px] uppercase tracking-widest text-accent mb-2">Birthplace & upbringing</p>
                <p className="text-sm leading-relaxed text-foreground/90">{lj.birthplaceContext}</p>
              </div>
            )}
            {decades.length > 0 && (
              <div className="space-y-2">
                <p className="text-[10px] uppercase tracking-widest text-muted">Decade by decade</p>
                {decades.map((d, i) => (
                  <div key={i} className="flex gap-3 p-3.5 rounded-xl bg-background border border-card-border">
                    <span className="text-[10px] font-mono text-accent shrink-0 mt-0.5 w-14">{d.decade}</span>
                    <p className="text-[13px] leading-relaxed text-foreground/90">{d.estimate}</p>
                  </div>
                ))}
              </div>
            )}
            {bets.length > 0 && (
              <div>
                <p className="text-[10px] uppercase tracking-widest text-muted mb-2">Formative lifestyle bets <span className="text-muted/70 normal-case">(hypotheses)</span></p>
                <ul className="space-y-1.5">
                  {bets.map((b, i) => (
                    <li key={i} className="text-sm text-foreground/85 leading-relaxed flex gap-2">
                      <span className="text-accent shrink-0 mt-0.5">→</span>
                      <span>{b}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {exposures.length > 0 && (
              <div>
                <p className="text-[10px] uppercase tracking-widest text-muted mb-2">What your body has accumulated</p>
                <ul className="space-y-1.5">
                  {exposures.map((e, i) => (
                    <li key={i} className="text-sm text-foreground/85 leading-relaxed flex gap-2">
                      <span className="text-amber-400/70 shrink-0 mt-0.5">•</span>
                      <span>{e}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {(headwinds.length > 0 || tailwinds.length > 0) && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {headwinds.length > 0 && (
                  <div className="p-4 rounded-xl bg-red-500/[0.04] border border-red-500/15">
                    <p className="text-[10px] uppercase tracking-widest text-danger mb-2">Genetic headwinds</p>
                    <ul className="space-y-1.5">
                      {headwinds.map((g, i) => (
                        <li key={i} className="text-[13px] leading-relaxed">{g}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {tailwinds.length > 0 && (
                  <div className="p-4 rounded-xl bg-accent/[0.04] border border-accent/15">
                    <p className="text-[10px] uppercase tracking-widest text-accent mb-2">Genetic tailwinds</p>
                    <ul className="space-y-1.5">
                      {tailwinds.map((g, i) => (
                        <li key={i} className="text-[13px] leading-relaxed">{g}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
            {citations.length > 0 && (
              <div className="pt-3 border-t border-card-border">
                <p className="text-[10px] uppercase tracking-widest text-muted mb-2">Evidence anchors</p>
                <ul className="space-y-1.5">
                  {citations.map((c, i) => (
                    <li key={i} className="text-[11px] leading-relaxed text-muted-foreground flex gap-2">
                      <span className="text-accent/60 shrink-0">◊</span>
                      <span>{c}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </Section>
        );
      })()}

      {/* ═══════════════ TODAY'S FOCUS ═══════════════
          Picks 1-2 high-leverage actions from the user's dailySchedule for
          the current time window. Surfaces them as urgent chips right under
          the hero so returning users see "do this now" instead of scrolling. */}
      <TodaysFocusBlock schedule={(p.dailySchedule || []) as ScheduleEntry[]} />

      {/* ═══════════════ ORGAN SYSTEMS ═══════════════ */}
      <Section id="organs" title="Organ Systems" icon="🫀" subtitle="Eight body systems scored independently. Each score blends your lifestyle inputs with matching biomarkers, then the AI surfaces what's pulling each system up + down + the highest-ROI lever.">
        {/* Radar overview */}
        {radarData.length > 0 && (
          <div
            role="img"
            aria-label={`Organ system scores: ${radarData.map(r => `${r.name} ${r.score}`).join(', ')}`}
            className="rounded-2xl bg-surface-2 border border-card-border p-4 -mx-1"
          >
            <OrganRadar data={radarData} />
          </div>
        )}

        {/* Per-system detail cards — prefer AI's richer organSystemsDetail when present, fall back to engine-derived organsDetailed */}
        {(diag?.organSystemsDetail && diag.organSystemsDetail.length > 0) ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {diag.organSystemsDetail.map((sys, idx) => {
              const scoreColor = sys.score >= 80 ? 'text-accent' : sys.score >= 60 ? 'text-foreground' : sys.score >= 40 ? 'text-warning' : 'text-danger';
              const barColor = sys.score >= 80 ? 'bg-accent' : sys.score >= 60 ? 'bg-accent/70' : sys.score >= 40 ? 'bg-warning' : 'bg-danger';
              return (
                <div key={`${sys.system}-${idx}`} className="p-4 rounded-xl bg-surface-2 border border-card-border hover:border-card-border-hover transition-colors space-y-3">
                  <div>
                    <div className="flex items-baseline justify-between gap-3 mb-1.5">
                      <p className="text-sm font-semibold capitalize">{sys.system}</p>
                      <span className={clsx('text-2xl font-bold font-mono tabular-nums', scoreColor)}>{sys.score}</span>
                    </div>
                    <div className="h-1 rounded-full bg-surface-3 overflow-hidden mb-2">
                      <div className={clsx('h-full rounded-full transition-all duration-1000', barColor)} style={{ width: `${sys.score}%` }} />
                    </div>
                    {sys.verdict && <p className="text-[11px] text-foreground/85 leading-relaxed">{sys.verdict}</p>}
                  </div>

                  {(sys.drivers || []).length > 0 && (
                    <div>
                      <p className="text-[10px] uppercase tracking-widest text-accent mb-1">Pulling it UP</p>
                      <ul className="space-y-1">
                        {sys.drivers.slice(0, 3).map((d, i) => (
                          <li key={i} className="text-[11px] text-foreground/80 leading-snug flex gap-1.5">
                            <span className="text-accent shrink-0">↑</span><span>{d}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {(sys.dragAnchors || []).length > 0 && (
                    <div>
                      <p className="text-[10px] uppercase tracking-widest text-amber-400 mb-1">Dragging it DOWN</p>
                      <ul className="space-y-1">
                        {sys.dragAnchors.slice(0, 3).map((d, i) => (
                          <li key={i} className="text-[11px] text-foreground/80 leading-snug flex gap-1.5">
                            <span className="text-amber-400 shrink-0">↓</span><span>{d}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {sys.topLever && (
                    <div className="pt-2 border-t border-card-border">
                      <p className="text-[10px] uppercase tracking-widest text-accent mb-1">Highest-ROI move (12wk)</p>
                      <p className="text-[12px] text-foreground/95 leading-snug">{sys.topLever}</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : organsDetailed.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {organsDetailed.map((sys) => {
              const scoreColor = sys.score >= 80 ? 'text-accent' : sys.score >= 60 ? 'text-foreground' : sys.score >= 40 ? 'text-warning' : 'text-danger';
              const barColor = sys.score >= 80 ? 'bg-accent' : sys.score >= 60 ? 'bg-accent/70' : sys.score >= 40 ? 'bg-warning' : 'bg-danger';
              return (
                <div key={sys.key} className="p-4 rounded-xl bg-surface-2 border border-card-border hover:border-card-border-hover transition-colors">
                  <div className="flex items-baseline justify-between gap-3 mb-1.5">
                    <div className="flex items-center gap-1.5">
                      <p className="text-sm font-semibold">{sys.label}</p>
                      {sys.estimated && <span className="text-[10px] px-1.5 py-0.5 rounded bg-surface-3 text-muted uppercase tracking-wider">est.</span>}
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
                      <p className="text-[10px] uppercase tracking-widest text-accent mb-1">Next move</p>
                      <p className="text-[11px] text-foreground/90 leading-snug">{sys.improvers[0]}</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <EmptyState message="Organ scores will populate after protocol generation." />
        )}
      </Section>

      {/* ═══════════════ YOU VS BRYAN ═══════════════ */}
      <Section id="bryan" title="You vs Bryan Johnson" icon="🏆" subtitle="Bryan runs the most documented longevity protocol on earth. Side-by-side numbers: what % younger each of you is vs chronological, plus score and aging speed.">
        {/* Side-by-side comparison card */}
        {(() => {
          const BRYAN_CHRONO = BRYAN.chronoAge;
          const BRYAN_BIO = BRYAN.bioAge;
          const BRYAN_SCORE = BRYAN.longevityScore;
          const BRYAN_PACE = BRYAN.agingPace;
          const bryanBioDeltaPct = +((BRYAN_CHRONO - BRYAN_BIO) / BRYAN_CHRONO * 100).toFixed(1);
          const bryanBioYears = Math.floor(BRYAN_BIO);
          const bryanBioMonths = Math.round((BRYAN_BIO - bryanBioYears) * 12);
          const bryanBioLabel = `${bryanBioYears}y ${bryanBioMonths}m`;

          const yourBioDeltaPct = bryanSummary?.bioAgePctDifference ?? 0;

          // Row renders one comparable metric with YOU + BRYAN side by side
          function CompareRow({ label, you, bryan, highlight }: {
            label: string;
            you: { value: React.ReactNode; tone?: 'accent' | 'danger' | 'foreground' | 'muted'; caption?: string };
            bryan: { value: React.ReactNode; caption?: string };
            highlight?: boolean;
          }) {
            const youColor = you.tone === 'accent' ? 'text-accent' : you.tone === 'danger' ? 'text-danger' : you.tone === 'muted' ? 'text-muted' : 'text-foreground';
            return (
              <div className={clsx('grid grid-cols-[1fr_auto_1fr] items-center gap-3 sm:gap-4 py-3 px-2 sm:px-4 rounded-xl transition-colors',
                highlight ? 'bg-accent/[0.04] border border-accent/15' : 'bg-surface-2 border border-card-border')}>
                <div className="text-right">
                  <p className={clsx('text-xl sm:text-2xl font-bold font-mono tabular-nums tracking-tight', youColor)}>{you.value}</p>
                  {you.caption && <p className="text-[10px] text-muted-foreground mt-0.5">{you.caption}</p>}
                </div>
                <div className="flex flex-col items-center">
                  <div className="w-px h-4 bg-card-border" />
                  <p className="text-[10px] text-muted uppercase tracking-widest py-1 shrink-0">{label}</p>
                  <div className="w-px h-4 bg-card-border" />
                </div>
                <div className="text-left">
                  <p className="text-xl sm:text-2xl font-bold font-mono tabular-nums tracking-tight text-amber-400">{bryan.value}</p>
                  {bryan.caption && <p className="text-[10px] text-muted-foreground mt-0.5">{bryan.caption}</p>}
                </div>
              </div>
            );
          }

          return (
            <div className="space-y-3">
              {/* Column headers */}
              <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 sm:gap-4 px-2 sm:px-4">
                <div className="text-right">
                  <div className="inline-flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-accent" />
                    <p className="text-xs font-semibold text-accent uppercase tracking-wider">YOU</p>
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-0.5">Chronological: {chronoAge ?? '—'}y</p>
                </div>
                <div />
                <div className="text-left">
                  <div className="inline-flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-amber-400" />
                    <p className="text-xs font-semibold text-amber-400 uppercase tracking-wider">BRYAN</p>
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-0.5">Chronological: {BRYAN_CHRONO}y</p>
                </div>
              </div>

              {/* Bio age row — the key comparison the user asked about */}
              <CompareRow
                label="Bio age"
                highlight
                you={{
                  value: bioAgeLabel,
                  tone: ageDelta !== null && ageDelta < -0.5 ? 'accent' : ageDelta !== null && ageDelta > 0.5 ? 'danger' : 'foreground',
                  caption: yourBioDeltaPct > 0
                    ? `${yourBioDeltaPct}% younger than chrono`
                    : yourBioDeltaPct < 0
                      ? `${Math.abs(yourBioDeltaPct)}% older than chrono`
                      : 'on pace with chrono',
                }}
                bryan={{
                  value: bryanBioLabel,
                  caption: `${bryanBioDeltaPct}% younger than chrono`,
                }}
              />

              {/* Longevity score row */}
              <CompareRow
                label="Score"
                you={{
                  value: longevityScore,
                  tone: longevityScore >= BRYAN_SCORE ? 'accent' : 'foreground',
                  caption: longevityScore >= BRYAN_SCORE ? 'at/above Bryan tier' : `${BRYAN_SCORE - longevityScore} pts to Bryan`,
                }}
                bryan={{
                  value: BRYAN_SCORE,
                  caption: '/ 100',
                }}
              />

              {/* Aging pace row */}
              <CompareRow
                label="Aging pace"
                you={{
                  value: `${velocity.toFixed(2)}×`,
                  tone: velocity <= BRYAN_PACE + 0.05 ? 'accent' : velocity <= 0.95 ? 'foreground' : 'danger',
                  caption: velocity <= BRYAN_PACE + 0.05 ? 'matching Bryan' : velocity <= 0.95 ? 'slower than clock' : 'faster than clock',
                }}
                bryan={{
                  value: `${BRYAN_PACE.toFixed(2)}×`,
                  caption: 'DunedinPACE',
                }}
              />
            </div>
          );
        })()}

        {bryanSummary?.verdict && (
          <div className="p-4 rounded-xl bg-gradient-to-r from-amber-500/[0.05] to-transparent border border-amber-500/15">
            <p className="text-sm text-foreground/95 leading-relaxed">{bryanSummary.verdict}</p>
          </div>
        )}

        {/* Per-biomarker gap list — richer cards with why-the-gap + close-the-gap action */}
        {p.bryanComparison && p.bryanComparison.length > 0 ? (
          <div className="space-y-2">
            <p className="text-[10px] uppercase tracking-widest text-muted mb-2">Biomarker gaps</p>
            {p.bryanComparison.map((c, i) => {
              const dir = c.gapDirection || (c.verdict.toLowerCase().includes('ahead') ? 'ahead' : 'behind');
              const isAhead = dir === 'ahead';
              const verdictTone =
                c.verdict.includes('Ahead') ? 'pill-optimal' :
                c.verdict.includes('Close') ? 'bg-blue-500/15 text-blue-400 border border-blue-500/20' :
                c.verdict.includes('Priority') ? 'pill-critical' :
                'pill-suboptimal';
              return (
                <div key={i} className="rounded-xl bg-surface-2 border border-card-border hover:border-card-border-hover transition-colors p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold">{c.marker}</span>
                        <span className={clsx('text-[10px] px-2 py-0.5 rounded-full font-medium', verdictTone)}>{c.verdict}</span>
                      </div>
                      <div className="flex items-center gap-2.5 mt-2 text-sm font-mono">
                        <span className="text-foreground">{c.yourValue}</span>
                        <span className={clsx('text-[10px]', isAhead ? 'text-accent' : 'text-amber-400/80')}>{isAhead ? '◀' : '▶'}</span>
                        <span className="text-amber-400">{c.bryanValue}</span>
                        <span className="text-[10px] text-muted ml-1">gap {Math.abs(c.gap).toFixed(1)}</span>
                      </div>
                    </div>
                  </div>
                  {(c.whyTheGapExistsForYou || c.closeTheGapAction) && (
                    <div className="mt-3 pt-3 border-t border-card-border space-y-2">
                      {c.whyTheGapExistsForYou && (
                        <div>
                          <p className="text-[10px] uppercase tracking-widest text-muted mb-1">Why this gap exists for YOU</p>
                          <p className="text-[12px] text-foreground/85 leading-relaxed">{c.whyTheGapExistsForYou}</p>
                        </div>
                      )}
                      {c.closeTheGapAction && (
                        <div>
                          <p className="text-[10px] uppercase tracking-widest text-accent mb-1">Close the gap</p>
                          <p className="text-[12px] text-foreground/90 leading-relaxed">{c.closeTheGapAction}</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
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
        {retestDue.length > 0 && (
          <div className="mb-3 p-3 rounded-xl bg-amber-500/[0.06] border border-amber-500/25 flex items-start gap-2.5">
            <span className="text-amber-400 text-sm shrink-0 mt-0.5">⏱</span>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-amber-400">
                {retestDue.length === 1 ? '1 biomarker due for retest' : `${retestDue.length} biomarkers due for retest`}
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
                {retestDue.slice(0, 3).map(r => r.shortName).join(', ')}
                {retestDue.length > 3 && ` +${retestDue.length - 3} more`} · last test {retestDue[0].weeksSinceTest}w ago
              </p>
            </div>
          </div>
        )}
        {p.biomarkerReadout && p.biomarkerReadout.length > 0 ? (
          <div className="space-y-1.5">
            {p.biomarkerReadout.map((b) => {
              const trend = biomarkerTrends.get(b.code);
              return (
              <button key={b.code} onClick={() => setExpandedBiomarker(expandedBiomarker === b.code ? null : b.code)} className="w-full text-left">
                <div className="p-4 rounded-xl bg-surface-2 border border-card-border hover:border-accent/30 transition-all">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5 flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate">{b.shortName || b.name}</p>
                      <Badge classification={b.classification} />
                    </div>
                    <div className="flex items-baseline gap-1.5 shrink-0">
                      {trend && trend.direction !== 'steady' && (
                        <span
                          className={clsx('inline-flex items-center gap-0.5 text-[10px] font-mono px-1.5 py-0.5 rounded-full border',
                            trend.improved === true ? 'text-accent bg-accent/10 border-accent/25'
                            : trend.improved === false ? 'text-danger bg-red-500/10 border-red-500/25'
                            : 'text-muted bg-surface-3 border-card-border')}
                          title={`Was ${trend.previousValue} ${b.unit} ${trend.daysBetween}d ago`}
                        >
                          {trend.direction === 'up' ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                          {trend.delta > 0 ? '+' : ''}{Math.abs(trend.delta) < 1 ? trend.delta.toFixed(1) : Math.round(trend.delta)}
                        </span>
                      )}
                      {trend?.direction === 'steady' && (
                        <span className="inline-flex items-center text-[10px] text-muted bg-surface-3 border border-card-border px-1.5 py-0.5 rounded-full" title="No meaningful change">
                          <Minus className="w-3 h-3" />
                        </span>
                      )}
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
              );
            })}
          </div>
        ) : estimatedBiomarkers.length > 0 ? (
          showEstimatedBiomarkers ? (
            <div className="space-y-1.5">
              <button
                onClick={() => setShowEstimatedBiomarkers(false)}
                className="text-xs text-muted-foreground hover:text-accent transition-colors flex items-center gap-1.5"
              >
                ← Hide estimates
              </button>
              {estimatedBiomarkers.map((e) => {
                const color = e.expectedClassification === 'likely_optimal' ? 'text-accent' : e.expectedClassification === 'likely_borderline' ? 'text-warning' : 'text-danger';
                const pillClass = e.expectedClassification === 'likely_optimal' ? 'pill-optimal' : e.expectedClassification === 'likely_borderline' ? 'pill-suboptimal' : 'pill-critical';
                return (
                  <div key={e.code} className="p-4 rounded-xl bg-surface-2 border border-card-border">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2.5 flex-1 min-w-0">
                        <p className="text-sm font-semibold truncate">{e.shortName}</p>
                        <span className={clsx('text-[10px] font-medium px-2 py-0.5 rounded-full', pillClass)}>
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
                  ⓘ These are model-based estimates, not measurements. For actual values, order a lab panel (Synevo, Regina Maria, MedLife) and upload the PDF — the protocol will auto-update.
                </p>
              </div>
            </div>
          ) : (
            <div className="p-8 rounded-2xl bg-gradient-to-br from-accent/[0.04] to-transparent border border-accent/15 text-center space-y-4">
              <div className="w-14 h-14 rounded-2xl bg-accent/10 border border-accent/25 mx-auto flex items-center justify-center">
                <span className="text-2xl">🧪</span>
              </div>
              <div>
                <p className="text-sm font-semibold">No bloodwork uploaded yet</p>
                <p className="text-xs text-muted-foreground mt-1.5 max-w-sm mx-auto leading-relaxed">
                  Upload a recent lab PDF (Synevo, Regina Maria, MedLife, LabCorp) to see your measured biomarkers and personalized analysis.
                </p>
              </div>
              <div className="flex items-center justify-center gap-2 flex-wrap">
                <a
                  href="/onboarding"
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-accent text-black text-xs font-semibold hover:bg-accent-bright transition-colors"
                >
                  📥 Upload bloodwork
                </a>
                <button
                  onClick={() => setShowEstimatedBiomarkers(true)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-surface-2 border border-card-border text-xs font-medium text-muted-foreground hover:text-accent hover:border-accent/40 transition-colors"
                >
                  Show estimated biomarkers (~) instead
                </button>
              </div>
            </div>
          )
        ) : (
          <EmptyState message="Biomarker data will appear once you upload bloodwork or complete onboarding." />
        )}
      </Section>

      {/* Nutrition */}
      <Section id="nutrition" title="Nutrition" icon="🥗" subtitle="Your daily targets, 3 personalized options per meal type, and the maximums to stay under.">
        {!p.nutrition ? <EmptyState message="Nutrition plan will generate after onboarding." allowRegenerate /> : (<>
          {/* Daily macro targets */}
          <div className="grid grid-cols-4 gap-2 sm:gap-3">
            <div className="metric-tile text-center">
              <p className="text-xl sm:text-2xl font-bold font-mono tabular-nums">{p.nutrition.dailyCalories}</p>
              <p className="text-[10px] text-muted uppercase tracking-widest mt-1">kcal/day</p>
            </div>
            <div className="metric-tile text-center">
              <p className="text-xl sm:text-2xl font-bold font-mono tabular-nums text-red-400">{p.nutrition.macros?.protein}<span className="text-xs text-muted">g</span></p>
              <p className="text-[10px] text-muted uppercase tracking-widest mt-1">Protein</p>
            </div>
            <div className="metric-tile text-center">
              <p className="text-xl sm:text-2xl font-bold font-mono tabular-nums text-blue-400">{p.nutrition.macros?.carbs}<span className="text-xs text-muted">g</span></p>
              <p className="text-[10px] text-muted uppercase tracking-widest mt-1">Carbs</p>
            </div>
            <div className="metric-tile text-center">
              <p className="text-xl sm:text-2xl font-bold font-mono tabular-nums text-amber-400">{p.nutrition.macros?.fat}<span className="text-xs text-muted">g</span></p>
              <p className="text-[10px] text-muted uppercase tracking-widest mt-1">Fats</p>
            </div>
          </div>

          {p.nutrition.eatingWindow && (
            <div className="rounded-xl bg-surface-2 border border-card-border p-3 flex items-center gap-3">
              <span className="text-lg">⏱️</span>
              <div className="text-sm"><span className="text-muted-foreground">Eating window:</span> <span className="text-accent font-mono ml-1">{p.nutrition.eatingWindow}</span></div>
            </div>
          )}

          {/* Daily MAX limits */}
          {p.nutrition.dailyMaximums && (
            <div>
              <p className="text-[10px] uppercase tracking-widest text-muted mb-2">Daily maximums + minimums</p>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                {[
                  { label: 'Sugar MAX', val: p.nutrition.dailyMaximums.sugar_g, unit: 'g', tone: 'danger' as const },
                  { label: 'Sodium MAX', val: p.nutrition.dailyMaximums.sodium_mg, unit: 'mg', tone: 'danger' as const },
                  { label: 'Sat fat MAX', val: p.nutrition.dailyMaximums.saturatedFat_g, unit: 'g', tone: 'warning' as const },
                  { label: 'Fiber MIN', val: p.nutrition.dailyMaximums.fiber_g_min, unit: 'g', tone: 'accent' as const },
                  { label: 'Water MIN', val: p.nutrition.dailyMaximums.water_ml_min, unit: 'ml', tone: 'accent' as const },
                ].map(({ label, val, unit, tone }) => val !== undefined && (
                  <div key={label} className="rounded-xl bg-surface-2 border border-card-border p-3 text-center">
                    <p className="text-[10px] uppercase tracking-widest text-muted">{label}</p>
                    <p className={clsx('text-lg font-bold font-mono tabular-nums mt-1', tone === 'danger' ? 'text-danger' : tone === 'warning' ? 'text-warning' : 'text-accent')}>
                      {val}<span className="text-[10px] text-muted ml-0.5">{unit}</span>
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Meal options × 3 per type */}
          {p.nutrition.mealOptions && (
            <div className="space-y-4">
              {([
                { key: 'breakfast', label: '🌅 Breakfast', items: p.nutrition.mealOptions.breakfast },
                { key: 'lunch',     label: '☀️ Lunch',     items: p.nutrition.mealOptions.lunch },
                { key: 'dinner',    label: '🌙 Dinner',    items: p.nutrition.mealOptions.dinner },
                { key: 'snacks',    label: '🥜 Snacks',    items: p.nutrition.mealOptions.snacks },
              ] as const).map(group => (
                group.items && group.items.length > 0 && (
                  <div key={group.key}>
                    <p className="text-xs font-semibold text-accent uppercase tracking-wider mb-2 flex items-center gap-2">
                      {group.label}
                      <span className="text-[10px] text-muted normal-case font-normal tracking-normal">— pick one, swap freely</span>
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
                      {group.items.map((opt, i) => (
                        <div key={i} className="p-3.5 rounded-xl bg-surface-2 border border-card-border hover:border-accent/30 transition-colors">
                          <div className="flex items-baseline justify-between gap-2 mb-1.5">
                            <p className="text-sm font-semibold leading-tight">{opt.name}</p>
                            <span className="text-[10px] font-mono text-accent shrink-0">{opt.calories} kcal</span>
                          </div>
                          <p className="text-[11px] text-muted-foreground leading-snug mb-2.5">{opt.description}</p>
                          {/* Macro chips */}
                          <div className="flex flex-wrap gap-1 mb-2">
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/10 text-red-400 font-mono">P {opt.protein_g}g</span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 font-mono">C {opt.carbs_g}g</span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 font-mono">F {opt.fat_g}g</span>
                            {opt.fiber_g !== undefined && <span className="text-[10px] px-1.5 py-0.5 rounded bg-accent/10 text-accent font-mono">Fiber {opt.fiber_g}g</span>}
                            {opt.sugar_g !== undefined && <span className="text-[10px] px-1.5 py-0.5 rounded bg-surface-3 text-muted-foreground font-mono">Sugar {opt.sugar_g}g</span>}
                            {opt.sodium_mg !== undefined && <span className="text-[10px] px-1.5 py-0.5 rounded bg-surface-3 text-muted-foreground font-mono">Na {opt.sodium_mg}mg</span>}
                          </div>
                          {opt.ingredients && opt.ingredients.length > 0 && (
                            <p className="text-[10px] text-muted-foreground leading-snug pt-2 border-t border-card-border">
                              <span className="text-muted">Ingredients:</span> {opt.ingredients.join(' · ')}
                            </p>
                          )}
                          {opt.whyForYou && (
                            <p className="text-[10px] text-accent/90 mt-1.5 leading-snug">→ {opt.whyForYou}</p>
                          )}
                          {opt.prepMinutes !== undefined && (
                            <p className="text-[10px] text-muted mt-1">⏱️ {opt.prepMinutes} min prep</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )
              ))}
            </div>
          )}

          {/* General eating recommendations */}
          {p.nutrition.generalRecommendations && p.nutrition.generalRecommendations.length > 0 && (
            <div className="rounded-xl bg-gradient-to-br from-accent/[0.04] to-transparent border border-accent/15 p-4">
              <p className="text-xs font-semibold text-accent uppercase tracking-wider mb-3">🍽️ How to eat for results</p>
              <ul className="space-y-1.5">
                {p.nutrition.generalRecommendations.map((rec, i) => (
                  <li key={i} className="text-sm text-foreground/90 flex gap-2 leading-snug">
                    <span className="text-accent shrink-0 mt-0.5">·</span><span>{rec}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {p.nutrition.foodsToAdd && p.nutrition.foodsToAdd.length > 0 && (
            <div className="rounded-xl bg-surface-2 border border-card-border p-4">
              <p className="text-xs font-semibold text-accent uppercase tracking-wider mb-2">+ Add more of these</p>
              <ul className="space-y-1">
                {p.nutrition.foodsToAdd.map((f, i) => <li key={i} className="text-xs text-muted-foreground">· <span className="text-foreground font-medium">{f.food}</span> — {f.why}</li>)}
              </ul>
            </div>
          )}
          {p.nutrition.foodsToReduce && p.nutrition.foodsToReduce.length > 0 && (
            <div className="rounded-xl bg-red-500/[0.04] border border-red-500/15 p-4">
              <p className="text-xs font-semibold text-danger uppercase tracking-wider mb-2">− Reduce or cut these</p>
              <ul className="space-y-1">
                {p.nutrition.foodsToReduce.map((f, i) => <li key={i} className="text-xs text-muted-foreground">· <span className="text-foreground font-medium">{f.food}</span> — {f.why}</li>)}
              </ul>
            </div>
          )}
        </>)}
      </Section>

      {/* Supplements timeline */}
      <Section id="supplements" title="Supplements" icon="💊" subtitle="Your stack with exact timing, how to take each one, and what's already in your routine kept intact.">
        {(!p.supplements || p.supplements.length === 0) ? <EmptyState message="Supplement stack will be generated based on your biomarkers." allowRegenerate /> : (<>
          {/* Header stats */}
          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            <div className="metric-tile text-center">
              <p className="text-xl font-bold font-mono tabular-nums">{p.supplements.length}</p>
              <p className="text-[10px] text-muted uppercase tracking-widest mt-1">In stack</p>
            </div>
            <div className="metric-tile text-center">
              <p className="text-xl font-bold font-mono tabular-nums text-accent">{p.supplements.filter(s => s.alreadyTaking).length}</p>
              <p className="text-[10px] text-muted uppercase tracking-widest mt-1">You take</p>
            </div>
            <div className="metric-tile text-center">
              <p className="text-xl font-bold font-mono tabular-nums text-accent">{totalSupCost}<span className="text-xs text-muted ml-1">RON/mo</span></p>
              <p className="text-[10px] text-muted uppercase tracking-widest mt-1">Est. cost</p>
            </div>
          </div>

          {/* Timing buckets — uses AI's timeOfDay field with robust fallback inference from timing text */}
          {(() => {
            // Order buckets chronologically so the user scans top→bottom through their day
            const BUCKETS = ['morning', 'lunch', 'afternoon', 'evening', 'bedtime'] as const;
            const LABELS: Record<string, { title: string; sub: string }> = {
              morning:   { title: '🌅 Morning',   sub: 'Start of day. Activating supplements + fat-soluble vitamins with breakfast.' },
              lunch:     { title: '🍽️ Lunch',     sub: 'Midday — with food. Things that need separation from AM iron/calcium or that irritate empty stomach.' },
              afternoon: { title: '☀️ Afternoon', sub: 'Pre-workout stimulants, afternoon-only compounds (NAC, collagen).' },
              evening:   { title: '🌆 Evening',   sub: 'Dinner stack. Fat-soluble like Omega-3 with the fattiest meal.' },
              bedtime:   { title: '🌙 Bedtime',   sub: 'Sleep-supporting. Magnesium glycinate, L-theanine, glycine.' },
            };

            // Infer a bucket from vague timing strings when AI didn't populate timeOfDay
            const inferBucket = (s: { timing?: string; timeOfDay?: string }): typeof BUCKETS[number] => {
              if (s.timeOfDay && (BUCKETS as readonly string[]).includes(s.timeOfDay)) return s.timeOfDay as typeof BUCKETS[number];
              const t = (s.timing || '').toLowerCase();
              // Clock time parsing: HH:MM → bucket
              const m = t.match(/(\d{1,2}):(\d{2})/);
              if (m) {
                const hr = parseInt(m[1], 10);
                if (hr >= 5  && hr < 11) return 'morning';
                if (hr >= 11 && hr < 14) return 'lunch';
                if (hr >= 14 && hr < 17) return 'afternoon';
                if (hr >= 17 && hr < 21) return 'evening';
                return 'bedtime';
              }
              if (/morning|breakfast|a\.m|am\b|wake|early/.test(t)) return 'morning';
              if (/lunch|noon|mid[- ]?day/.test(t)) return 'lunch';
              if (/afternoon|pre[- ]?workout|post[- ]?workout/.test(t)) return 'afternoon';
              if (/bedtime|sleep|night|before bed|21:|22:|23:/.test(t)) return 'bedtime';
              if (/evening|dinner|p\.m|pm\b/.test(t)) return 'evening';
              // Sensible default — morning w/ food
              return 'morning';
            };

            const grouped: Record<string, typeof p.supplements> = { morning: [], lunch: [], afternoon: [], evening: [], bedtime: [] };
            for (const s of p.supplements) grouped[inferBucket(s)].push(s);

            return BUCKETS.filter(bk => grouped[bk].length > 0).map(bk => {
              const meta = LABELS[bk];
              const items = grouped[bk];
              return (
                <div key={bk}>
                  <div className="flex items-baseline justify-between gap-2 mb-2">
                    <p className="text-[11px] font-semibold text-accent uppercase tracking-widest">{meta.title}</p>
                    <span className="text-[10px] text-muted font-mono">{items.length} item{items.length === 1 ? '' : 's'}</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground mb-2 leading-snug">{meta.sub}</p>
                  <div className="space-y-2">
                    {items.map((s, i) => (
                      <div key={i} className={clsx('p-4 rounded-xl border transition-colors',
                        s.priority === 'MUST' ? 'bg-accent/[0.04] border-accent/25' :
                        s.priority === 'STRONG' ? 'bg-blue-500/[0.04] border-blue-500/20' :
                        'bg-surface-2 border-card-border')}>
                        <div className="flex items-start justify-between gap-3 mb-1">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="text-sm font-semibold leading-tight">{s.name}</p>
                              {s.alreadyTaking && (
                                <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-accent/15 text-accent border border-accent/30 font-medium">
                                  ✓ in your stack
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-muted-foreground mt-0.5">
                              <span className="font-mono">{s.dose}</span>
                              {s.form && <> · {s.form}</>}
                              {s.timing && <> · <span className="text-accent/80 font-mono">{s.timing}</span></>}
                              {s.anchorMeal && s.anchorMeal !== 'none (empty stomach)' && <> · <span className="text-muted">with {s.anchorMeal}</span></>}
                              {s.anchorMeal === 'none (empty stomach)' && <> · <span className="text-amber-400/80">empty stomach</span></>}
                            </p>
                          </div>
                          <span className={clsx('text-[10px] font-mono px-2 py-0.5 rounded-full shrink-0',
                            s.priority === 'MUST' ? 'pill-optimal' :
                            s.priority === 'STRONG' ? 'bg-blue-500/15 text-blue-400 border border-blue-500/25' :
                            'bg-surface-3 text-muted border border-card-border')}>
                            {s.priority}
                          </span>
                        </div>

                        {s.howToTake && (
                          <div className="mt-2 p-2.5 rounded-lg bg-surface-3 border border-card-border">
                            <p className="text-[10px] uppercase tracking-widest text-muted mb-1">How to take</p>
                            <p className="text-xs text-foreground/95 leading-relaxed">{s.howToTake}</p>
                          </div>
                        )}

                        {s.whyThisTime && (
                          <div className="mt-2 flex gap-2 items-start">
                            <span className="text-[10px] text-accent/80 shrink-0 mt-0.5">⏱</span>
                            <p className="text-[11px] text-foreground/85 leading-relaxed italic">{s.whyThisTime}</p>
                          </div>
                        )}

                        <p className="text-[11px] text-muted-foreground mt-2 leading-relaxed">{s.justification}</p>

                        {s.stackWithOthers && s.stackWithOthers.length > 0 && (
                          <p className="text-[10px] text-accent/80 mt-1.5">⊕ Take together with: {s.stackWithOthers.join(', ')}</p>
                        )}

                        {s.interactions && s.interactions.length > 0 && (
                          <p className="text-[10px] text-warning mt-1.5">⚠️ {s.interactions.join(' · ')}</p>
                        )}
                        {s.warnings && (
                          <p className="text-[10px] text-danger mt-1">⚠️ {s.warnings}</p>
                        )}

                        {s.startWeek && s.startWeek > 1 && (
                          <p className="text-[10px] text-amber-400 mt-1.5">Start in week {s.startWeek}</p>
                        )}

                        <div className="flex items-center justify-between mt-2 pt-2 border-t border-card-border">
                          <a
                            href={`https://www.emag.ro/search/${encodeURIComponent(s.emagSearchQuery || s.name + ' ' + (s.form || ''))}`}
                            target="_blank" rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-[11px] text-accent hover:underline"
                          >
                            🛒 Find on eMAG
                          </a>
                          {s.monthlyCostRon > 0 && (
                            <span className="text-[10px] text-muted font-mono">~{s.monthlyCostRon} RON/mo</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            });
          })()}

          {/* Universal how-to-take rules */}
          {p.supplementsHowTo && p.supplementsHowTo.length > 0 && (
            <div className="rounded-xl bg-gradient-to-br from-accent/[0.04] to-transparent border border-accent/15 p-4">
              <p className="text-xs font-semibold text-accent uppercase tracking-wider mb-3">💊 Universal supplement rules</p>
              <ul className="space-y-1.5">
                {p.supplementsHowTo.map((rule, i) => (
                  <li key={i} className="text-sm text-foreground/90 flex gap-2 leading-snug">
                    <span className="text-accent shrink-0 mt-0.5">·</span><span>{rule}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>)}
      </Section>

      {/* Daily Schedule — grouped by time-of-day phase for easy scanning */}
      <Section id="schedule" title="Daily Schedule" icon="⏰" subtitle="Every action of your day at its exact time. Wake → supplements → meals → exercise → wind-down → bedtime. Each item links back to why.">
        {(!p.dailySchedule || p.dailySchedule.length === 0) ? <EmptyState message="Daily timeline will appear once your protocol generates." allowRegenerate /> : (() => {
          // Split entries into phases so the user sees a cohesive day, not a flat list
          const PHASES = [
            { key: 'morning',   label: '🌅 Morning',      range: [5, 11] },
            { key: 'work',      label: '💼 Daytime',      range: [11, 15] },
            { key: 'afternoon', label: '☀️ Afternoon',    range: [15, 18] },
            { key: 'evening',   label: '🌆 Evening',      range: [18, 21] },
            { key: 'bedtime',   label: '🌙 Wind-down + bed', range: [21, 29] },  // 29 = 5am next day
          ] as const;

          const getHour = (time: string): number => {
            const m = time.match(/(\d{2}):(\d{2})/);
            if (!m) return 0;
            const h = parseInt(m[1], 10);
            return h < 5 ? h + 24 : h;  // treat early AM as part of previous bedtime
          };
          const phaseOf = (time: string) => {
            const h = getHour(time);
            return PHASES.find(p => h >= p.range[0] && h < p.range[1]) || PHASES[0];
          };

          // Border classes are FULL static literals — Tailwind JIT doesn't scan
          // string concatenation, so `'border-' + name` would silently miss compilation.
          const colorFor = (cat: string) =>
            cat === 'sleep' || cat === 'wind-down'         ? { text: 'text-blue-400',   bar: 'bg-blue-400/30',   bg: 'bg-blue-500/[0.03]', dot: 'bg-blue-400',   border: 'border-blue-400/20' }
            : cat === 'exercise'                           ? { text: 'text-amber-400',  bar: 'bg-amber-400/30',  bg: 'bg-amber-500/[0.04]', dot: 'bg-amber-400',  border: 'border-amber-400/20' }
            : cat === 'meal' || cat === 'snack'            ? { text: 'text-orange-400', bar: 'bg-orange-400/30', bg: 'bg-orange-500/[0.03]', dot: 'bg-orange-400', border: 'border-orange-400/20' }
            : cat === 'supplements'                        ? { text: 'text-purple-400', bar: 'bg-purple-400/30', bg: 'bg-purple-500/[0.03]', dot: 'bg-purple-400', border: 'border-purple-400/20' }
            : cat === 'hydration'                          ? { text: 'text-cyan-400',   bar: 'bg-cyan-400/30',   bg: 'bg-cyan-500/[0.03]', dot: 'bg-cyan-400',   border: 'border-cyan-400/20' }
            : cat === 'movement-break'                     ? { text: 'text-lime-400',   bar: 'bg-lime-400/30',   bg: 'bg-lime-500/[0.03]', dot: 'bg-lime-400',   border: 'border-lime-400/20' }
            : cat === 'work' || cat === 'school'           ? { text: 'text-foreground', bar: 'bg-card-border',   bg: 'bg-surface-2', dot: 'bg-foreground/50',     border: 'border-card-border' }
            : cat === 'mindset'                            ? { text: 'text-pink-400',   bar: 'bg-pink-400/30',   bg: 'bg-pink-500/[0.03]', dot: 'bg-pink-400',   border: 'border-pink-400/20' }
            :                                                { text: 'text-accent',     bar: 'bg-accent/30',     bg: 'bg-accent/[0.03]', dot: 'bg-accent',       border: 'border-accent/25' };

          const iconFor = (cat: string) =>
            cat === 'sleep'          ? '🛏️' :
            cat === 'wind-down'      ? '🌙' :
            cat === 'wake'           ? '☀️' :
            cat === 'exercise'       ? '🏋️' :
            cat === 'meal'           ? '🍽️' :
            cat === 'snack'          ? '🥜' :
            cat === 'supplements'    ? '💊' :
            cat === 'hydration'      ? '💧' :
            cat === 'movement-break' ? '🚶' :
            cat === 'work'           ? '💼' :
            cat === 'school'         ? '🎓' :
            cat === 'mindset'        ? '🧘' :
                                       '·';

          // Group entries into phases, preserving chronological order within each
          const grouped: Record<string, typeof p.dailySchedule> = {};
          for (const entry of p.dailySchedule!) {
            const ph = phaseOf(entry.time);
            (grouped[ph.key] ||= []).push(entry);
          }

          const totalEntries = p.dailySchedule!.length;

          return (
            <div className="space-y-5">
              <p className="text-[11px] text-muted-foreground">{totalEntries} actions today · tap an entry for its mechanism</p>

              {PHASES.filter(ph => (grouped[ph.key] || []).length > 0).map(ph => (
                <div key={ph.key} className="space-y-1.5">
                  <p className="text-[11px] font-semibold text-accent uppercase tracking-widest sticky bg-background/90 backdrop-blur-sm py-1 z-10" style={{ top: 'var(--header-h, 3.5rem)' }}>
                    {ph.label}
                  </p>
                  {(grouped[ph.key] || []).map((item, i) => {
                    const isBlock = item.isBlock || item.category === 'work' || item.category === 'school' || item.category === 'exercise';
                    const c = colorFor(item.category);

                    if (isBlock) {
                      return (
                        <div key={i} className={clsx('flex items-center gap-3 p-3.5 rounded-xl border', c.bg, c.border)}>
                          <div className="flex items-center justify-center w-11 h-11 rounded-xl bg-surface-3 border border-card-border shrink-0">
                            <span className="text-lg">{iconFor(item.category)}</span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold">{item.activity}</p>
                            <p className={clsx('text-xs font-mono mt-0.5', c.text)}>{item.time}{item.duration && ` · ${item.duration}`}</p>
                            {item.notes && <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">{item.notes}</p>}
                          </div>
                        </div>
                      );
                    }

                    return (
                      <div key={i} className="flex items-start gap-3 px-3 py-2.5 rounded-xl hover:bg-surface-2 transition-colors group">
                        <span className={clsx('text-xs font-mono w-12 shrink-0 pt-0.5 font-medium', c.text)}>{item.time}</span>
                        <div className={clsx('relative w-1 self-stretch shrink-0 rounded-full', c.bar)}>
                          <span className={clsx('absolute -left-1 top-1 w-3 h-3 rounded-full border-2 border-background', c.dot)} />
                        </div>
                        <div className="flex-1 min-w-0 pt-0.5">
                          <div className="flex items-start gap-2">
                            <span className="text-sm shrink-0">{iconFor(item.category)}</span>
                            <p className="text-sm leading-snug flex-1">{item.activity}</p>
                          </div>
                          {(item.duration || item.notes) && (
                            <p className="text-[11px] text-muted mt-1 ml-6">
                              {item.duration && <span>{item.duration}</span>}
                              {item.duration && item.notes && <span> · </span>}
                              {item.notes && <span className="text-muted-foreground">{item.notes}</span>}
                            </p>
                          )}
                          {item.anchorRef && (
                            <a href="#supplements" className="inline-block mt-1 ml-6 text-[10px] text-accent hover:underline">→ {item.anchorRef} card</a>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          );
        })()}
      </Section>

      {/* Exercise */}
      <Section id="exercise" title="Exercise" icon="🏋️" subtitle={p.exercise?.gymAccess ? `Tailored for ${p.exercise.gymAccess === 'gym' ? 'gym access' : p.exercise.gymAccess === 'home' ? 'home / minimal equipment' : 'no equipment'} — adjust based on what you have today.` : 'Personalized weekly plan with exercise rules to follow.'}>
        {!p.exercise ? <EmptyState message="Exercise plan will generate based on your activity level and goals." /> : (<>
          {/* Top stats */}
          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            <div className="metric-tile text-center">
              <p className="text-xl font-bold font-mono tabular-nums text-accent">{p.exercise.zone2Target}<span className="text-xs text-muted ml-1">min</span></p>
              <p className="text-[10px] text-muted uppercase tracking-widest mt-1">Zone 2 / week</p>
            </div>
            <div className="metric-tile text-center">
              <p className="text-xl font-bold font-mono tabular-nums text-accent">{p.exercise.strengthSessions}<span className="text-xs text-muted ml-1">×</span></p>
              <p className="text-[10px] text-muted uppercase tracking-widest mt-1">Strength / week</p>
            </div>
            <div className="metric-tile text-center">
              <p className="text-xl font-bold font-mono tabular-nums text-accent">{p.exercise.dailyStepsTarget?.toLocaleString() ?? '8,000'}</p>
              <p className="text-[10px] text-muted uppercase tracking-widest mt-1">Steps / day</p>
            </div>
          </div>

          {/* Weekly plan */}
          {(p.exercise.weeklyPlan || []).length > 0 && (
            <div className="space-y-2">
              <p className="text-[11px] font-semibold text-accent uppercase tracking-widest">Weekly plan</p>
              <div className="space-y-2">
                {(p.exercise.weeklyPlan || []).map((d, i) => {
                  const isRest = d.intensity?.toLowerCase().includes('rest') || d.intensity?.toLowerCase().includes('recovery');
                  return (
                    <div key={i} className={clsx('p-3.5 rounded-xl border', isRest ? 'bg-surface-2 border-card-border' : 'bg-accent/[0.04] border-accent/20')}>
                      <div className="flex items-baseline justify-between gap-3 mb-1">
                        <p className="text-sm font-semibold">{d.day} <span className="text-muted-foreground font-normal text-xs">· {d.activity}</span></p>
                        <div className="flex items-center gap-2 text-[10px] font-mono shrink-0">
                          <span className={clsx('px-2 py-0.5 rounded-full',
                            isRest ? 'bg-surface-3 text-muted' :
                            d.intensity?.toLowerCase().includes('high') || d.intensity?.toLowerCase().includes('hiit') ? 'bg-red-500/15 text-red-400' :
                            d.intensity?.toLowerCase().includes('zone 2') ? 'bg-blue-500/15 text-blue-400' :
                            'bg-accent/15 text-accent')}>{d.intensity}</span>
                          <span className="text-muted">{d.duration}</span>
                        </div>
                      </div>
                      {d.exercises && d.exercises.length > 0 && (
                        <ul className="space-y-0.5 mt-1.5">
                          {d.exercises.map((ex, j) => (
                            <li key={j} className="text-[11px] text-muted-foreground flex gap-1.5 leading-snug">
                              <span className="text-muted">·</span><span>{ex}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                      {d.notes && <p className="text-[10px] text-muted-foreground mt-1.5 italic">{d.notes}</p>}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Warmup + cooldown */}
          {(p.exercise.warmupRoutine || p.exercise.cooldownRoutine) && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {p.exercise.warmupRoutine && p.exercise.warmupRoutine.length > 0 && (
                <div className="rounded-xl bg-surface-2 border border-card-border p-4">
                  <p className="text-[11px] font-semibold text-accent uppercase tracking-widest mb-2">🔥 Warm-up (5 min)</p>
                  <ul className="space-y-1">
                    {p.exercise.warmupRoutine.map((w, i) => <li key={i} className="text-xs text-muted-foreground flex gap-2"><span className="text-muted">·</span>{w}</li>)}
                  </ul>
                </div>
              )}
              {p.exercise.cooldownRoutine && p.exercise.cooldownRoutine.length > 0 && (
                <div className="rounded-xl bg-surface-2 border border-card-border p-4">
                  <p className="text-[11px] font-semibold text-accent uppercase tracking-widest mb-2">🧘 Cool-down (5 min)</p>
                  <ul className="space-y-1">
                    {p.exercise.cooldownRoutine.map((c, i) => <li key={i} className="text-xs text-muted-foreground flex gap-2"><span className="text-muted">·</span>{c}</li>)}
                  </ul>
                </div>
              )}
            </div>
          )}

          {p.exercise.progressionNotes && (
            <div className="rounded-xl bg-surface-2 border border-card-border p-3">
              <p className="text-[10px] uppercase tracking-widest text-muted mb-1">12-week progression</p>
              <p className="text-xs text-foreground/90 leading-relaxed">{p.exercise.progressionNotes}</p>
            </div>
          )}

          {/* General exercise recommendations */}
          {p.exercise.generalRecommendations && p.exercise.generalRecommendations.length > 0 && (
            <div className="rounded-xl bg-gradient-to-br from-accent/[0.04] to-transparent border border-accent/15 p-4">
              <p className="text-xs font-semibold text-accent uppercase tracking-wider mb-3">💪 How to train for results</p>
              <ul className="space-y-1.5">
                {p.exercise.generalRecommendations.map((rec, i) => (
                  <li key={i} className="text-sm text-foreground/90 flex gap-2 leading-snug">
                    <span className="text-accent shrink-0 mt-0.5">·</span><span>{rec}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>)}
      </Section>

      {/* Sleep */}
      <Section id="sleep" title="Sleep" icon="🌙" subtitle="Your ideal bedtime + wake window, full bedroom checklist, and the rules that make sleep actually restorative.">
        {!p.sleep ? <EmptyState message="Sleep protocol will be calibrated to your chronotype and schedule." /> : (<>
          {/* Big bedtime → wake window */}
          <div className="rounded-2xl bg-gradient-to-br from-blue-500/[0.06] via-accent/[0.03] to-transparent border border-card-border p-5">
            <div className="grid grid-cols-3 items-center gap-3">
              <div className="text-center">
                <p className="text-[10px] uppercase tracking-widest text-muted mb-1">Bedtime</p>
                <p className="text-3xl font-bold font-mono tabular-nums text-blue-400">{p.sleep.targetBedtime}</p>
                {p.sleep.idealBedtime && p.sleep.idealBedtime !== p.sleep.targetBedtime && (
                  <p className="text-[10px] text-muted mt-1">you said: {p.sleep.idealBedtime}</p>
                )}
              </div>
              <div className="flex flex-col items-center text-center">
                <div className="text-2xl">→</div>
                {p.sleep.targetDuration && <p className="text-xs text-accent font-mono mt-1">{p.sleep.targetDuration}</p>}
              </div>
              <div className="text-center">
                <p className="text-[10px] uppercase tracking-widest text-muted mb-1">Wake</p>
                <p className="text-3xl font-bold font-mono tabular-nums text-amber-400">{p.sleep.targetWakeTime || '—'}</p>
                {p.sleep.idealWakeTime && p.sleep.idealWakeTime !== p.sleep.targetWakeTime && (
                  <p className="text-[10px] text-muted mt-1">you said: {p.sleep.idealWakeTime}</p>
                )}
              </div>
            </div>
            {p.sleep.morningLightMinutes && (
              <p className="text-[11px] text-muted-foreground text-center mt-4">
                Get <span className="text-accent font-mono">{p.sleep.morningLightMinutes} min</span> of direct sunlight within 30 min of waking
              </p>
            )}
          </div>

          {/* Bedroom checklist */}
          {p.sleep.bedroomChecklist && p.sleep.bedroomChecklist.length > 0 && (
            <div>
              <p className="text-[11px] font-semibold text-accent uppercase tracking-widest mb-2">🛏️ Bedroom setup</p>
              <div className="space-y-2">
                {p.sleep.bedroomChecklist.map((b, i) => (
                  <div key={i} className="flex items-start gap-3 p-3 rounded-xl bg-surface-2 border border-card-border">
                    <span className="text-accent text-sm shrink-0 mt-0.5">✓</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium leading-snug">{b.item}</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">{b.why}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Wind-down routine */}
          {p.sleep.windDownRoutine && p.sleep.windDownRoutine.length > 0 && (
            <div>
              <p className="text-[11px] font-semibold text-accent uppercase tracking-widest mb-2">🕯️ Wind-down (last 90 min)</p>
              <div className="space-y-1.5">
                {p.sleep.windDownRoutine.map((s, i) => (
                  <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-surface-2 border border-card-border">
                    <span className="text-xs font-mono text-accent w-12 shrink-0">{typeof s === 'string' ? '·' : s.time}</span>
                    <span className="text-sm">{typeof s === 'string' ? s : s.action}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Morning routine */}
          {p.sleep.morningRoutine && p.sleep.morningRoutine.length > 0 && (
            <div>
              <p className="text-[11px] font-semibold text-accent uppercase tracking-widest mb-2">🌅 First 30 min after waking</p>
              <ul className="space-y-1">
                {p.sleep.morningRoutine.map((m, i) => (
                  <li key={i} className="text-sm text-muted-foreground flex gap-2 p-2 rounded-lg"><span className="text-accent shrink-0">·</span><span>{m}</span></li>
                ))}
              </ul>
            </div>
          )}

          {/* Caffeine reminder */}
          {p.sleep.caffeineLimit && (
            <div className="rounded-xl bg-amber-500/[0.04] border border-amber-500/20 p-3 flex items-start gap-3">
              <span className="text-lg shrink-0">☕</span>
              <p className="text-xs text-foreground/90 leading-relaxed">{p.sleep.caffeineLimit}</p>
            </div>
          )}

          {/* General sleep hygiene rules */}
          {p.sleep.generalRecommendations && p.sleep.generalRecommendations.length > 0 && (
            <div className="rounded-xl bg-gradient-to-br from-accent/[0.04] to-transparent border border-accent/15 p-4">
              <p className="text-xs font-semibold text-accent uppercase tracking-wider mb-3">😴 Sleep hygiene rules</p>
              <ul className="space-y-1.5">
                {p.sleep.generalRecommendations.map((rec, i) => (
                  <li key={i} className="text-sm text-foreground/90 flex gap-2 leading-snug">
                    <span className="text-accent shrink-0 mt-0.5">·</span><span>{rec}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Sleep supplements (if recommended) */}
          {p.sleep.supplementsForSleep && p.sleep.supplementsForSleep.length > 0 && (
            <div className="rounded-xl bg-surface-2 border border-card-border p-3">
              <p className="text-[10px] uppercase tracking-widest text-muted mb-1.5">Sleep-specific supplements</p>
              <ul className="space-y-0.5">
                {p.sleep.supplementsForSleep.map((s, i) => <li key={i} className="text-xs text-foreground/90">· {s}</li>)}
              </ul>
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
                  <span className={clsx('text-[10px] px-1.5 py-0.5 rounded shrink-0 mt-0.5',
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
      <Section id="painpoints" title="Your Pain Points" icon="🎯" subtitle="The specific issues you told us about — likely cause, exact fix, and realistic timeline.">
        {(!p.painPointSolutions || p.painPointSolutions.length === 0) ? <EmptyState message="Describe your pain points in onboarding to get personalized solutions." /> : (
          <div className="space-y-3">
            {p.painPointSolutions.map((pp, i) => (
              <div key={i} className="p-5 rounded-2xl bg-gradient-to-br from-accent/[0.04] to-transparent border border-accent/15 space-y-4">
                {/* Problem header */}
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-accent/15 border border-accent/25 flex items-center justify-center shrink-0">
                    <span className="text-accent text-sm">⚡</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] uppercase tracking-widest text-accent">Problem</p>
                    <p className="text-sm font-semibold text-foreground leading-snug mt-0.5">{pp.problem}</p>
                  </div>
                </div>

                {/* 3-row breakdown */}
                <div className="space-y-2 pl-11">
                  <div className="p-3 rounded-xl bg-amber-500/[0.04] border border-amber-500/15">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                      <p className="text-[10px] uppercase tracking-widest text-amber-400 font-semibold">Likely cause</p>
                    </div>
                    <p className="text-xs text-foreground/90 leading-relaxed">{pp.likelyCause}</p>
                  </div>

                  <div className="p-3 rounded-xl bg-accent/[0.04] border border-accent/20">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-accent" />
                      <p className="text-[10px] uppercase tracking-widest text-accent font-semibold">The fix</p>
                    </div>
                    <p className="text-xs text-foreground/90 leading-relaxed">{pp.solution}</p>
                  </div>

                  <div className="flex items-center gap-3 px-3 py-2 rounded-xl bg-surface-2 border border-card-border">
                    <span className="text-sm shrink-0">⏱</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] uppercase tracking-widest text-muted">Expected timeline</p>
                      <p className="text-xs text-foreground/90 mt-0.5">{pp.expectedTimeline}</p>
                    </div>
                  </div>

                  {pp.supportingBiomarkers && pp.supportingBiomarkers.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      <span className="text-[10px] text-muted">Track via:</span>
                      {pp.supportingBiomarkers.map(bm => (
                        <span key={bm} className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-surface-3 text-muted-foreground border border-card-border">
                          {bm}
                        </span>
                      ))}
                    </div>
                  )}

                  {pp.checkpoints && pp.checkpoints.length > 0 && (
                    <div className="pt-2 border-t border-card-border">
                      <p className="text-[10px] uppercase tracking-widest text-muted mb-1.5">Weekly check-ins</p>
                      <ul className="space-y-0.5">
                        {pp.checkpoints.map((c, j) => (
                          <li key={j} className="text-[11px] text-muted-foreground flex gap-1.5"><span className="text-muted">·</span>{c}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* Flex Rules */}
      <Section id="flex" title="Flex Strategies" icon="🧘" subtitle="Life strategies for your non-negotiables — so pizza night, morning coffee, and weekend drinks don't derail the protocol.">
        {(!p.flexRules || p.flexRules.length === 0) ? <EmptyState message="Describe your non-negotiables in onboarding (pizza nights, morning coffee, etc.) and we'll build workarounds that keep the protocol intact." /> : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {p.flexRules.map((f, i) => (
              <div key={i} className="p-4 rounded-2xl bg-surface-2 border border-card-border hover:border-accent/25 transition-colors group">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-xl bg-accent/10 border border-accent/20 flex items-center justify-center shrink-0 group-hover:bg-accent/15 transition-colors">
                    <span className="text-sm">🧘</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] uppercase tracking-widest text-accent font-semibold mb-1">Scenario</p>
                    <p className="text-sm font-semibold text-foreground leading-snug">{f.scenario}</p>
                  </div>
                </div>
                <div className="mt-3 pl-0 pt-3 border-t border-card-border">
                  <p className="text-[10px] uppercase tracking-widest text-muted mb-1.5">Strategy</p>
                  <p className="text-xs text-foreground/90 leading-relaxed">{f.strategy}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* Doctor Discussion */}
      <Section id="doctor" title="Doctor Discussion" icon="👨‍⚕️" subtitle="Red flags from your data, Rx to consider, specialists worth visiting, and tests to order. This doesn't replace medical consultation.">
        {!p.doctorDiscussion || (!p.doctorDiscussion.redFlags?.length && !p.doctorDiscussion.rxSuggestions?.length && !p.doctorDiscussion.specialistReferrals?.length && !p.doctorDiscussion.testsToOrder?.length) ? (
          <div className="p-6 rounded-xl bg-gradient-to-br from-accent/[0.04] to-transparent border border-accent/15 text-center">
            <div className="w-12 h-12 rounded-2xl bg-accent/15 border border-accent/25 mx-auto flex items-center justify-center mb-3">
              <span className="text-xl">✅</span>
            </div>
            <p className="text-sm font-semibold text-accent">No red flags detected</p>
            <p className="text-xs text-muted-foreground mt-1.5 max-w-sm mx-auto leading-relaxed">
              Based on your current data, no urgent medical concerns surfaced. Keep your annual physical + blood panel on schedule.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {/* Disclaimer callout */}
            <div className="flex items-start gap-3 p-3 rounded-xl bg-amber-500/[0.05] border border-amber-500/20">
              <span className="text-base shrink-0">⚠️</span>
              <p className="text-[11px] text-amber-400/95 leading-relaxed">
                These are pattern-based suggestions, not prescriptions. Bring them to a qualified physician before acting.
              </p>
            </div>

            {/* Red flags — highest priority */}
            {p.doctorDiscussion.redFlags && p.doctorDiscussion.redFlags.length > 0 && (
              <div className="p-4 rounded-xl bg-red-500/[0.06] border border-red-500/25">
                <div className="flex items-center gap-2 mb-2.5">
                  <div className="w-8 h-8 rounded-lg bg-red-500/15 border border-red-500/30 flex items-center justify-center">
                    <span className="text-sm">🚩</span>
                  </div>
                  <div>
                    <p className="text-xs font-bold text-danger uppercase tracking-wider">Red flags · See a doctor</p>
                    <p className="text-[10px] text-muted-foreground">Don't wait on these</p>
                  </div>
                </div>
                <ul className="space-y-1.5 pl-1">
                  {p.doctorDiscussion.redFlags.map((f, i) => (
                    <li key={i} className="text-sm text-foreground/95 leading-snug flex gap-2">
                      <span className="text-danger shrink-0 mt-0.5">·</span>
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Specialist referrals */}
            {p.doctorDiscussion.specialistReferrals && p.doctorDiscussion.specialistReferrals.length > 0 && (
              <div className="p-4 rounded-xl bg-surface-2 border border-card-border">
                <div className="flex items-center gap-2 mb-2.5">
                  <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/25 flex items-center justify-center">
                    <span className="text-sm">🏥</span>
                  </div>
                  <div>
                    <p className="text-xs font-bold text-blue-400 uppercase tracking-wider">Specialists to see</p>
                    <p className="text-[10px] text-muted-foreground">Worth an appointment based on your data</p>
                  </div>
                </div>
                <ul className="space-y-1.5 pl-1">
                  {p.doctorDiscussion.specialistReferrals.map((s, i) => (
                    <li key={i} className="text-sm text-foreground/90 leading-snug flex gap-2">
                      <span className="text-blue-400/80 shrink-0 mt-0.5">·</span>
                      <span>{s}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Rx to consider */}
            {p.doctorDiscussion.rxSuggestions && p.doctorDiscussion.rxSuggestions.length > 0 && (
              <div className="p-4 rounded-xl bg-surface-2 border border-card-border">
                <div className="flex items-center gap-2 mb-2.5">
                  <div className="w-8 h-8 rounded-lg bg-purple-500/10 border border-purple-500/25 flex items-center justify-center">
                    <span className="text-sm">💊</span>
                  </div>
                  <div>
                    <p className="text-xs font-bold text-purple-400 uppercase tracking-wider">Rx to discuss</p>
                    <p className="text-[10px] text-muted-foreground">Prescription-level — doctor's call</p>
                  </div>
                </div>
                <ul className="space-y-1.5 pl-1">
                  {p.doctorDiscussion.rxSuggestions.map((r, i) => (
                    <li key={i} className="text-sm text-foreground/90 leading-snug flex gap-2">
                      <span className="text-purple-400/80 shrink-0 mt-0.5">·</span>
                      <span>{r}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Tests to order */}
            {p.doctorDiscussion.testsToOrder && p.doctorDiscussion.testsToOrder.length > 0 && (
              <div className="p-4 rounded-xl bg-surface-2 border border-card-border">
                <div className="flex items-center gap-2 mb-2.5">
                  <div className="w-8 h-8 rounded-lg bg-accent/10 border border-accent/25 flex items-center justify-center">
                    <span className="text-sm">🧪</span>
                  </div>
                  <div>
                    <p className="text-xs font-bold text-accent uppercase tracking-wider">Tests to request</p>
                    <p className="text-[10px] text-muted-foreground">Order these at your next lab visit</p>
                  </div>
                </div>
                <ul className="space-y-1.5 pl-1">
                  {p.doctorDiscussion.testsToOrder.map((t, i) => (
                    <li key={i} className="text-sm text-foreground/90 leading-snug flex gap-2">
                      <span className="text-accent shrink-0 mt-0.5">·</span>
                      <span>{t}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </Section>

      {/* Footer */}
      <div className="text-center py-6 space-y-2">
        <p className="text-xs text-muted">Generated by <span className="text-accent">Protocol AI Engine</span></p>
        <p className="text-[10px] text-muted">This is not medical advice. Consult a doctor before making changes.</p>
        <button onClick={async () => { await fetch('/api/reset-onboarding', { method: 'POST' }); window.location.href = '/onboarding'; }} className="text-xs text-accent hover:underline">Regenerate protocol</button>
      </div>
      </div>

      {/* Floating "Ask AI" pill — deep-links to /chat?q=... with a pre-seeded
          question so a user who's reading their dashboard can ask follow-ups
          without leaving the page manually. Demo mode hides it since chat is
          authed only. */}
      {!demoMode && <AskAIPill />}
    </div>
  );
}
