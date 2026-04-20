// Public changelog — curated list of significant shipped changes. Kept as a
// typed array rather than parsed from git log so the wording is tight +
// intentional (git log messages include internal-only detail we wouldn't
// surface to users).

import type { Metadata } from 'next';
import Link from 'next/link';
import { Sparkles, ArrowRight } from 'lucide-react';
import { SITE_URL } from '@/lib/config';

export const metadata: Metadata = {
  title: 'Changelog — What\'s new in Protocol',
  description: 'Every feature we\'ve shipped. The engine, wearables, chat, SEO, security — tracked here so you can see what changed.',
  alternates: { canonical: `${SITE_URL}/changelog` },
};

interface Release {
  date: string;
  title: string;
  items: Array<{ tag: 'shipped' | 'fixed' | 'added' | 'perf' | 'security'; label: string; description?: string }>;
}

// Newest first. Keep items terse — tag + one-line label; description optional
// for items that need a full sentence.
const RELEASES: Release[] = [
  {
    date: '2026-04-20',
    title: 'Wearable integrations + PWA',
    items: [
      { tag: 'added', label: '5 OAuth wearable integrations', description: 'Oura Ring, Fitbit (Charge / Sense / Versa / Pixel Watch / Aria scale), Withings (smart-scale body composition + ScanWatch), WHOOP (continuous overnight HRV + recovery), Google Fit (Wear OS catch-all).' },
      { tag: 'added', label: 'Installable as a PWA', description: 'Manifest + service worker + install-prompt banner so you can add Protocol to your home screen and run it like a native app — offline shell cached, dedicated app icon.' },
      { tag: 'added', label: 'Referral loop', description: 'Every account gets a unique code. Share /r/CODE and anyone who signs up gets attributed to you — first-touch, no overwrite, self-referral blocked.' },
      { tag: 'added', label: 'Chat history persists on the server', description: 'Refresh no longer nukes your conversation. 90-day retention honored in the GDPR export.' },
      { tag: 'added', label: '46 programmatic SEO pages', description: 'One page per biomarker + one per clinical pattern with full intervention roadmaps and JSON-LD medical schema. Indexed via sitemap.' },
      { tag: 'added', label: 'Test suite', description: '119 unit tests across engine, integrations, utils. Runs in ~1.3s via `npm test`.' },
    ],
  },
  {
    date: '2026-04-19',
    title: 'BLOCKER + HIGH VALUE + POLISH groups',
    items: [
      { tag: 'fixed', label: 'Chat actions no longer race on concurrent saves', description: '3 atomic RPCs (apply_daily_metric_patch, apply_profile_patch, apply_protocol_adjust) replaced read-merge-write — tracking in one tab + chat in another can save to the same date without data loss.' },
      { tag: 'security', label: 'GDPR export is now complete', description: '/api/my-data?full=1 includes daily_metrics, compliance_logs, share_links, protocol history, and chat messages with a plain-English retention notice.' },
      { tag: 'fixed', label: 'Aging speed uses real wearable data', description: 'Last 30 days of daily_metrics (RHR, HRV, sleep, steps, stress, BP) now refine the longevity score (±4), biological age (±2y), and aging pace (±0.1), scaled by signal density.' },
      { tag: 'added', label: 'Pattern exclusion layer', description: 'Prediabetes suppresses Metabolic Syndrome (unless HbA1c ≥ 6.5 or lipid cluster present), Anemia suppresses generic Nutritional Deficiency, Inflammatory Cluster suppresses Oxidative Stress — no more 3 overlapping redundant prompts from one HbA1c.' },
      { tag: 'perf', label: 'Recharts lazy-loaded on dashboard', description: '~150 KB moved off the critical path; radar chart fades in while the rest of the dashboard renders immediately.' },
      { tag: 'fixed', label: 'Classifier weights every biomarker', description: 'Prior audit found only 18 of 33 biomarkers were weighted in the longevity score — the other 15 defaulted to 1. All 33 now have explicit weights derived from cohort-study effect sizes (ApoB, Lp(a), hsCRP highest; GGT, B12, Mg mid; RBC lowest).' },
      { tag: 'added', label: 'Romanian date + number formatting', description: 'Locale flipped to ro-RO across format utils and all page-local toLocaleDateString/Number calls.' },
    ],
  },
  {
    date: '2026-04-18',
    title: 'Round 18 — range fields + stress split + body score',
    items: [
      { tag: 'added', label: 'Skin-temp deviation as a range', description: 'Two boxes for the lowest + highest delta vs 30-day baseline instead of a single reading. Normal band: −0.5 to +0.5 °C.' },
      { tag: 'added', label: 'Body score field (smart-scale composite)', description: 'Withings / Renpho / Xiaomi expose a single 0-100 body score; logged alongside individual body-comp metrics.' },
      { tag: 'fixed', label: 'Stress no longer overwrites itself', description: 'Midday / evening / bedtime stress logs each go to separate columns — logging "before bed" doesn\'t erase midday anymore.' },
    ],
  },
  {
    date: '2026-04-16',
    title: 'Rounds 15–17 — tracking UI rebuild',
    items: [
      { tag: 'added', label: 'Flat time-gated metric timeline', description: 'Replaced the modal log sheet with a single scrollable list where each metric is a row with inline Log button; future windows grayed out with unlock time.' },
      { tag: 'added', label: 'H + M duration inputs for sleep / workout', description: 'Two boxes for hours + minutes beats "7.5" or "452" in a single field for humans. Tabbing between them no longer commits early.' },
      { tag: 'added', label: 'Manual protocol-staleness refresh', description: 'Logs since last regen are tracked in localStorage; once ≥3 logged, a refresh banner appears so the user chooses when to spend AI tokens instead of regenerating on every save.' },
    ],
  },
  {
    date: '2026-04-14',
    title: 'Rounds 11–14 — morning fasted + sparse output fix',
    items: [
      { tag: 'added', label: 'Morning fasted measurements', description: 'Body fat %, muscle mass, visceral fat, body water, bone mass, BMR estimate, basal body temp, antioxidant index — all in one first-thing-after-waking block.' },
      { tag: 'fixed', label: 'Sparse AI output no longer hides sections', description: 'If Claude returns {diagnostic} only, the missing sections now merge from the deterministic fallback so Nutrition / Supplements / Daily Schedule can never be empty.' },
      { tag: 'added', label: 'Clock-aware Smart Log recap', description: 'The tracking page shows only metrics you should have measured by now, grayed-out for later windows.' },
    ],
  },
  {
    date: '2026-04-12',
    title: 'Rounds 6–10 — chat actions, devices, schedule precision',
    items: [
      { tag: 'added', label: 'Chat actions', description: 'The AI emits inline [[ACTION:...]] markers; the UI shows them as tap-to-apply chips. Three action types: update profile, log metric, adjust protocol — with a strict Zod allowlist server-side.' },
      { tag: 'added', label: 'Device-aware tracking', description: 'Onboarding collects your wearables + home equipment. The daily log only asks for metrics your devices can actually capture.' },
      { tag: 'added', label: 'Granular daily schedule', description: 'Supplement timing precision (morning/midday/evening/bedtime slots), meal anchors, hydration + movement break slots.' },
      { tag: 'added', label: 'Massive device catalog', description: '140+ smartwatch models, 22 smart rings, 36+ home-equipment items mapped to daily_metrics columns.' },
    ],
  },
  {
    date: '2026-04-09',
    title: 'Rounds 1–5 — foundations',
    items: [
      { tag: 'added', label: 'Initial engine', description: '33-biomarker classifier with longevity-optimal ranges tighter than lab reference, 13 clinical pattern detectors, PhenoAge biological age estimator, Bryan Johnson benchmark data.' },
      { tag: 'added', label: 'AI protocol generator', description: 'Claude Sonnet 4.5 primary, Groq Llama fallback, deterministic fallback when both fail — so users always get a complete renderable protocol.' },
      { tag: 'added', label: 'Dashboard + onboarding + tracking + chat + history + settings + share', description: 'Full app shell with RLS-gated Supabase tables, Google OAuth + email auth, PDF bloodwork parsing.' },
    ],
  },
];

const TAG_STYLE: Record<Release['items'][number]['tag'], { bg: string; label: string }> = {
  shipped:  { bg: 'bg-accent/10 text-accent border-accent/25',      label: 'Shipped' },
  added:    { bg: 'bg-accent/10 text-accent border-accent/25',      label: 'Added' },
  fixed:    { bg: 'bg-blue-500/10 text-blue-400 border-blue-500/25', label: 'Fixed' },
  perf:     { bg: 'bg-amber-500/10 text-amber-400 border-amber-500/25', label: 'Perf' },
  security: { bg: 'bg-red-500/10 text-danger border-red-500/25',    label: 'Security' },
};

export default function ChangelogPage() {
  return (
    <div className="min-h-dvh bg-background text-foreground">
      <header className="border-b border-card-border bg-background/80 backdrop-blur-xl sticky top-0 z-40">
        <div className="max-w-4xl mx-auto px-6 py-3 flex items-center justify-between">
          <Link href="/" className="text-accent font-bold text-lg tracking-tight">Protocol</Link>
          <Link href="/login?mode=register" className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-accent transition-colors">
            Get your protocol <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-12 sm:py-16 space-y-12">
        <div className="space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent/10 border border-accent/25 text-accent text-xs font-medium">
            <Sparkles className="w-3 h-3" /> Changelog
          </div>
          <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight">
            What&apos;s shipping
          </h1>
          <p className="text-sm sm:text-base text-muted-foreground leading-relaxed max-w-2xl">
            Every significant change that went live. Feature work is shipping weekly; security and
            concurrency fixes ship same-day.
          </p>
        </div>

        <ol className="space-y-10">
          {RELEASES.map(rel => (
            <li key={rel.date} className="relative pl-6 border-l border-card-border">
              <span className="absolute -left-[5px] top-1 w-2.5 h-2.5 rounded-full bg-accent ring-4 ring-background" />
              <p className="text-[10px] uppercase tracking-widest text-muted font-mono mb-1">
                {new Date(rel.date + 'T00:00:00Z').toLocaleDateString('ro-RO', { year: 'numeric', month: 'long', day: 'numeric' })}
              </p>
              <h2 className="text-xl font-semibold tracking-tight mb-4">{rel.title}</h2>
              <ul className="space-y-3">
                {rel.items.map((item, i) => {
                  const style = TAG_STYLE[item.tag];
                  return (
                    <li key={i} className="glass-card rounded-xl p-4 space-y-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-[10px] font-mono uppercase tracking-widest px-2 py-0.5 rounded-full border ${style.bg}`}>
                          {style.label}
                        </span>
                        <span className="text-sm font-medium">{item.label}</span>
                      </div>
                      {item.description && (
                        <p className="text-[13px] text-muted-foreground leading-relaxed">{item.description}</p>
                      )}
                    </li>
                  );
                })}
              </ul>
            </li>
          ))}
        </ol>

        <div className="rounded-3xl bg-gradient-to-br from-accent/10 via-accent/[0.03] to-transparent border border-accent/25 p-6 sm:p-8 text-center space-y-3">
          <h2 className="text-xl sm:text-2xl font-semibold tracking-tight">
            Want to shape what ships next?
          </h2>
          <p className="text-sm text-muted-foreground max-w-md mx-auto leading-relaxed">
            Sign up for free during beta — your feedback decides what we build.
          </p>
          <Link
            href="/login?mode=register"
            className="inline-flex items-center gap-2 bg-accent text-black font-semibold text-sm px-6 py-3 rounded-xl hover:bg-accent-bright transition-colors"
          >
            Get started <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </main>
    </div>
  );
}
