import Link from 'next/link';
import { BIOMARKER_DB } from '@/lib/engine/biomarkers';
import { PATTERN_COUNT } from '@/lib/engine/patterns';
import { DAILY_HABITS } from '@/lib/engine/daily-habits';
import { MobileNavToggle } from '@/components/ui/MobileNavToggle';

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
              <p className="text-xs text-muted mt-0.5">Optim: {b.longevityOptimalLow}-{b.longevityOptimalHigh} {b.unit}</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xl font-bold font-mono text-accent">{val}</span>
              <span className="text-xs text-muted">{b.unit}</span>
              <span className={`text-xs font-mono px-2 py-0.5 rounded-full ${isOptimal ? 'bg-accent/20 text-accent' : 'bg-amber-500/20 text-amber-400'}`}>
                {isOptimal ? 'OPTIM' : 'SUBOPTIM'}
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
            <a href="#how" className="text-muted-foreground hover:text-foreground hidden sm:block">Cum funcționează</a>
            <a href="#demo" className="text-muted-foreground hover:text-foreground hidden sm:block">Demo</a>
            <Link href="/changelog" className="text-muted-foreground hover:text-foreground hidden sm:block">Noutăți</Link>
            <Link href="/login" className="px-3 sm:px-4 py-1.5 rounded-lg bg-accent text-black font-semibold text-xs sm:text-sm hover:bg-accent-dim transition-colors">
              Conectare
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
            Gratuit în perioada beta
          </div>

          <h1 className="text-5xl sm:text-7xl font-bold leading-[1.05] tracking-tight animate-fade-in-up stagger-1">
            Analizele tale.<br />
            <span className="gradient-text">Un plan real.</span><br />
            <span className="text-muted-foreground">Făcut pentru tine.</span>
          </h1>

          <p className="text-lg sm:text-xl text-muted-foreground mt-8 max-w-2xl mx-auto leading-relaxed animate-fade-in-up stagger-2">
            Urcă buletinul de analize. În 60 de secunde primești un plan calibrat pe biomarkerii <strong className="text-foreground">tăi</strong> —
            ce să mănânci, ce să iei, cum să te antrenezi, cum să dormi. Fără sfaturi generice, fără bugetul de $2M al lui Bryan Johnson.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mt-10 animate-fade-in-up stagger-3">
            <Link href="/login"
              className="inline-flex items-center gap-2 px-8 py-4 bg-accent text-black rounded-xl font-bold text-sm hover:bg-accent-bright transition-all active:scale-[0.98] glow-cta">
              Vreau planul meu
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              href="/dashboard?demo=1"
              className="px-6 py-4 rounded-xl border border-accent/40 bg-accent/[0.04] text-sm text-accent hover:bg-accent/[0.08] hover:border-accent/60 transition-all flex items-center gap-2"
            >
              Vezi întâi un exemplu
            </Link>
          </div>

          <p className="text-xs text-muted mt-6 animate-fade-in-up stagger-4">
            Înregistrare 3 minute · Fără card · {BIOMARKER_COUNT} biomarkeri · {PATTERN_COUNT} tipare clinice
          </p>

          {/* Trust microcopy strip — surfaces the three things that turn a
              visitor into a signup: safety, data control, and ongoing care.
              Each line anchors one objection we heard during user testing. */}
          <div className="mt-10 grid grid-cols-1 sm:grid-cols-3 gap-3 max-w-3xl mx-auto animate-fade-in-up stagger-5">
            <div className="rounded-xl bg-card/60 border border-card-border px-4 py-3 flex items-start gap-3 text-left">
              <Shield className="w-4 h-4 text-accent shrink-0 mt-0.5" />
              <div>
                <p className="text-[11px] font-semibold text-foreground">Datele tale rămân ale tale</p>
                <p className="text-xs text-muted-foreground leading-snug mt-0.5">Doar tu poți citi buletinul de analize. Ștergi contul — dispare tot.</p>
              </div>
            </div>
            <div className="rounded-xl bg-card/60 border border-card-border px-4 py-3 flex items-start gap-3 text-left">
              <Activity className="w-4 h-4 text-accent shrink-0 mt-0.5" />
              <div>
                <p className="text-[11px] font-semibold text-foreground">Se actualizează în fiecare noapte</p>
                <p className="text-xs text-muted-foreground leading-snug mt-0.5">Planul tău se regenerează pe baza datelor de la wearable și tracking — fără buton de apăsat.</p>
              </div>
            </div>
            <div className="rounded-xl bg-card/60 border border-card-border px-4 py-3 flex items-start gap-3 text-left">
              <Sparkles className="w-4 h-4 text-accent shrink-0 mt-0.5" />
              <div>
                <p className="text-[11px] font-semibold text-foreground">Niciodată blocat</p>
                <p className="text-xs text-muted-foreground leading-snug mt-0.5">Claude e primar. Dacă pică, Groq preia. Dacă ambele pică, un engine bazat pe reguli îți dă un plan.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Stats bar */}
      <section className="border-y border-card-border bg-card/30">
        <div className="max-w-6xl mx-auto px-6 py-8 grid grid-cols-2 sm:grid-cols-4 gap-6 text-center">
          {[
            { num: String(BIOMARKER_COUNT), label: 'Biomarkeri analizați' },
            { num: String(PATTERN_COUNT), label: 'Tipare clinice detectate' },
            { num: '<60s', label: 'Generare protocol' },
            { num: String(HABIT_COUNT), label: 'Obiceiuri zilnice' },
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
          <p className="text-center text-xs uppercase tracking-widest text-muted mb-6">
            Sincronizare automată cu wearable-urile tale
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
          <p className="text-center text-xs text-muted mt-5">
            Samsung Galaxy Watch și Apple Watch vin odată cu aplicația mobilă nativă.
          </p>
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="max-w-5xl mx-auto px-6 py-24">
        <div className="text-center mb-16">
          <p className="text-xs uppercase tracking-wider text-accent mb-3">Cum funcționează</p>
          <h2 className="text-3xl sm:text-4xl font-bold">De la buletinul de analize la protocol<br />în trei pași.</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            {
              step: '01', icon: FileText,
              title: 'Adaugă buletinul de analize',
              desc: 'Urcă un PDF sau scrie valorile manual. Suportăm Synevo, Regina Maria, MedLife, LabCorp, Quest și majoritatea formatelor de laborator.',
            },
            {
              step: '02', icon: Activity,
              title: 'AI-ul analizează datele',
              desc: `Cei ${BIOMARKER_COUNT} biomarkeri ai tăi sunt clasificați față de intervale optime pentru longevitate. ${PATTERN_COUNT} tipare clinice scanate. Vârstă biologică estimată prin algoritmul PhenoAge.`,
            },
            {
              step: '03', icon: Target,
              title: 'Primești protocolul',
              desc: 'Stack de suplimente personalizat cu dozaj, plan de nutriție cu macros, antrenament, protocol de somn, roadmap 12 săptămâni — toate justificate de valorile TALE specifice.',
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
            <p className="text-xs uppercase tracking-wider text-accent mb-3">Protocol exemplu live</p>
            <h2 className="text-3xl sm:text-4xl font-bold mb-3">Nu ne crede pe cuvânt — vezi rezultatul real</h2>
            <p className="text-sm text-muted-foreground max-w-xl mx-auto">
              Un dashboard complet pentru un bărbat fictiv de 35 de ani — același UI, același engine, fără înregistrare. Apasă, scrollează suplimentele, vezi opțiunile de masă, cum ar arăta protocolul tău în realitate.
            </p>
          </div>

          {/* Hero stats from sample protocol */}
          <div className="grid grid-cols-3 gap-3 max-w-2xl mx-auto mb-8">
            <div className="metric-tile text-center">
              <p className="text-3xl font-bold font-mono text-accent">78</p>
              <p className="text-xs text-muted uppercase tracking-widest mt-1">Longevitate</p>
            </div>
            <div className="metric-tile text-center">
              <p className="text-3xl font-bold font-mono text-accent">32a 5l</p>
              <p className="text-xs text-muted uppercase tracking-widest mt-1">Vârstă bio (din 35)</p>
            </div>
            <div className="metric-tile text-center">
              <p className="text-3xl font-bold font-mono text-accent">0.84×</p>
              <p className="text-xs text-muted uppercase tracking-widest mt-1">Ritm îmbătrânire</p>
            </div>
          </div>

          <div className="text-center space-y-3">
            <Link
              href="/dashboard?demo=1"
              className="inline-flex items-center gap-2 px-8 py-4 bg-accent text-black rounded-xl font-bold text-sm hover:bg-accent-bright transition-all glow-cta"
            >
              👀 Deschide dashboard-ul exemplu <ArrowRight className="w-4 h-4" />
            </Link>
            <p className="text-xs text-muted">Se deschide în acest tab · Butonul de înregistrare e sus pentru a-l avea pe al tău</p>
          </div>

          {/* Mini feature strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-10 pt-10 border-t border-card-border">
            {[
              { e: '🧬', l: 'Vârstă biologică + ritm' },
              { e: '🍽️', l: '12 opțiuni de masă personalizate' },
              { e: '💊', l: 'Stack suplimente cu how-to' },
              { e: '🏆', l: 'Comparat cu Bryan Johnson' },
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
          <p className="text-xs uppercase tracking-wider text-accent mb-3">Stack complet</p>
          <h2 className="text-3xl sm:text-4xl font-bold">Tot ce îți trebuie<br />să-ți optimizezi biologia.</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {[
            { icon: Zap, title: 'Groq + Claude AI', desc: 'Parsare PDF rapidă cu Groq, sinteză de protocol profundă. Output de 16K tokens.' },
            { icon: Brain, title: 'Algoritm PhenoAge', desc: 'Vârstă biologică estimată cu algoritmul clinic pe 9 markeri (Levine 2018).' },
            { icon: Heart, title: 'Comparație Bryan', desc: 'Fiecare biomarker arată valoarea ta vs rezultatele reale ale lui Bryan Johnson.' },
            { icon: Activity, title: 'Tracking zilnic', desc: '14 obiceiuri universale + complianță suplimente + metrici. Streak-uri, heatmap, achievements.' },
            { icon: Shield, title: 'DB interacțiuni medicamente', desc: '25+ interacțiuni medicament-supliment verificate față de medicația ta curentă.' },
            { icon: Sparkles, title: 'Chat AI coach', desc: 'Întreabă orice. Asistentul cunoaște profilul, protocolul și biomarkerii tăi complet.' },
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
          <p className="text-xs uppercase tracking-wider text-accent mb-3">Comparație</p>
          <h2 className="text-3xl sm:text-4xl font-bold">Protocolul tău vs Blueprint-ul lui Bryan</h2>
        </div>
        <div className="rounded-2xl bg-card border border-card-border overflow-hidden">
          <div className="grid grid-cols-3 text-center text-xs font-semibold py-4 border-b border-card-border bg-black/20">
            <span className="text-muted-foreground">Categorie</span>
            <span className="text-muted-foreground">Bryan Johnson</span>
            <span className="text-accent">Protocolul tău</span>
          </div>
          {[
            { cat: 'Dietă', bryan: 'Vegan · 2.250 kcal · strict', yours: 'Adaptat la dieta + obiectivele TALE' },
            { cat: 'Suplimente', bryan: '100+ pastile zilnic', yours: '8-15 pe baza lipsurilor TALE de biomarkeri' },
            { cat: 'Cost', bryan: '$2M / an', yours: 'Gratuit · se încadrează în bugetul TĂU (RON)' },
            { cat: 'Exercițiu', bryan: '6 ore/săpt. rigid', yours: 'Se potrivește programului TĂU' },
            { cat: 'Somn', bryan: '20:30 fix în fiecare seară', yours: 'Optimizat pe cronotipul TĂU' },
            { cat: 'Tracking', bryan: 'Echipă medicală de 30 persoane', yours: 'Coach AI în buzunar' },
            { cat: 'Vârstă bio', bryan: '-5,1 ani (la 47 ani)', yours: 'Calculat din analizele TALE' },
            { cat: 'Genetică', bryan: 'Genom integral · $10K+', yours: 'Integrează rezultatele tale 23andMe / Nebula' },
            { cat: 'Siguranță medicamente', bryan: 'Supravegheat de medic', yours: '25+ interacțiuni medicament-supliment verificate' },
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
          <p className="text-xs uppercase tracking-wider text-accent mb-3">De ce nu doar ChatGPT?</p>
          <h2 className="text-3xl sm:text-4xl font-bold">Un chatbot nu înlocuiește un <span className="gradient-text">engine de longevitate</span>.</h2>
          <p className="text-sm text-muted-foreground mt-4 max-w-2xl mx-auto">
            ChatGPT e un generalist bun. Dar protocoalele de longevitate au nevoie de structură, reproducibilitate și rădăcină în datele tale de biomarkeri — nu &bdquo;sfaturi sănătoase generale&rdquo;.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[
            {
              title: 'Engine determinist + AI',
              chatgpt: 'LLM pur — răspunsurile variază la fiecare conversație. Fără reproducibilitate.',
              protocol: `Engine-ul bazat pe reguli scorează ${BIOMARKER_COUNT} biomarkeri, detectează ${PATTERN_COUNT}+ tipare clinice, apoi AI-ul scrie stratul de coaching deasupra. Aceiași biomarkeri → același protocol.`,
            },
            {
              title: 'Siguranță medicament × supliment',
              chatgpt: 'Fără verificare structurată. Poate recomanda Sunătoare când iei SSRI.',
              protocol: 'Fiecare supliment e verificat față de Rx-ul și condițiile tale într-o bază cu 25+ interacțiuni. Contraindicațiile apar inline.',
            },
            {
              title: 'Intervale calibrate pe longevitate',
              chatgpt: 'Folosește valori &bdquo;în interval&rdquo; medii populaționale. &bdquo;Normal de laborator&rdquo; ≠ optim pentru longevitate.',
              protocol: 'Fiecare biomarker are o bandă optimă pentru longevitate (calibrat pe Bryan Johnson, Inflammaging, studii CR) — nu &bdquo;intervalul normal&rdquo; de laborator.',
            },
            {
              title: 'PhenoAge + ritm de îmbătrânire',
              chatgpt: 'Nu poate calcula. Fără memorie a analizelor tale precedente.',
              protocol: 'Implementează PhenoAge Levine 2018 (9 markeri) + ritm de îmbătrânire tip DunedinPACE. Urmărit pe versiuni v1 → v2 → v3.',
            },
            {
              title: 'Benchmark Bryan Johnson',
              chatgpt: 'Menționează Bryan vag. Fără comparație cap-la-cap cu valorile tale.',
              protocol: 'Fiecare biomarker din protocolul tău arată valoarea ta vs rezultatul real al lui Bryan. Vezi exact unde e diferența.',
            },
            {
              title: 'Urmărire zilnică',
              chatgpt: 'Stateless — uită ce ți-a zis ieri.',
              protocol: 'Urmărește zilnic obiceiurile + suplimentele + metricile. Scor de complianță săptămânal. Auto-regenerează protocolul la 3 AM.',
            },
          ].map((r, i) => (
            <div key={r.title} className={`rounded-2xl bg-card border border-card-border p-5 hover:border-accent/30 transition-colors animate-fade-in-up stagger-${(i % 5) + 1}`}>
              <h3 className="text-sm font-semibold mb-3">{r.title}</h3>
              <div className="space-y-2.5 text-xs">
                <div className="flex gap-2">
                  <span className="shrink-0 px-1.5 py-0.5 rounded bg-muted/20 text-muted-foreground text-xs font-mono">GPT</span>
                  <p className="text-muted-foreground leading-relaxed">{r.chatgpt}</p>
                </div>
                <div className="flex gap-2">
                  <span className="shrink-0 px-1.5 py-0.5 rounded bg-accent/20 text-accent text-xs font-mono">PROTOCOL</span>
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
              Nu mai ghici.<br />
              <span className="gradient-text">Începe să măsori.</span>
            </h2>
            <p className="text-muted-foreground mt-6 max-w-xl mx-auto text-base">
              Introdu biomarkerii tăi. Primești un protocol făcut pentru biologia TA.
              Nu al lui Bryan. Nu generic. Al tău.
            </p>
            <Link href="/login"
              className="inline-flex items-center gap-2 mt-10 px-10 py-4 bg-accent text-black rounded-xl font-bold text-base hover:bg-accent-bright transition-all active:scale-[0.98] glow-cta">
              Vreau protocolul meu
              <ArrowRight className="w-5 h-5" />
            </Link>
            <p className="text-xs text-muted mt-5">Durează 3 minute · Fără card necesar</p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-card-border">
        <div className="max-w-6xl mx-auto px-6 py-12 grid grid-cols-2 sm:grid-cols-4 gap-8 text-sm">
          <div>
            <p className="font-bold text-accent mb-2">Protocol</p>
            <p className="text-xs text-muted-foreground">Protocoale de longevitate cu AI, calibrate pe biomarkerii tăi.</p>
          </div>
          <div>
            <p className="font-semibold text-xs text-muted uppercase tracking-wider mb-3">Produs</p>
            <div className="space-y-2 text-xs">
              <Link href="/login" className="block text-muted-foreground hover:text-accent">Începe</Link>
              <a href="#how" className="block text-muted-foreground hover:text-accent">Cum funcționează</a>
              <a href="#demo" className="block text-muted-foreground hover:text-accent">Demo</a>
            </div>
          </div>
          <div>
            <p className="font-semibold text-xs text-muted uppercase tracking-wider mb-3">Legal</p>
            <div className="space-y-2 text-xs">
              <Link href="/privacy" className="block text-muted-foreground hover:text-accent">Confidențialitate</Link>
              <Link href="/terms" className="block text-muted-foreground hover:text-accent">Termeni</Link>
            </div>
          </div>
          <div>
            <p className="font-semibold text-xs text-muted uppercase tracking-wider mb-3">Resurse</p>
            <div className="space-y-2 text-xs">
              <Link href="/biomarkers" className="block text-muted-foreground hover:text-accent">Ghiduri biomarkeri</Link>
              <Link href="/patterns" className="block text-muted-foreground hover:text-accent">Tipare clinice</Link>
              <Link href="/changelog" className="block text-muted-foreground hover:text-accent">Noutăți</Link>
              <a href="https://www.blueprint.bryanjohnson.com" target="_blank" rel="noopener noreferrer" className="block text-muted-foreground hover:text-accent">Blueprint Bryan</a>
            </div>
          </div>
        </div>
        <div className="border-t border-card-border py-6 text-center space-y-1">
          <p className="text-sm text-muted">Nu este sfat medical. Consultă medicul înainte să faci schimbări.</p>
          <p className="text-xs text-muted">Construit cu Groq AI · Next.js · Supabase · © {new Date().getFullYear()}</p>
        </div>
      </footer>
    </div>
  );
}
