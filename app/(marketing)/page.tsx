import Link from 'next/link';
import { BIOMARKER_DB } from '@/lib/engine/biomarkers';

function BiomarkerDemo() {
  const demoMarkers = BIOMARKER_DB.filter(b => b.bryanJohnsonValue !== undefined).slice(0, 8);
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
      {demoMarkers.map((b) => {
        const val = b.bryanJohnsonValue!;
        const isOptimal = val >= b.longevityOptimalLow && val <= b.longevityOptimalHigh;
        return (
          <div key={b.code} className="flex items-center justify-between p-3 rounded-xl bg-card border border-card-border hover:border-accent/30 transition-colors group">
            <div>
              <p className="text-sm font-medium group-hover:text-accent transition-colors">{b.shortName}</p>
              <p className="text-[10px] text-muted">Optimal: {b.longevityOptimalLow}-{b.longevityOptimalHigh} {b.unit}</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-lg font-bold font-mono text-accent">{val}</span>
              <span className="text-[10px] text-muted">{b.unit}</span>
              <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded-full ${isOptimal ? 'bg-accent/20 text-accent' : 'bg-amber-500/20 text-amber-400'}`}>
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
    <div className="min-h-dvh bg-background">
      {/* Hero */}
      <section className="max-w-4xl mx-auto px-6 pt-20 pb-16 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent/10 border border-accent/20 text-accent text-xs font-medium mb-6">
          <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
          Beta — Free during launch
        </div>
        <h1 className="text-4xl sm:text-6xl font-bold leading-tight tracking-tight">
          Bryan Johnson spends<br />
          <span className="text-accent">$2M/year</span> on longevity.<br />
          <span className="text-muted-foreground">You have your blood panel and AI.</span>
        </h1>
        <p className="text-lg text-muted-foreground mt-6 max-w-2xl mx-auto">
          Get a protocol calibrated to <strong className="text-foreground">YOUR</strong> biomarkers — not his.
          Personalized nutrition, supplements, exercise, and sleep.
          Generated in 60 seconds.
        </p>
        <div className="flex items-center justify-center gap-4 mt-8">
          <Link href="/login" className="px-8 py-3.5 bg-accent text-black rounded-xl font-semibold text-sm hover:bg-accent-dim transition-colors active:scale-[0.98]">
            Get Your Protocol — Free
          </Link>
          <a href="#how-it-works" className="px-6 py-3.5 rounded-xl border border-card-border text-sm text-muted-foreground hover:text-foreground hover:border-foreground/20 transition-colors">
            How it works
          </a>
        </div>
      </section>

      {/* Social proof bar */}
      <section className="border-y border-card-border py-4">
        <div className="max-w-4xl mx-auto px-6 flex flex-wrap items-center justify-center gap-6 text-xs text-muted-foreground">
          <span>🔬 37 biomarkers analyzed</span>
          <span className="w-1 h-1 rounded-full bg-card-border" />
          <span>⚡ 5 health patterns detected</span>
          <span className="w-1 h-1 rounded-full bg-card-border" />
          <span>🧬 Protocol in &lt;60 seconds</span>
          <span className="w-1 h-1 rounded-full bg-card-border" />
          <span>💊 Bryan Johnson comparison</span>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="max-w-4xl mx-auto px-6 py-20">
        <h2 className="text-2xl font-bold text-center mb-12">How it works</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          {[
            { step: '01', title: 'Enter your blood work', desc: 'Upload a PDF from any lab or enter values manually. We support Synevo, Regina Maria, MedLife, LabCorp, Quest, and more.', icon: '🩸' },
            { step: '02', title: 'AI analyzes your data', desc: 'Your biomarkers are classified against longevity-optimal ranges (not just lab ranges). Patterns detected. Biological age estimated.', icon: '🤖' },
            { step: '03', title: 'Get your protocol', desc: 'Personalized nutrition, supplements, exercise, sleep — all justified by YOUR specific biomarker values and budget.', icon: '📋' },
          ].map((item) => (
            <div key={item.step} className="rounded-2xl bg-card border border-card-border p-6 space-y-3">
              <div className="flex items-center gap-3">
                <span className="text-2xl">{item.icon}</span>
                <span className="text-xs font-mono text-accent">{item.step}</span>
              </div>
              <h3 className="text-base font-semibold">{item.title}</h3>
              <p className="text-sm text-muted-foreground">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Biomarker Demo */}
      <section className="max-w-4xl mx-auto px-6 py-16">
        <div className="rounded-2xl bg-card border border-card-border p-6 sm:p-8">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold">Bryan Johnson&apos;s actual biomarkers</h2>
            <p className="text-sm text-muted-foreground mt-2">This is what $2M/year of optimization looks like. How do yours compare?</p>
          </div>
          <BiomarkerDemo />
          <div className="text-center mt-6">
            <Link href="/login" className="inline-block px-6 py-3 bg-accent text-black rounded-xl font-semibold text-sm hover:bg-accent-dim transition-colors">
              Compare Your Biomarkers
            </Link>
          </div>
        </div>
      </section>

      {/* Comparison */}
      <section className="max-w-4xl mx-auto px-6 py-16">
        <h2 className="text-2xl font-bold text-center mb-8">Your Protocol vs Bryan&apos;s Blueprint</h2>
        <div className="rounded-2xl bg-card border border-card-border overflow-hidden">
          <div className="grid grid-cols-3 text-center text-xs font-medium py-3 border-b border-card-border">
            <span className="text-muted-foreground">Category</span>
            <span className="text-muted-foreground">Bryan Johnson</span>
            <span className="text-accent">Your Protocol</span>
          </div>
          {[
            { cat: 'Diet', bryan: 'Vegan, 1977 kcal', yours: 'Adapted to YOUR diet & goals' },
            { cat: 'Supplements', bryan: '100+ pills daily', yours: '8-15 based on YOUR gaps' },
            { cat: 'Cost', bryan: '$2M/year', yours: 'Fits YOUR budget (RON)' },
            { cat: 'Exercise', bryan: '6 hrs/week rigid', yours: 'Fits YOUR schedule' },
            { cat: 'Sleep', bryan: '8:30 PM bedtime', yours: 'Optimized to YOUR rhythm' },
            { cat: 'Tracking', bryan: 'Full-time team', yours: 'Daily checklist in-app' },
          ].map((row) => (
            <div key={row.cat} className="grid grid-cols-3 text-center text-sm py-3 border-b border-card-border last:border-0">
              <span className="font-medium">{row.cat}</span>
              <span className="text-muted-foreground">{row.bryan}</span>
              <span className="text-accent">{row.yours}</span>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-4xl mx-auto px-6 py-20 text-center">
        <h2 className="text-3xl font-bold">Ready to optimize?</h2>
        <p className="text-muted-foreground mt-3 max-w-lg mx-auto">Enter your biomarkers, get a protocol engineered for YOUR biology. Not Bryan&apos;s. Not generic. Yours.</p>
        <Link href="/login" className="inline-block mt-8 px-10 py-4 bg-accent text-black rounded-xl font-bold text-base hover:bg-accent-dim transition-colors active:scale-[0.98]">
          Get Started — It&apos;s Free
        </Link>
      </section>

      {/* Footer */}
      <footer className="border-t border-card-border py-8 text-center space-y-3">
        <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground">
          <Link href="/privacy" className="hover:text-accent">Privacy</Link>
          <span>•</span>
          <Link href="/terms" className="hover:text-accent">Terms</Link>
          <span>•</span>
          <a href="https://github.com/andrei1000z/protocol-maker" className="hover:text-accent">GitHub</a>
        </div>
        <p className="text-xs text-muted">Protocol AI Engine • Not medical advice • Consult your doctor before making changes</p>
        <p className="text-[10px] text-muted">Built with Groq AI + Next.js + Supabase</p>
      </footer>
    </div>
  );
}
