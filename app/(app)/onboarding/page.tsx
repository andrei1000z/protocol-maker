'use client';

import { useState } from 'react';
import { BIOMARKER_DB, BIOMARKER_CATEGORIES } from '@/lib/engine/biomarkers';
import { GeneratingScreen } from '@/components/protocol/GeneratingScreen';
import clsx from 'clsx';

const ACTIVITY_LEVELS = [
  { value: 'sedentary', label: 'Sedentar', desc: 'Birou, sub 2000 pași/zi' },
  { value: 'light', label: 'Ușor activ', desc: '2-3 sesiuni/săpt, 5000 pași' },
  { value: 'moderate', label: 'Moderat', desc: '3-5 sesiuni/săpt, 8000 pași' },
  { value: 'active', label: 'Activ', desc: '5-6 sesiuni/săpt, 10000+ pași' },
  { value: 'elite', label: 'Atlet', desc: 'Antrenament zilnic intens' },
];

const DIET_TYPES = ['omnivore', 'vegetarian', 'vegan', 'keto', 'carnivore', 'mediterranean', 'other'];
const CONDITIONS = ['Diabet tip 2', 'Hipertensiune', 'Dislipidemie', 'Tiroidă', 'Autoimun', 'Cardiovascular', 'Depresie/Anxietate', 'Apnee somn', 'PCOS', 'Obezitate'];
const GOALS = ['Longevitate / Healthspan', 'Compoziție corporală', 'Performanță cognitivă', 'Piele / Păr', 'Energie / Dispoziție', 'Performanță atletică', 'Fertilitate', 'Recuperare condiție'];

export default function OnboardingPage() {
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Step 1 - Who are you
  const [age, setAge] = useState('');
  const [sex, setSex] = useState<'male' | 'female'>('male');
  const [heightCm, setHeightCm] = useState('');
  const [weightKg, setWeightKg] = useState('');
  const [activityLevel, setActivityLevel] = useState('moderate');
  const [occupation, setOccupation] = useState('');

  // Step 2 - Biomarkers
  const [biomarkers, setBiomarkers] = useState<Record<string, string>>({});

  // Step 3 - Lifestyle
  const [sleepHours, setSleepHours] = useState('7');
  const [sleepQuality, setSleepQuality] = useState(7);
  const [dietType, setDietType] = useState('omnivore');
  const [alcohol, setAlcohol] = useState('0');
  const [caffeine, setCaffeine] = useState('200');
  const [smoker, setSmoker] = useState(false);
  const [cardioMin, setCardioMin] = useState('0');
  const [strengthSessions, setStrengthSessions] = useState('0');
  const [conditions, setConditions] = useState<string[]>([]);
  const [supplements, setSupplements] = useState('');

  // Step 4 - Skip (genetics)

  // Step 5 - Goals
  const [goals, setGoals] = useState<string[]>([]);
  const [timeBudget, setTimeBudget] = useState(60);
  const [monthlyBudget, setMonthlyBudget] = useState(500);
  const [experimental, setExperimental] = useState('otc_only');

  const updateBiomarker = (code: string, val: string) => {
    setBiomarkers((prev) => ({ ...prev, [code]: val }));
  };

  const toggleCondition = (c: string) => {
    setConditions((prev) => prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]);
  };

  const toggleGoal = (g: string) => {
    setGoals((prev) => prev.includes(g) ? prev.filter((x) => x !== g) : [...prev, g]);
  };

  const canNext = () => {
    switch (step) {
      case 0: return age && parseInt(age) >= 18 && heightCm && weightKg;
      case 1: return true;
      case 2: return true;
      case 3: return true;
      case 4: return goals.length > 0;
      default: return false;
    }
  };

  const handleFinish = async () => {
    setLoading(true);
    setError('');

    const biomarkerValues = Object.entries(biomarkers)
      .filter(([, v]) => v && parseFloat(v) > 0)
      .map(([code, v]) => {
        const ref = BIOMARKER_DB.find((b) => b.code === code);
        return { code, value: parseFloat(v), unit: ref?.unit || '' };
      });

    const profileData = {
      age: parseInt(age), sex, heightCm: parseFloat(heightCm), weightKg: parseFloat(weightKg),
      activityLevel, occupation,
      sleepHoursAvg: parseFloat(sleepHours), sleepQuality, dietType,
      alcoholDrinksPerWeek: parseInt(alcohol), caffeineMgPerDay: parseInt(caffeine),
      smoker, cardioMinutesPerWeek: parseInt(cardioMin),
      strengthSessionsPerWeek: parseInt(strengthSessions),
      conditions, currentSupplements: supplements.split(',').map((s) => s.trim()).filter(Boolean),
      medications: [], allergies: [],
      goals, timeBudgetMin: timeBudget, monthlyBudgetRon: monthlyBudget,
      experimentalOpenness: experimental,
      onboardingCompleted: true, onboardingStep: 5,
    };

    try {
      // Save profile
      await fetch('/api/save-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(profileData),
      });

      // Save blood test
      if (biomarkerValues.length > 0) {
        await fetch('/api/save-bloodtest', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ biomarkers: biomarkerValues }),
        });
      }

      // Generate protocol
      const genRes = await fetch('/api/generate-protocol', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profile: profileData, biomarkers: biomarkerValues }),
      });

      if (!genRes.ok) throw new Error('Protocol generation failed');

      window.location.href = '/dashboard';
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Eroare. Încearcă din nou.');
      setLoading(false);
    }
  };

  const STEPS = ['Profil', 'Biomarkeri', 'Lifestyle', 'Genetică', 'Obiective'];

  if (loading) return <GeneratingScreen />;

  return (
    <div className="min-h-dvh flex flex-col">
      {/* Progress */}
      <div className="px-6 pt-6 pb-4 max-w-2xl mx-auto w-full">
        <div className="flex gap-1">
          {STEPS.map((s, i) => (
            <div key={s} className="flex-1 flex flex-col items-center gap-1">
              <div className={clsx('h-1 w-full rounded-full transition-all', i <= step ? 'bg-accent' : 'bg-card-border')} />
              <span className={clsx('text-[9px]', i <= step ? 'text-accent' : 'text-muted')}>{s}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 px-6 pb-6 max-w-2xl mx-auto w-full overflow-y-auto">
        {step === 0 && (
          <div className="space-y-5">
            <div>
              <h1 className="text-2xl font-bold">Cine ești?</h1>
              <p className="text-muted-foreground text-sm mt-1">Date de bază pentru calibrarea protocolului.</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground">Vârstă</label>
                <input type="number" value={age} onChange={(e) => setAge(e.target.value)} placeholder="25" min={18} max={100}
                  className="w-full mt-1 rounded-xl bg-card border border-card-border px-3 py-2.5 text-sm outline-none focus:border-accent font-mono" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Sex biologic</label>
                <div className="flex gap-2 mt-1">
                  {(['male', 'female'] as const).map((s) => (
                    <button key={s} onClick={() => setSex(s)}
                      className={clsx('flex-1 py-2.5 rounded-xl text-sm font-medium transition-all', sex === s ? 'bg-accent text-black' : 'bg-card border border-card-border text-muted-foreground')}>
                      {s === 'male' ? 'Masculin' : 'Feminin'}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Înălțime (cm)</label>
                <input type="number" value={heightCm} onChange={(e) => setHeightCm(e.target.value)} placeholder="180"
                  className="w-full mt-1 rounded-xl bg-card border border-card-border px-3 py-2.5 text-sm outline-none focus:border-accent font-mono" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Greutate (kg)</label>
                <input type="number" value={weightKg} onChange={(e) => setWeightKg(e.target.value)} placeholder="80"
                  className="w-full mt-1 rounded-xl bg-card border border-card-border px-3 py-2.5 text-sm outline-none focus:border-accent font-mono" />
              </div>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Ocupație</label>
              <input type="text" value={occupation} onChange={(e) => setOccupation(e.target.value)} placeholder="Software engineer, medic, student..."
                className="w-full mt-1 rounded-xl bg-card border border-card-border px-3 py-2.5 text-sm outline-none focus:border-accent" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-2 block">Nivel activitate</label>
              <div className="space-y-2">
                {ACTIVITY_LEVELS.map(({ value, label, desc }) => (
                  <button key={value} onClick={() => setActivityLevel(value)}
                    className={clsx('w-full p-3 rounded-xl text-left transition-all', activityLevel === value ? 'bg-accent/10 border border-accent/50' : 'bg-card border border-card-border')}>
                    <span className={clsx('text-sm font-medium', activityLevel === value ? 'text-accent' : '')}>{label}</span>
                    <span className="text-xs text-muted-foreground ml-2">{desc}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-5">
            <div>
              <h1 className="text-2xl font-bold">Biomarkerii tăi</h1>
              <p className="text-muted-foreground text-sm mt-1">Introdu valorile din analizele de sânge. <span className="text-accent">Opțional</span> — poți sări peste dacă nu ai analize recente.</p>
              <button onClick={() => setStep(2)} className="mt-2 px-4 py-2 rounded-xl bg-card border border-card-border text-sm text-muted-foreground hover:text-accent hover:border-accent/50 transition-colors">
                Nu am analize → Skip
              </button>
            </div>
            {BIOMARKER_CATEGORIES.map((cat) => (
              <div key={cat}>
                <h3 className="text-xs font-medium text-accent uppercase tracking-wider mb-2">{cat.replace(/_/g, ' ')}</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {BIOMARKER_DB.filter((b) => b.category === cat).map((b) => (
                    <div key={b.code} className="flex items-center gap-2 bg-card rounded-xl border border-card-border p-2.5">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium truncate">{b.shortName}</p>
                        <p className="text-[10px] text-muted">Optimal: {b.longevityOptimalLow}-{b.longevityOptimalHigh} {b.unit}</p>
                      </div>
                      <input type="number" value={biomarkers[b.code] || ''} onChange={(e) => updateBiomarker(b.code, e.target.value)}
                        placeholder={String(b.bryanJohnsonValue || '')} step="0.1"
                        className="w-20 rounded-lg bg-background border border-card-border px-2 py-1.5 text-sm text-right outline-none focus:border-accent font-mono" />
                      <span className="text-[10px] text-muted w-12">{b.unit}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
            <p className="text-xs text-muted-foreground">{Object.values(biomarkers).filter(Boolean).length} / 20 markeri completați</p>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-5">
            <div>
              <h1 className="text-2xl font-bold">Cum trăiești?</h1>
              <p className="text-muted-foreground text-sm mt-1">Stilul de viață influențează protocolul la fel de mult ca biomarkerii.</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground">Somn (ore/noapte)</label>
                <input type="number" value={sleepHours} onChange={(e) => setSleepHours(e.target.value)} step="0.5" min={3} max={12}
                  className="w-full mt-1 rounded-xl bg-card border border-card-border px-3 py-2.5 text-sm outline-none focus:border-accent font-mono" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Calitate somn (1-10)</label>
                <div className="flex gap-1 mt-1">
                  {[...Array(10)].map((_, i) => (
                    <button key={i} onClick={() => setSleepQuality(i + 1)}
                      className={clsx('flex-1 h-9 rounded-lg text-xs font-mono transition-all', sleepQuality === i + 1 ? 'bg-accent text-black' : i + 1 <= sleepQuality ? 'bg-accent/20 text-accent' : 'bg-card border border-card-border text-muted')}>
                      {i + 1}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-2 block">Dietă</label>
              <div className="flex flex-wrap gap-2">
                {DIET_TYPES.map((d) => (
                  <button key={d} onClick={() => setDietType(d)}
                    className={clsx('px-3 py-2 rounded-xl text-xs font-medium transition-all', dietType === d ? 'bg-accent text-black' : 'bg-card border border-card-border text-muted-foreground')}>
                    {d}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground">Alcool (drinks/săpt)</label>
                <input type="number" value={alcohol} onChange={(e) => setAlcohol(e.target.value)} min={0}
                  className="w-full mt-1 rounded-xl bg-card border border-card-border px-3 py-2.5 text-sm outline-none focus:border-accent font-mono" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Cafeină (mg/zi)</label>
                <input type="number" value={caffeine} onChange={(e) => setCaffeine(e.target.value)} min={0}
                  className="w-full mt-1 rounded-xl bg-card border border-card-border px-3 py-2.5 text-sm outline-none focus:border-accent font-mono" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Cardio (min/săpt)</label>
                <input type="number" value={cardioMin} onChange={(e) => setCardioMin(e.target.value)} min={0}
                  className="w-full mt-1 rounded-xl bg-card border border-card-border px-3 py-2.5 text-sm outline-none focus:border-accent font-mono" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Forță (sesiuni/săpt)</label>
                <input type="number" value={strengthSessions} onChange={(e) => setStrengthSessions(e.target.value)} min={0}
                  className="w-full mt-1 rounded-xl bg-card border border-card-border px-3 py-2.5 text-sm outline-none focus:border-accent font-mono" />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button onClick={() => setSmoker(!smoker)} className={clsx('w-6 h-6 rounded-lg border-2 flex items-center justify-center', smoker ? 'bg-danger border-danger' : 'border-card-border')}>
                {smoker && <span className="text-white text-xs">✓</span>}
              </button>
              <span className="text-sm">Fumător</span>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-2 block">Condiții diagnosticate</label>
              <div className="flex flex-wrap gap-2">
                {CONDITIONS.map((c) => (
                  <button key={c} onClick={() => toggleCondition(c)}
                    className={clsx('px-3 py-1.5 rounded-xl text-xs transition-all', conditions.includes(c) ? 'bg-warning/20 text-warning border border-warning/50' : 'bg-card border border-card-border text-muted-foreground')}>
                    {c}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Suplimente curente (separate cu virgulă)</label>
              <input type="text" value={supplements} onChange={(e) => setSupplements(e.target.value)} placeholder="Vitamina D, Omega-3, Magneziu..."
                className="w-full mt-1 rounded-xl bg-card border border-card-border px-3 py-2.5 text-sm outline-none focus:border-accent" />
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-5">
            <div>
              <h1 className="text-2xl font-bold">Genetică</h1>
              <p className="text-muted-foreground text-sm mt-1">Opțional — poți sări peste acest pas.</p>
            </div>
            <div className="rounded-2xl bg-card border border-card-border p-8 text-center space-y-4">
              <div className="text-4xl">🧬</div>
              <p className="text-sm text-muted-foreground">Upload-ul datelor genetice (23andMe, AncestryDNA) va fi disponibil în curând.</p>
              <p className="text-xs text-muted">Vom analiza APOE, MTHFR, FTO, CYP1A2, VDR, COMT și alte SNP-uri relevante pentru longevitate.</p>
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-5">
            <div>
              <h1 className="text-2xl font-bold">Obiectivele tale</h1>
              <p className="text-muted-foreground text-sm mt-1">Ce vrei să optimizezi? Selectează cel puțin 1.</p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {GOALS.map((g) => (
                <button key={g} onClick={() => toggleGoal(g)}
                  className={clsx('p-3 rounded-xl text-sm text-left transition-all', goals.includes(g) ? 'bg-accent/10 border border-accent/50 text-accent' : 'bg-card border border-card-border text-muted-foreground')}>
                  {g}
                </button>
              ))}
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Timp disponibil pe zi</label>
              <div className="flex gap-2 mt-1">
                {[{ v: 30, l: '<30 min' }, { v: 60, l: '30-60 min' }, { v: 120, l: '1-2 ore' }, { v: 180, l: '2+ ore' }].map(({ v, l }) => (
                  <button key={v} onClick={() => setTimeBudget(v)}
                    className={clsx('flex-1 py-2 rounded-xl text-xs font-medium transition-all', timeBudget === v ? 'bg-accent text-black' : 'bg-card border border-card-border text-muted-foreground')}>
                    {l}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Buget lunar (RON)</label>
              <div className="flex gap-2 mt-1">
                {[{ v: 200, l: '<200' }, { v: 500, l: '200-500' }, { v: 1500, l: '500-1500' }, { v: 5000, l: '1500+' }].map(({ v, l }) => (
                  <button key={v} onClick={() => setMonthlyBudget(v)}
                    className={clsx('flex-1 py-2 rounded-xl text-xs font-medium transition-all', monthlyBudget === v ? 'bg-accent text-black' : 'bg-card border border-card-border text-muted-foreground')}>
                    {l} RON
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-2 block">Deschidere experimentală</label>
              <div className="space-y-2">
                {[
                  { v: 'otc_only', l: 'Doar OTC', d: 'Suplimente disponibile fără rețetă' },
                  { v: 'open_rx', l: 'Deschis la Rx', d: 'Inclusiv discuții despre medicamente prescrise' },
                  { v: 'open_experimental', l: 'Experimental', d: 'Peptide, terapii avansate, off-label' },
                ].map(({ v, l, d }) => (
                  <button key={v} onClick={() => setExperimental(v)}
                    className={clsx('w-full p-3 rounded-xl text-left transition-all', experimental === v ? 'bg-accent/10 border border-accent/50' : 'bg-card border border-card-border')}>
                    <span className={clsx('text-sm font-medium', experimental === v ? 'text-accent' : '')}>{l}</span>
                    <span className="text-xs text-muted-foreground ml-2">{d}</span>
                  </button>
                ))}
              </div>
            </div>
            {error && <p className="text-sm text-danger">{error}</p>}
          </div>
        )}
      </div>

      {/* Navigation */}
      <div className="px-6 pb-8 max-w-2xl mx-auto w-full flex gap-3">
        {step > 0 && (
          <button onClick={() => setStep(step - 1)} className="px-4 py-3 rounded-xl bg-card border border-card-border text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
            ← Înapoi
          </button>
        )}
        <button
          onClick={() => step < 4 ? setStep(step + 1) : handleFinish()}
          disabled={!canNext() || loading}
          className="flex-1 py-3 rounded-xl bg-accent text-black font-semibold text-sm transition-all hover:bg-accent-dim active:scale-[0.98] disabled:opacity-40">
          {loading ? '⟳ Generez protocolul tău...' : step < 4 ? 'Continuă →' : '⚡ Generează Protocol'}
        </button>
      </div>
    </div>
  );
}
