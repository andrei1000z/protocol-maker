import Link from 'next/link';
import { BIOMARKER_DB } from '@/lib/engine/biomarkers';
import { PATTERN_COUNT } from '@/lib/engine/patterns';
import { DAILY_HABITS } from '@/lib/engine/daily-habits';
import { MobileNavToggle } from '@/components/landing/MobileNavToggle';

// Single source of truth — derived at build time from the engine
const BIOMARKER_COUNT = BIOMARKER_DB.length;
const HABIT_COUNT = DAILY_HABITS.length;
import { ArrowRight, Sparkles, Activity, Target, FileText, Zap, Brain, Heart, Shield } from 'lucide-react';

function BiomarkerDemo() {
  // Show up to 12 of Bryan's known values — covers the canonical panel
  // (lipids + glucose + inflammation + hormones + liver + kidney + vitamins)
  // without overflowing the grid on desktop. Fallback: if <12 have his values
  // (e.g. BIOMARKER_DB pruned), show whatever exists.
  const withBryan = BIOMARKER_DB.filter(b => b.bryanJohnsonValue !== undefined);
  const demoMarkers = withBryan.slice(0, 12);
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {demoMarkers.map((b, i) => {
        const val = b.bryanJohnsonValue!;
        const isOptimal = val >= b.longevityOptimalLow && val <= b.longevityOptimalHigh;
        return (
          <div key={b.code}
            className={`flex items-center justify-between p-4 rounded-xl bg-card border border-card-border hover:border-accent/30 transition-all group animate-fade-in-up stagger-${(i % 5) + 1}`}>
            <div>
              <p className="text-sm font-medium group-hover:text-accent transition-colors">{b.shortName}</p>
              <p className="text-[10px] text-muted mt-0.5">Optimal: {b.longevityOptimalLow}-{b.longevityOptimalHigh} {b.unit}</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xl font-bold font-mono text-accent">{val}</span>
              <span className="text-[10px] text-muted">{b.unit}</span>
              <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full ${isOptimal ? 'bg-accent/20 text-accent' : 'bg-amber-500/20 text-amber-400'}`}>
                {isOptimal ? 'OPTIMAL' : 'SUBOPTIMAL'}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function LandingPage() {
  return (
    <div className="min-h-dvh bg-background noise">
      {/* Nav */}
      <nav className="sticky top-0 z-50 border-b border-card-border bg-black/60 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <span className="text-xl font-bold">
            <span className="text-accent">Protocol</span>
          </span>
          <div className="flex items-center gap-3 sm:gap-5 text-sm">
            <a href="#how" className="text-muted-foreground hover:text-foreground hidden sm:block">How it works</a>
            <a href="#demo" className="text-muted-foreground hover:text-foreground hidden sm:block">Demo</a>
            <Link href="/changelog" className="text-muted-foreground hover:text-foreground hidden sm:block">Changelog</Link>
            <Link href="/login" className="px-3 sm:px-4 py-1.5 rounded-lg bg-accent text-black font-semibold text-xs sm:text-sm hover:bg-accent-dim transition-colors">
              Sign in
            </Link>
            <MobileNavToggle />
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative grid-bg">
        <div className="max-w-5xl mx-auto px-6 pt-20 sm:pt-28 pb-20 text-center relative">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent/10 border border-accent/20 text-accent text-xs font-medium mb-8 animate-fade-in">
            <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
            Free during beta — powered by AI
          </div>

          <h1 className="text-5xl sm:text-7xl font-bold leading-[1.05] tracking-tight animate-fade-in-up stagger-1">
            Your blood work.<br />
            <span className="gradient-text">AI longevity coach.</span><br />
            <span className="text-muted-foreground">Your protocol.</span>
          </h1>

          <p className="text-lg sm:text-xl text-muted-foreground mt-8 max-w-2xl mx-auto leading-relaxed animate-fade-in-up stagger-2">
            Bryan Johnson spends <strong className="text-foreground">$2M/year</strong> on longevity.
            You have your blood panel and AI. Get a protocol calibrated to <strong className="text-foreground">YOUR</strong> biomarkers —
            not his. Personalized nutrition, supplements, exercise, sleep. Generated in 60 seconds.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mt-10 animate-fade-in-up stagger-3">
            <Link href="/login"
              className="inline-flex items-center gap-2 px-8 py-4 bg-accent text-black rounded-xl font-bold text-sm hover:bg-accent-bright transition-all active:scale-[0.98] glow-cta">
              Start in 3 minutes
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              href="/dashboard?demo=1"
              className="px-6 py-4 rounded-xl border border-accent/40 bg-accent/[0.04] text-sm text-accent hover:bg-accent/[0.08] hover:border-accent/60 transition-all flex items-center gap-2"
            >
              👀 See a live sample protocol
            </Link>
          </div>

          <p className="text-xs text-muted mt-6 animate-fade-in-up stagger-4">
            Takes 3 minutes · No credit card · {BIOMARKER_COUNT} biomarkers · {PATTERN_COUNT} patterns analyzed
          </p>
        </div>
      </section>

      {/* Stats bar */}
      <section className="border-y border-card-border bg-card/30">
        <div className="max-w-6xl mx-auto px-6 py-8 grid grid-cols-2 sm:grid-cols-4 gap-6 text-center">
          {[
            { num: String(BIOMARKER_COUNT), label: 'Biomarkers analyzed' },
            { num: String(PATTERN_COUNT), label: 'Health patterns detected' },
            { num: '<60s', label: 'Protocol generation' },
            { num: String(HABIT_COUNT), label: 'Daily habits tracked' },
          ].map((s, i) => (
            <div key={i} className={`animate-fade-in-up stagger-${i + 1}`}>
              <p className="text-3xl sm:text-4xl font-bold font-mono text-accent">{s.num}</p>
              <p className="text-xs text-muted-foreground mt-1">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Wearables trust strip — makes the "we're a real product" case without
          asking users to read copy. 5 OAuth integrations + honest mobile-only
          note for Samsung/Apple (no hidden surprises). */}
      <section className="border-b border-card-border bg-gradient-to-b from-card/10 to-transparent">
        <div className="max-w-6xl mx-auto px-6 py-10">
          <p className="text-center text-[10px] uppercase tracking-widest text-muted mb-6">
            Auto-syncs with your wearables
          </p>
          <div className="grid grid-cols-3 sm:grid-cols-5 gap-3 sm:gap-4 max-w-3xl mx-auto">
            {[
              { emoji: '💍', name: 'Oura Ring',  bg: 'from-purple-500/10 border-purple-500/25' },
              { emoji: '⌚', name: 'Fitbit',     bg: 'from-cyan-500/10 border-cyan-500/25' },
              { emoji: '⚖️', name: 'Withings',   bg: 'from-emerald-500/10 border-emerald-500/25' },
              { emoji: '🏋️', name: 'WHOOP',      bg: 'from-amber-500/10 border-amber-500/25' },
              { emoji: '🤖', name: 'Google Fit', bg: 'from-blue-500/10 border-blue-500/25' },
            ].map((w, i) => (
              <div
                key={w.name}
                className={`rounded-2xl bg-gradient-to-br ${w.bg} bg-card border p-4 flex flex-col items-center justify-center gap-2 animate-fade-in-up hover:border-accent/40 transition-colors`}
                style={{ animationDelay: `${i * 50}ms` }}
              >
                <span className="text-2xl" aria-hidden>{w.emoji}</span>
                <span className="text-[11px] font-medium tracking-tight text-center">{w.name}</span>
              </div>
            ))}
          </div>
          <p className="text-center text-[10px] text-muted mt-5">
            Samsung Galaxy Watch + Apple Watch coming with the native mobile app.
          </p>
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="max-w-5xl mx-auto px-6 py-24">
        <div className="text-center mb-16">
          <p className="text-xs uppercase tracking-wider text-accent mb-3">How it works</p>
          <h2 className="text-3xl sm:text-4xl font-bold">From blood panel to protocol<br /> in three steps.</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            {
              step: '01', icon: FileText,
              title: 'Enter your blood work',
              desc: 'Upload a PDF or type values manually. We support Synevo, Regina Maria, MedLife, LabCorp, Quest, and most lab formats.',
            },
            {
              step: '02', icon: Activity,
              title: 'AI analyzes your data',
              desc: `Your ${BIOMARKER_COUNT} biomarkers are classified against longevity-optimal ranges. ${PATTERN_COUNT} health patterns scanned. Biological age estimated via PhenoAge algorithm.`,
            },
            {
              step: '03', icon: Target,
              title: 'Get your protocol',
              desc: 'Personalized supplement stack with dosing, nutrition plan with macros, exercise split, sleep protocol, 12-week roadmap — all justified by YOUR specific biomarker values.',
            },
          ].map((item, i) => (
            <div key={item.step}
              className={`rounded-2xl bg-card border border-card-border p-6 space-y-4 hover:border-accent/30 transition-colors animate-fade-in-up stagger-${i + 1}`}>
              <div className="flex items-center justify-between">
                <item.icon className="w-6 h-6 text-accent" />
                <span className="text-xs font-mono text-muted">{item.step}</span>
              </div>
              <h3 className="text-lg font-semibold">{item.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Live sample protocol — shows REAL output, not just Bryan's grid */}
      <section id="demo" className="max-w-6xl mx-auto px-6 py-24">
        <div className="rounded-3xl bg-card border border-card-border p-6 sm:p-10">
          <div className="text-center mb-10">
            <p className="text-xs uppercase tracking-wider text-accent mb-3">Live sample protocol</p>
            <h2 className="text-3xl sm:text-4xl font-bold mb-3">Don&apos;t take our word — see the actual output</h2>
            <p className="text-sm text-muted-foreground max-w-xl mx-auto">
              A fully-rendered dashboard for a fictional 35-year-old man — same UI, real engine, no signup. Click around, scroll the supplements, check the meal options, see how your protocol would actually look.
            </p>
          </div>

          {/* Hero stats from sample protocol */}
          <div className="grid grid-cols-3 gap-3 max-w-2xl mx-auto mb-8">
            <div className="metric-tile text-center">
              <p className="text-3xl font-bold font-mono text-accent">78</p>
              <p className="text-[10px] text-muted uppercase tracking-widest mt-1">Longevity</p>
            </div>
            <div className="metric-tile text-center">
              <p className="text-3xl font-bold font-mono text-accent">32y 5m</p>
              <p className="text-[10px] text-muted uppercase tracking-widest mt-1">Bio age (vs 35)</p>
            </div>
            <div className="metric-tile text-center">
              <p className="text-3xl font-bold font-mono text-accent">0.84×</p>
              <p className="text-[10px] text-muted uppercase tracking-widest mt-1">Aging speed</p>
            </div>
          </div>

          <div className="text-center space-y-3">
            <Link
              href="/dashboard?demo=1"
              className="inline-flex items-center gap-2 px-8 py-4 bg-accent text-black rounded-xl font-bold text-sm hover:bg-accent-bright transition-all glow-cta"
            >
              👀 Open the sample dashboard <ArrowRight className="w-4 h-4" />
            </Link>
            <p className="text-[11px] text-muted">Opens in this tab · Sign up button at the top to get yours</p>
          </div>

          {/* Mini feature strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-10 pt-10 border-t border-card-border">
            {[
              { e: '🧬', l: 'Bio age + aging speed' },
              { e: '🍽️', l: '12 meal options personalized' },
              { e: '💊', l: 'Supplement stack with how-to' },
              { e: '🏆', l: 'Bryan Johnson side-by-side' },
            ].map(f => (
              <div key={f.l} className="text-center p-3 rounded-xl bg-background border border-card-border">
                <p className="text-2xl">{f.e}</p>
                <p className="text-[11px] text-muted-foreground mt-1.5">{f.l}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Bryan's static grid as secondary, now properly framed */}
        <div className="mt-16 max-w-4xl mx-auto">
          <div className="text-center mb-6">
            <p className="text-xs uppercase tracking-wider text-muted mb-2">For reference</p>
            <h3 className="text-xl sm:text-2xl font-semibold">Bryan Johnson&apos;s actual numbers</h3>
            <p className="text-sm text-muted-foreground mt-2 max-w-md mx-auto">
              Your dashboard compares your biomarkers against these targets. $2M/year of optimization, in numbers:
            </p>
          </div>
          <BiomarkerDemo />
        </div>
      </section>

      {/* Features grid */}
      <section className="max-w-6xl mx-auto px-6 py-24">
        <div className="text-center mb-16">
          <p className="text-xs uppercase tracking-wider text-accent mb-3">Complete stack</p>
          <h2 className="text-3xl sm:text-4xl font-bold">Everything you need to<br /> optimize your biology.</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {[
            { icon: Zap, title: 'Groq + Claude AI', desc: 'Fast PDF parsing with Groq, deep protocol synthesis. 16K token outputs.' },
            { icon: Brain, title: 'PhenoAge algorithm', desc: 'Biological age estimated with 9-marker clinical algorithm from Levine 2018.' },
            { icon: Heart, title: 'Bryan comparison', desc: 'Every biomarker shows your value vs Bryan Johnson\'s actual lab results.' },
            { icon: Activity, title: 'Daily tracking', desc: '14 universal habits + supplement compliance + metrics logging. Streaks, heatmap, achievements.' },
            { icon: Shield, title: 'Drug interaction DB', desc: '25+ drug-supplement interactions checked against your current medications.' },
            { icon: Sparkles, title: 'AI chat coach', desc: 'Ask anything. The assistant knows your full profile, protocol, and biomarkers.' },
          ].map((item, i) => (
            <div key={item.title}
              className={`rounded-2xl bg-card border border-card-border p-5 hover:border-accent/30 transition-colors animate-fade-in-up stagger-${(i % 5) + 1}`}>
              <item.icon className="w-5 h-5 text-accent mb-3" />
              <h3 className="text-sm font-semibold mb-1">{item.title}</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Comparison */}
      <section className="max-w-5xl mx-auto px-6 py-24">
        <div className="text-center mb-12">
          <p className="text-xs uppercase tracking-wider text-accent mb-3">Comparison</p>
          <h2 className="text-3xl sm:text-4xl font-bold">Your protocol vs Bryan&apos;s Blueprint</h2>
        </div>
        <div className="rounded-2xl bg-card border border-card-border overflow-hidden">
          <div className="grid grid-cols-3 text-center text-xs font-semibold py-4 border-b border-card-border bg-black/20">
            <span className="text-muted-foreground">Category</span>
            <span className="text-muted-foreground">Bryan Johnson</span>
            <span className="text-accent">Your Protocol</span>
          </div>
          {[
            { cat: 'Diet', bryan: 'Vegan · 2,250 kcal · strict', yours: 'Adapted to YOUR diet + goals' },
            { cat: 'Supplements', bryan: '100+ pills daily', yours: '8-15 based on YOUR biomarker gaps' },
            { cat: 'Cost', bryan: '$2M / year', yours: 'Free · fits YOUR budget (RON)' },
            { cat: 'Exercise', bryan: '6 hrs/week rigid', yours: 'Fits YOUR schedule' },
            { cat: 'Sleep', bryan: '8:30 PM sharp every night', yours: 'Optimized to YOUR chronotype' },
            { cat: 'Tracking', bryan: '30-person medical team', yours: 'AI coach in your pocket' },
            { cat: 'Bio age', bryan: '-5.1 years (age 47)', yours: 'Calculated from YOUR bloodwork' },
            { cat: 'Genetics', bryan: 'Full-genome · $10K+', yours: 'Integrates your 23andMe / Nebula results' },
            { cat: 'Drug safety', bryan: 'Physician-supervised', yours: '25+ drug-supplement interactions checked' },
          ].map((row) => (
            <div key={row.cat} className="grid grid-cols-3 text-center text-sm py-4 border-b border-card-border last:border-0 hover:bg-card-hover transition-colors">
              <span className="font-medium">{row.cat}</span>
              <span className="text-muted-foreground">{row.bryan}</span>
              <span className="text-accent font-medium">{row.yours}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Why not ChatGPT */}
      <section className="max-w-5xl mx-auto px-6 py-24">
        <div className="text-center mb-12">
          <p className="text-xs uppercase tracking-wider text-accent mb-3">Why not just ChatGPT?</p>
          <h2 className="text-3xl sm:text-4xl font-bold">A chatbot can&apos;t replace a <span className="gradient-text">longevity engine</span>.</h2>
          <p className="text-sm text-muted-foreground mt-4 max-w-2xl mx-auto">
            ChatGPT is a great generalist. But longevity protocols need structure, reproducibility, and a grounding in the biomarker data — not &ldquo;general healthy advice&rdquo;.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[
            {
              title: 'Deterministic engine + AI',
              chatgpt: 'Pure LLM — answers can shift every conversation. No reproducibility.',
              protocol: `Rule-based engine scores ${BIOMARKER_COUNT} biomarkers, detects ${PATTERN_COUNT}+ clinical patterns, then the AI writes the coaching layer on top. Same biomarkers → same protocol.`,
            },
            {
              title: 'Drug × supplement safety',
              chatgpt: 'No structured check. May recommend St John&apos;s Wort while you&apos;re on SSRIs.',
              protocol: 'Every supplement cross-checked against your Rx + conditions from a 25+ interaction database. Contraindications shown inline.',
            },
            {
              title: 'Longevity-calibrated ranges',
              chatgpt: 'Uses population-average &ldquo;in-range&rdquo; values. Your doctor&apos;s lab-normal is not longevity-optimal.',
              protocol: 'Each biomarker has a longevity-optimal band (calibrated to Bryan Johnson, Inflammaging, CR studies) — not the lab &ldquo;normal range&rdquo;.',
            },
            {
              title: 'PhenoAge + aging velocity',
              chatgpt: 'Cannot compute. No memory of your prior labs.',
              protocol: 'Implements Levine 2018 PhenoAge (9 markers) + DunedinPACE-style aging velocity. Tracked across protocols v1 → v2 → v3.',
            },
            {
              title: 'Bryan Johnson benchmark',
              chatgpt: 'Mentions Bryan vaguely. No side-by-side of your actual numbers.',
              protocol: 'Every biomarker in your protocol shows your value vs Bryan&apos;s actual lab result. You see exactly where the gap is.',
            },
            {
              title: 'Daily follow-through',
              chatgpt: 'Stateless — forgets what it told you yesterday.',
              protocol: 'Tracks your habit + supplement + metric compliance daily. Weekly adherence score. Auto-regenerates protocol at 3 AM.',
            },
          ].map((r, i) => (
            <div key={r.title} className={`rounded-2xl bg-card border border-card-border p-5 hover:border-accent/30 transition-colors animate-fade-in-up stagger-${(i % 5) + 1}`}>
              <h3 className="text-sm font-semibold mb-3">{r.title}</h3>
              <div className="space-y-2.5 text-xs">
                <div className="flex gap-2">
                  <span className="shrink-0 px-1.5 py-0.5 rounded bg-muted/20 text-muted-foreground text-[10px] font-mono">GPT</span>
                  <p className="text-muted-foreground leading-relaxed">{r.chatgpt}</p>
                </div>
                <div className="flex gap-2">
                  <span className="shrink-0 px-1.5 py-0.5 rounded bg-accent/20 text-accent text-[10px] font-mono">PROTOCOL</span>
                  <p className="leading-relaxed">{r.protocol}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Final CTA */}
      <section className="max-w-4xl mx-auto px-6 py-24 text-center">
        <div className="rounded-3xl bg-gradient-to-br from-accent/10 via-card to-card border border-accent/20 p-10 sm:p-16 relative overflow-hidden">
          <div className="relative z-10">
            <h2 className="text-3xl sm:text-5xl font-bold leading-tight">
              Stop guessing.<br />
              <span className="gradient-text">Start measuring.</span>
            </h2>
            <p className="text-muted-foreground mt-6 max-w-xl mx-auto text-base">
              Enter your biomarkers. Get a protocol engineered for YOUR biology.
              Not Bryan&apos;s. Not generic. Yours.
            </p>
            <Link href="/login"
              className="inline-flex items-center gap-2 mt-10 px-10 py-4 bg-accent text-black rounded-xl font-bold text-base hover:bg-accent-bright transition-all active:scale-[0.98] glow-cta">
              Get my protocol
              <ArrowRight className="w-5 h-5" />
            </Link>
            <p className="text-xs text-muted mt-5">Takes 3 minutes · No credit card required</p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-card-border">
        <div className="max-w-6xl mx-auto px-6 py-12 grid grid-cols-2 sm:grid-cols-4 gap-8 text-sm">
          <div>
            <p className="font-bold text-accent mb-2">Protocol</p>
            <p className="text-xs text-muted-foreground">AI-powered longevity protocols calibrated to your biomarkers.</p>
          </div>
          <div>
            <p className="font-semibold text-xs text-muted uppercase tracking-wider mb-3">Product</p>
            <div className="space-y-2 text-xs">
              <Link href="/login" className="block text-muted-foreground hover:text-accent">Get started</Link>
              <a href="#how" className="block text-muted-foreground hover:text-accent">How it works</a>
              <a href="#demo" className="block text-muted-foreground hover:text-accent">Demo</a>
            </div>
          </div>
          <div>
            <p className="font-semibold text-xs text-muted uppercase tracking-wider mb-3">Legal</p>
            <div className="space-y-2 text-xs">
              <Link href="/privacy" className="block text-muted-foreground hover:text-accent">Privacy</Link>
              <Link href="/terms" className="block text-muted-foreground hover:text-accent">Terms</Link>
            </div>
          </div>
          <div>
            <p className="font-semibold text-xs text-muted uppercase tracking-wider mb-3">Resources</p>
            <div className="space-y-2 text-xs">
              <Link href="/biomarkers" className="block text-muted-foreground hover:text-accent">Biomarker guides</Link>
              <Link href="/patterns" className="block text-muted-foreground hover:text-accent">Clinical patterns</Link>
              <Link href="/changelog" className="block text-muted-foreground hover:text-accent">Changelog</Link>
              <a href="https://www.blueprint.bryanjohnson.com" target="_blank" rel="noopener noreferrer" className="block text-muted-foreground hover:text-accent">Bryan&apos;s Blueprint</a>
            </div>
          </div>
        </div>
        <div className="border-t border-card-border py-6 text-center space-y-1">
          <p className="text-xs text-muted">Not medical advice. Consult your doctor before making changes.</p>
          <p className="text-[10px] text-muted">Built with Groq AI · Next.js · Supabase · © {new Date().getFullYear()}</p>
        </div>
      </footer>
    </div>
  );
}
