'use client';

import { useState, useRef } from 'react';
import { BIOMARKER_DB, BIG_11_CODES, BIOMARKER_CATEGORIES, CATEGORY_LABELS } from '@/lib/engine/biomarkers';
import { classifyBiomarker, getClassificationColor } from '@/lib/engine/classifier';
import { GeneratingScreen } from '@/components/protocol/GeneratingScreen';
import { Upload, FileText, ChevronDown, ChevronUp } from 'lucide-react';
import clsx from 'clsx';

const CONDITIONS = ['Type 2 Diabetes', 'Hypertension', 'Dyslipidemia', 'Thyroid', 'Autoimmune', 'Cardiovascular', 'Depression/Anxiety', 'Sleep Apnea', 'PCOS', 'Obesity'];
const GOALS = ['Longevity / Healthspan', 'Body Composition', 'Cognitive Performance', 'Skin / Hair', 'Energy / Mood', 'Athletic Performance', 'Fertility', 'Fitness Recovery'];
const STEPS = ['The Basics', 'Blood Work', 'Lifestyle', 'Goals'];

export default function OnboardingPage() {
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Step 1
  const [age, setAge] = useState('');
  const [sex, setSex] = useState<'male' | 'female'>('male');
  const [heightCm, setHeightCm] = useState('');
  const [weightKg, setWeightKg] = useState('');
  const [activityLevel, setActivityLevel] = useState(3);
  const [hasBloodWork, setHasBloodWork] = useState<null | boolean>(null);

  // Step 2
  const [biomarkers, setBiomarkers] = useState<Record<string, string>>({});
  const [showAllMarkers, setShowAllMarkers] = useState(false);
  const [pdfParsing, setPdfParsing] = useState(false);
  const [pdfParsed, setPdfParsed] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Step 3
  const [sleepHours, setSleepHours] = useState('7');
  const [sleepQuality, setSleepQuality] = useState(7);
  const [dietType, setDietType] = useState('omnivore');
  const [alcohol, setAlcohol] = useState(false);
  const [caffeine, setCaffeine] = useState(true);
  const [smoker, setSmoker] = useState(false);
  const [exerciseHours, setExerciseHours] = useState('3');
  const [conditions, setConditions] = useState<string[]>([]);
  const [medications, setMedications] = useState('');
  const [supplements, setSupplements] = useState('');

  // Step 4
  const [goals, setGoals] = useState<string[]>([]);
  const [timeBudget, setTimeBudget] = useState(60);
  const [monthlyBudget, setMonthlyBudget] = useState(500);
  const [experimental, setExperimental] = useState('otc_only');

  const activityLabels = ['Sedentary', 'Light', 'Moderate', 'Active', 'Athlete'];

  const updateBiomarker = (code: string, val: string) => {
    setBiomarkers((prev) => ({ ...prev, [code]: val }));
  };

  const getLiveClassification = (code: string, val: string) => {
    if (!val || parseFloat(val) <= 0) return null;
    const ref = BIOMARKER_DB.find(b => b.code === code);
    if (!ref) return null;
    const classified = classifyBiomarker({ code, value: parseFloat(val), unit: ref.unit });
    return classified.classification;
  };

  const handlePdfUpload = async (file: File) => {
    setPdfParsing(true);
    setError('');
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/parse-bloodwork', { method: 'POST', body: formData });
      if (!res.ok) throw new Error('PDF parsing failed');
      const { biomarkers: parsed } = await res.json();
      const newBiomarkers: Record<string, string> = {};
      for (const b of parsed) {
        if (b.code && b.code !== 'UNKNOWN' && b.value) {
          newBiomarkers[b.code] = String(b.value);
        }
      }
      setBiomarkers(prev => ({ ...prev, ...newBiomarkers }));
      setPdfParsed(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to parse PDF');
    }
    setPdfParsing(false);
  };

  const canNext = () => {
    switch (step) {
      case 0: return age && parseInt(age) >= 10 && heightCm && weightKg && hasBloodWork !== null;
      case 1: return true;
      case 2: return true;
      case 3: return goals.length > 0;
      default: return false;
    }
  };

  const saveProgress = async (stepNum: number) => {
    const profileData = buildProfileData();
    profileData.onboardingStep = stepNum;
    profileData.onboardingCompleted = false;
    await fetch('/api/save-profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(profileData),
    });
  };

  const buildProfileData = () => ({
    age: parseInt(age) || 25, sex, heightCm: parseFloat(heightCm) || 175, weightKg: parseFloat(weightKg) || 75,
    activityLevel: ['sedentary', 'light', 'moderate', 'active', 'elite'][activityLevel],
    occupation: '',
    sleepHoursAvg: parseFloat(sleepHours), sleepQuality, dietType,
    alcoholDrinksPerWeek: alcohol ? 5 : 0, caffeineMgPerDay: caffeine ? 200 : 0,
    smoker, cardioMinutesPerWeek: Math.round(parseFloat(exerciseHours || '0') * 60 * 0.5),
    strengthSessionsPerWeek: Math.round(parseFloat(exerciseHours || '0') * 0.5),
    conditions, medications: medications ? [{ name: medications, dose: '', frequency: 'daily' }] : [],
    currentSupplements: supplements.split(',').map(s => s.trim()).filter(Boolean),
    allergies: [],
    goals, timeBudgetMin: timeBudget, monthlyBudgetRon: monthlyBudget,
    experimentalOpenness: experimental,
    onboardingCompleted: false, onboardingStep: step,
  });

  const handleNext = async () => {
    if (step === 0 && hasBloodWork === false) {
      await saveProgress(0);
      setStep(2); // skip blood work
    } else {
      await saveProgress(step);
      setStep(step + 1);
    }
  };

  const handleFinish = async () => {
    setLoading(true);
    setError('');

    const biomarkerValues = Object.entries(biomarkers)
      .filter(([, v]) => v && parseFloat(v) > 0)
      .map(([code, v]) => {
        const ref = BIOMARKER_DB.find(b => b.code === code);
        return { code, value: parseFloat(v), unit: ref?.unit || '' };
      });

    const profileData = { ...buildProfileData(), onboardingCompleted: true, onboardingStep: 4 };

    try {
      await fetch('/api/save-profile', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(profileData) });
      if (biomarkerValues.length > 0) {
        await fetch('/api/save-bloodtest', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ biomarkers: biomarkerValues }) });
      }
      const genRes = await fetch('/api/generate-protocol', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ profile: profileData, biomarkers: biomarkerValues }) });
      if (!genRes.ok) throw new Error('Protocol generation failed');
      window.location.href = '/dashboard';
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error. Try again.');
      setLoading(false);
    }
  };

  if (loading) return <GeneratingScreen />;

  const markersToShow = showAllMarkers ? BIOMARKER_DB : BIOMARKER_DB.filter(b => BIG_11_CODES.includes(b.code));
  const filledCount = Object.values(biomarkers).filter(Boolean).length;

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

      <div className="flex-1 px-6 pb-6 max-w-2xl mx-auto w-full overflow-y-auto">
        {/* STEP 1 — The Basics */}
        {step === 0 && (
          <div className="space-y-5">
            <div>
              <h1 className="text-2xl font-bold">The Basics</h1>
              <p className="text-muted-foreground text-sm mt-1">Takes 30 seconds. We need this to calibrate your protocol.</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground">Age</label>
                <input type="number" value={age} onChange={e => setAge(e.target.value)} placeholder="25" className="w-full mt-1 rounded-xl bg-card border border-card-border px-3 py-2.5 text-sm outline-none focus:border-accent font-mono" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Biological Sex</label>
                <div className="flex gap-2 mt-1">
                  {(['male', 'female'] as const).map(s => (
                    <button key={s} onClick={() => setSex(s)} className={clsx('flex-1 py-2.5 rounded-xl text-sm font-medium transition-all', sex === s ? 'bg-accent text-black' : 'bg-card border border-card-border text-muted-foreground')}>
                      {s === 'male' ? 'Male' : 'Female'}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Height (cm)</label>
                <input type="number" value={heightCm} onChange={e => setHeightCm(e.target.value)} placeholder="180" className="w-full mt-1 rounded-xl bg-card border border-card-border px-3 py-2.5 text-sm outline-none focus:border-accent font-mono" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Weight (kg)</label>
                <input type="number" value={weightKg} onChange={e => setWeightKg(e.target.value)} placeholder="80" className="w-full mt-1 rounded-xl bg-card border border-card-border px-3 py-2.5 text-sm outline-none focus:border-accent font-mono" />
              </div>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-2 block">Activity Level: <span className="text-accent font-medium">{activityLabels[activityLevel]}</span></label>
              <input type="range" min={0} max={4} value={activityLevel} onChange={e => setActivityLevel(parseInt(e.target.value))}
                className="w-full h-2 bg-card-border rounded-lg appearance-none cursor-pointer accent-[#00ff88]" />
              <div className="flex justify-between text-[9px] text-muted mt-1">
                {activityLabels.map(l => <span key={l}>{l}</span>)}
              </div>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-2 block">Do you have recent blood work?</label>
              <div className="flex gap-3">
                {[{ v: true, l: 'Yes, I have results' }, { v: false, l: 'No, skip this' }].map(({ v, l }) => (
                  <button key={String(v)} onClick={() => setHasBloodWork(v)}
                    className={clsx('flex-1 py-3 rounded-xl text-sm font-medium transition-all', hasBloodWork === v ? 'bg-accent text-black' : 'bg-card border border-card-border text-muted-foreground')}>
                    {l}
                  </button>
                ))}
              </div>
              {hasBloodWork === false && <p className="text-xs text-muted-foreground mt-2">Your protocol will be lifestyle-based. For better results, get a panel at Synevo (~150 RON).</p>}
            </div>
          </div>
        )}

        {/* STEP 2 — Blood Work */}
        {step === 1 && (
          <div className="space-y-5">
            <div>
              <h1 className="text-2xl font-bold">Your Blood Work</h1>
              <p className="text-muted-foreground text-sm mt-1">Upload a PDF or enter values manually.</p>
            </div>

            {/* PDF Upload */}
            <div className={clsx('border-2 border-dashed rounded-2xl p-8 text-center transition-all cursor-pointer hover:border-accent/50', pdfParsed ? 'border-accent/50 bg-accent/5' : 'border-card-border')}
              onClick={() => fileInputRef.current?.click()}>
              <input ref={fileInputRef} type="file" accept=".pdf" className="hidden" onChange={e => e.target.files?.[0] && handlePdfUpload(e.target.files[0])} />
              {pdfParsing ? (
                <div className="space-y-3">
                  <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin mx-auto" />
                  <p className="text-sm text-accent">Parsing your lab report with AI...</p>
                </div>
              ) : pdfParsed ? (
                <div className="space-y-2">
                  <FileText className="w-10 h-10 text-accent mx-auto" />
                  <p className="text-sm text-accent font-medium">PDF parsed! {filledCount} biomarkers detected</p>
                  <p className="text-xs text-muted-foreground">Review values below. Click to upload a different file.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  <Upload className="w-10 h-10 text-muted-foreground mx-auto" />
                  <p className="text-sm font-medium">Drop your lab report PDF here</p>
                  <p className="text-xs text-muted-foreground">Supports Synevo, Regina Maria, MedLife, LabCorp, Quest</p>
                </div>
              )}
            </div>

            {/* Manual entry */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">{pdfParsed ? 'Verify & edit values:' : 'Or enter manually:'}</p>
                <p className="text-xs text-accent font-mono">{filledCount} markers</p>
              </div>

              {/* Big 11 first */}
              <p className="text-[10px] text-accent uppercase tracking-wider">Core markers (Big 11)</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {BIOMARKER_DB.filter(b => BIG_11_CODES.includes(b.code)).map(b => {
                  const cls = getLiveClassification(b.code, biomarkers[b.code] || '');
                  return (
                    <div key={b.code} className={clsx('flex items-center gap-2 rounded-xl border p-2.5 transition-colors', cls ? 'border-card-border' : 'border-card-border')}>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium truncate">{b.shortName}</p>
                        <p className="text-[10px] text-muted">Optimal: {b.longevityOptimalLow}-{b.longevityOptimalHigh}</p>
                      </div>
                      <input type="number" value={biomarkers[b.code] || ''} onChange={e => updateBiomarker(b.code, e.target.value)}
                        placeholder={b.bryanJohnsonValue ? String(b.bryanJohnsonValue) : ''} step="0.1"
                        className="w-20 rounded-lg bg-background border border-card-border px-2 py-1.5 text-sm text-right outline-none focus:border-accent font-mono" />
                      <span className="text-[10px] text-muted w-14">{b.unit}</span>
                      {cls && <span className={clsx('w-2 h-2 rounded-full', cls === 'OPTIMAL' ? 'bg-accent' : cls.includes('SUBOPTIMAL') ? 'bg-amber-400' : 'bg-red-400')} />}
                    </div>
                  );
                })}
              </div>

              {/* Show more toggle */}
              <button onClick={() => setShowAllMarkers(!showAllMarkers)}
                className="flex items-center gap-1 text-xs text-accent hover:underline mx-auto">
                {showAllMarkers ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                {showAllMarkers ? 'Show less' : `Show all ${BIOMARKER_DB.length} markers`}
              </button>

              {showAllMarkers && (
                <div className="space-y-4">
                  {BIOMARKER_CATEGORIES.filter(cat => !['INFLAMMATION', 'GLUCOSE_INSULIN', 'LIPIDS'].includes(cat) || true).map(cat => {
                    const catMarkers = BIOMARKER_DB.filter(b => b.category === cat && !BIG_11_CODES.includes(b.code));
                    if (catMarkers.length === 0) return null;
                    return (
                      <div key={cat}>
                        <p className="text-[10px] text-accent uppercase tracking-wider mb-1.5">{CATEGORY_LABELS[cat] || cat}</p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {catMarkers.map(b => {
                            const cls = getLiveClassification(b.code, biomarkers[b.code] || '');
                            return (
                              <div key={b.code} className="flex items-center gap-2 bg-card rounded-xl border border-card-border p-2.5">
                                <div className="flex-1 min-w-0">
                                  <p className="text-xs font-medium truncate">{b.shortName}</p>
                                  <p className="text-[10px] text-muted">{b.longevityOptimalLow}-{b.longevityOptimalHigh} {b.unit}</p>
                                </div>
                                <input type="number" value={biomarkers[b.code] || ''} onChange={e => updateBiomarker(b.code, e.target.value)}
                                  placeholder={b.bryanJohnsonValue ? String(b.bryanJohnsonValue) : ''} step="0.1"
                                  className="w-20 rounded-lg bg-background border border-card-border px-2 py-1.5 text-sm text-right outline-none focus:border-accent font-mono" />
                                <span className="text-[10px] text-muted w-12">{b.unit}</span>
                                {cls && <span className={clsx('w-2 h-2 rounded-full', cls === 'OPTIMAL' ? 'bg-accent' : cls.includes('SUBOPTIMAL') ? 'bg-amber-400' : 'bg-red-400')} />}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* STEP 3 — Lifestyle */}
        {step === 2 && (
          <div className="space-y-5">
            <div>
              <h1 className="text-2xl font-bold">Your Lifestyle</h1>
              <p className="text-muted-foreground text-sm mt-1">45 seconds. This shapes your protocol as much as blood work.</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground">Sleep (hours/night)</label>
                <input type="number" value={sleepHours} onChange={e => setSleepHours(e.target.value)} step="0.5" className="w-full mt-1 rounded-xl bg-card border border-card-border px-3 py-2.5 text-sm outline-none focus:border-accent font-mono" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Sleep Quality (1-10)</label>
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
              <label className="text-xs text-muted-foreground mb-2 block">Diet</label>
              <div className="flex flex-wrap gap-2">
                {['omnivore', 'vegetarian', 'vegan', 'keto', 'carnivore', 'mediterranean'].map(d => (
                  <button key={d} onClick={() => setDietType(d)}
                    className={clsx('px-3 py-2 rounded-xl text-xs font-medium transition-all capitalize', dietType === d ? 'bg-accent text-black' : 'bg-card border border-card-border text-muted-foreground')}>
                    {d}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Exercise (hours/week)</label>
              <input type="number" value={exerciseHours} onChange={e => setExerciseHours(e.target.value)} step="0.5" className="w-full mt-1 rounded-xl bg-card border border-card-border px-3 py-2.5 text-sm outline-none focus:border-accent font-mono" />
            </div>
            <div className="flex gap-4">
              {[{ label: 'Alcohol', val: alcohol, set: setAlcohol }, { label: 'Caffeine', val: caffeine, set: setCaffeine }, { label: 'Smoker', val: smoker, set: setSmoker }].map(({ label, val, set }) => (
                <button key={label} onClick={() => set(!val)} className={clsx('flex items-center gap-2 px-3 py-2 rounded-xl text-xs transition-all', val ? 'bg-warning/20 text-warning border border-warning/30' : 'bg-card border border-card-border text-muted-foreground')}>
                  <div className={clsx('w-4 h-4 rounded border-2 flex items-center justify-center text-[10px]', val ? 'bg-warning border-warning text-black' : 'border-card-border')}>{val ? '✓' : ''}</div>
                  {label}
                </button>
              ))}
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-2 block">Conditions</label>
              <div className="flex flex-wrap gap-2">
                {CONDITIONS.map(c => (
                  <button key={c} onClick={() => setConditions(prev => prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c])}
                    className={clsx('px-3 py-1.5 rounded-xl text-xs transition-all', conditions.includes(c) ? 'bg-warning/20 text-warning border border-warning/50' : 'bg-card border border-card-border text-muted-foreground')}>
                    {c}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Current medications</label>
              <input type="text" value={medications} onChange={e => setMedications(e.target.value)} placeholder="Metformin, Levothyroxine..."
                className="w-full mt-1 rounded-xl bg-card border border-card-border px-3 py-2.5 text-sm outline-none focus:border-accent" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Current supplements</label>
              <input type="text" value={supplements} onChange={e => setSupplements(e.target.value)} placeholder="Vitamin D, Omega-3, Magnesium..."
                className="w-full mt-1 rounded-xl bg-card border border-card-border px-3 py-2.5 text-sm outline-none focus:border-accent" />
            </div>
          </div>
        )}

        {/* STEP 4 — Goals */}
        {step === 3 && (
          <div className="space-y-5">
            <div>
              <h1 className="text-2xl font-bold">Your Goals</h1>
              <p className="text-muted-foreground text-sm mt-1">15 seconds. What matters most to you?</p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {GOALS.map(g => (
                <button key={g} onClick={() => setGoals(prev => prev.includes(g) ? prev.filter(x => x !== g) : [...prev, g])}
                  className={clsx('p-3 rounded-xl text-sm text-left transition-all', goals.includes(g) ? 'bg-accent/10 border border-accent/50 text-accent' : 'bg-card border border-card-border text-muted-foreground')}>
                  {g}
                </button>
              ))}
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-2 block">Time available per day</label>
              <div className="flex gap-2">
                {[{ v: 30, l: '<30 min' }, { v: 60, l: '30-60 min' }, { v: 120, l: '1-2 hours' }, { v: 180, l: '2+ hours' }].map(({ v, l }) => (
                  <button key={v} onClick={() => setTimeBudget(v)} className={clsx('flex-1 py-2 rounded-xl text-xs font-medium transition-all', timeBudget === v ? 'bg-accent text-black' : 'bg-card border border-card-border text-muted-foreground')}>{l}</button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-2 block">Monthly budget (RON)</label>
              <div className="flex gap-2">
                {[{ v: 200, l: '<200' }, { v: 500, l: '200-500' }, { v: 1500, l: '500-1500' }, { v: 5000, l: '1500+' }].map(({ v, l }) => (
                  <button key={v} onClick={() => setMonthlyBudget(v)} className={clsx('flex-1 py-2 rounded-xl text-xs font-medium transition-all', monthlyBudget === v ? 'bg-accent text-black' : 'bg-card border border-card-border text-muted-foreground')}>{l} RON</button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-2 block">Experimental openness</label>
              <div className="space-y-2">
                {[{ v: 'otc_only', l: 'OTC Only', d: 'Supplements available without prescription' }, { v: 'open_rx', l: 'Open to Rx', d: 'Including prescription medication discussion' }, { v: 'open_experimental', l: 'Experimental', d: 'Peptides, advanced therapies, off-label' }].map(({ v, l, d }) => (
                  <button key={v} onClick={() => setExperimental(v)} className={clsx('w-full p-3 rounded-xl text-left transition-all', experimental === v ? 'bg-accent/10 border border-accent/50' : 'bg-card border border-card-border')}>
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
      <div className="sticky bottom-16 md:bottom-0 z-30 bg-background/90 backdrop-blur-xl border-t border-card-border px-6 py-4 max-w-2xl mx-auto w-full flex gap-3">
        {step > 0 && (
          <button onClick={() => setStep(step === 2 && hasBloodWork === false ? 0 : step - 1)} className="px-4 py-3 rounded-xl bg-card border border-card-border text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
            ← Back
          </button>
        )}
        <button
          onClick={() => step < 3 ? handleNext() : handleFinish()}
          disabled={!canNext() || loading}
          className="flex-1 py-3 rounded-xl bg-accent text-black font-semibold text-sm transition-all hover:bg-accent-dim active:scale-[0.98] disabled:opacity-40">
          {step < 3 ? 'Continue →' : '⚡ Generate Protocol'}
        </button>
      </div>
    </div>
  );
}
