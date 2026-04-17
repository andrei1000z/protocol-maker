'use client';

import { useState, useRef, useEffect } from 'react';
import { BIOMARKER_DB, BIG_11_CODES, BIOMARKER_CATEGORIES, CATEGORY_LABELS } from '@/lib/engine/biomarkers';
import { classifyBiomarker } from '@/lib/engine/classifier';
import { GeneratingScreen } from '@/components/protocol/GeneratingScreen';
import { Upload, FileText, ChevronDown, ChevronUp, Plus, X } from 'lucide-react';
import clsx from 'clsx';

const CONDITIONS = ['Type 2 Diabetes', 'Hypertension', 'Dyslipidemia', 'Thyroid', 'Autoimmune', 'Cardiovascular', 'Depression/Anxiety', 'Sleep Apnea', 'PCOS', 'Obesity'];
const FAMILY_CONDITIONS = ['Diabetes', 'Heart disease', 'Cancer', "Alzheimer's", 'Autoimmune', 'Mental illness', 'None known'];
const GOALS = ['Longevity / Healthspan', 'Body Composition', 'Cognitive Performance', 'Skin / Hair', 'Energy / Mood', 'Athletic Performance', 'Fertility', 'Fitness Recovery', 'Sleep', 'Mental Health'];
const SLEEP_ISSUES = ['Trouble falling asleep', 'Waking in the night', 'Wake up unrested', 'Snoring', 'Restless legs', 'None'];
const STEPS = ['Basics', 'Blood Work', 'Lifestyle', 'Day-to-Day', 'Goals'];

interface Medication { name: string; dose: string; frequency: string; }

export default function OnboardingPage() {
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [restored, setRestored] = useState(false);

  // Step 1 — Basics
  const [age, setAge] = useState('');
  const [sex, setSex] = useState<'male' | 'female'>('male');
  const [heightCm, setHeightCm] = useState('');
  const [weightKg, setWeightKg] = useState('');
  const [activityLevel, setActivityLevel] = useState(3);
  const [ethnicity, setEthnicity] = useState('');
  const [occupation, setOccupation] = useState('desk');
  const [restingHR, setRestingHR] = useState('');
  const [hasBloodWork, setHasBloodWork] = useState<null | boolean>(null);

  // Step 2 — Biomarkers
  const [biomarkers, setBiomarkers] = useState<Record<string, string>>({});
  const [showAllMarkers, setShowAllMarkers] = useState(false);
  const [pdfParsing, setPdfParsing] = useState(false);
  const [pdfParsed, setPdfParsed] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Step 3 — Lifestyle
  const [sleepHours, setSleepHours] = useState('7');
  const [sleepQuality, setSleepQuality] = useState(7);
  const [bedtime, setBedtime] = useState('23:00');
  const [wakeTime, setWakeTime] = useState('07:00');
  const [chronotype, setChronotype] = useState<'morning' | 'neutral' | 'night'>('neutral');
  const [sleepIssues, setSleepIssues] = useState<string[]>([]);
  const [dietType, setDietType] = useState('omnivore');
  const [mealsPerDay, setMealsPerDay] = useState(3);
  const [hydration, setHydration] = useState(6);
  const [foodAllergies, setFoodAllergies] = useState<string[]>([]);
  const [alcoholPerWeek, setAlcoholPerWeek] = useState(0);
  const [caffeineServings, setCaffeineServings] = useState(2);
  const [smoker, setSmoker] = useState(false);
  const [cardioMin, setCardioMin] = useState(90);
  const [strengthSessions, setStrengthSessions] = useState(2);
  const [stressLevel, setStressLevel] = useState(5);
  const [meditationPractice, setMeditationPractice] = useState<'none' | 'occasional' | 'daily'>('none');
  const [conditions, setConditions] = useState<string[]>([]);
  const [familyHistory, setFamilyHistory] = useState<string[]>([]);
  const [medications, setMedications] = useState<Medication[]>([]);
  const [supplements, setSupplements] = useState('');
  const [lifestyleExpanded, setLifestyleExpanded] = useState({ sleep: false, diet: false, exercise: false, mental: false, medical: false });

  // Step 4 — Day-to-Day
  const [workStart, setWorkStart] = useState('09:00');
  const [workEnd, setWorkEnd] = useState('18:00');
  const [workLocation, setWorkLocation] = useState<'home' | 'office' | 'hybrid'>('hybrid');
  const [sittingHours, setSittingHours] = useState(6);
  const [exerciseWindow, setExerciseWindow] = useState<'morning' | 'lunch' | 'evening' | 'weekends' | 'inconsistent'>('evening');
  const [screenTime, setScreenTime] = useState(6);
  const [painPoints, setPainPoints] = useState('');
  const [nonNegotiables, setNonNegotiables] = useState('');

  // Step 5 — Goals
  const [primaryGoal, setPrimaryGoal] = useState('Longevity / Healthspan');
  const [secondaryGoals, setSecondaryGoals] = useState<string[]>([]);
  const [specificTarget, setSpecificTarget] = useState('');
  const [timelineMonths, setTimelineMonths] = useState(3);
  const [timeBudget, setTimeBudget] = useState(60);
  const [monthlyBudget, setMonthlyBudget] = useState(500);
  const [experimental, setExperimental] = useState('otc_only');

  // Restore saved state on mount
  useEffect(() => {
    if (restored) return;
    fetch('/api/my-data').then(r => r.json()).then(d => {
      if (d.profile?.onboarding_data) {
        const od = d.profile.onboarding_data;
        if (od.age) setAge(String(od.age));
        if (od.sex) setSex(od.sex);
        if (od.heightCm) setHeightCm(String(od.heightCm));
        if (od.weightKg) setWeightKg(String(od.weightKg));
        if (od.activityLevel !== undefined) setActivityLevel(od.activityLevel);
        if (od.ethnicity) setEthnicity(od.ethnicity);
        if (od.occupation) setOccupation(od.occupation);
        if (od.restingHR) setRestingHR(String(od.restingHR));
        if (od.hasBloodWork !== undefined) setHasBloodWork(od.hasBloodWork);
        if (od.biomarkers) setBiomarkers(od.biomarkers);
        if (od.sleepHours) setSleepHours(String(od.sleepHours));
        if (od.sleepQuality) setSleepQuality(od.sleepQuality);
        if (od.bedtime) setBedtime(od.bedtime);
        if (od.wakeTime) setWakeTime(od.wakeTime);
        if (od.chronotype) setChronotype(od.chronotype);
        if (od.sleepIssues) setSleepIssues(od.sleepIssues);
        if (od.dietType) setDietType(od.dietType);
        if (od.mealsPerDay) setMealsPerDay(od.mealsPerDay);
        if (od.hydration) setHydration(od.hydration);
        if (od.foodAllergies) setFoodAllergies(od.foodAllergies);
        if (od.alcoholPerWeek !== undefined) setAlcoholPerWeek(od.alcoholPerWeek);
        if (od.caffeineServings !== undefined) setCaffeineServings(od.caffeineServings);
        if (od.smoker !== undefined) setSmoker(od.smoker);
        if (od.cardioMin !== undefined) setCardioMin(od.cardioMin);
        if (od.strengthSessions !== undefined) setStrengthSessions(od.strengthSessions);
        if (od.stressLevel) setStressLevel(od.stressLevel);
        if (od.meditationPractice) setMeditationPractice(od.meditationPractice);
        if (od.conditions) setConditions(od.conditions);
        if (od.familyHistory) setFamilyHistory(od.familyHistory);
        if (od.medications) setMedications(od.medications);
        if (od.supplements) setSupplements(od.supplements);
        if (od.workStart) setWorkStart(od.workStart);
        if (od.workEnd) setWorkEnd(od.workEnd);
        if (od.workLocation) setWorkLocation(od.workLocation);
        if (od.sittingHours) setSittingHours(od.sittingHours);
        if (od.exerciseWindow) setExerciseWindow(od.exerciseWindow);
        if (od.screenTime) setScreenTime(od.screenTime);
        if (od.painPoints) setPainPoints(od.painPoints);
        if (od.nonNegotiables) setNonNegotiables(od.nonNegotiables);
        if (od.primaryGoal) setPrimaryGoal(od.primaryGoal);
        if (od.secondaryGoals) setSecondaryGoals(od.secondaryGoals);
        if (od.specificTarget) setSpecificTarget(od.specificTarget);
        if (od.timelineMonths) setTimelineMonths(od.timelineMonths);
        if (od.timeBudget) setTimeBudget(od.timeBudget);
        if (od.monthlyBudget) setMonthlyBudget(od.monthlyBudget);
        if (od.experimental) setExperimental(od.experimental);
        if (typeof d.profile.onboarding_step === 'number' && d.profile.onboarding_step < 5) {
          setStep(d.profile.onboarding_step);
        }
      }
      setRestored(true);
    }).catch(() => setRestored(true));
  }, [restored]);

  const activityLabels = ['Sedentary', 'Light', 'Moderate', 'Active', 'Athlete'];

  const updateBiomarker = (code: string, val: string) => setBiomarkers(prev => ({ ...prev, [code]: val }));
  const toggle = <T,>(setter: (f: (p: T[]) => T[]) => void, val: T) => setter(prev => prev.includes(val) ? prev.filter(x => x !== val) : [...prev, val]);
  const getLiveClassification = (code: string, val: string) => {
    if (!val || parseFloat(val) <= 0) return null;
    const ref = BIOMARKER_DB.find(b => b.code === code);
    if (!ref) return null;
    return classifyBiomarker({ code, value: parseFloat(val), unit: ref.unit }).classification;
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
        if (b.code && b.code !== 'UNKNOWN' && b.value) newBiomarkers[b.code] = String(b.value);
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
      case 1: case 2: case 3: return true;
      case 4: return primaryGoal !== '';
      default: return false;
    }
  };

  const buildOnboardingData = () => ({
    age: parseInt(age) || 25, sex, heightCm: parseFloat(heightCm) || 175, weightKg: parseFloat(weightKg) || 75,
    activityLevel, ethnicity, occupation, restingHR: restingHR ? parseInt(restingHR) : null, hasBloodWork,
    biomarkers,
    sleepHours: parseFloat(sleepHours), sleepQuality, bedtime, wakeTime, chronotype, sleepIssues,
    dietType, mealsPerDay, hydration, foodAllergies,
    alcoholPerWeek, caffeineServings, smoker,
    cardioMin, strengthSessions,
    stressLevel, meditationPractice,
    conditions, familyHistory, medications, supplements,
    workStart, workEnd, workLocation, sittingHours, exerciseWindow, screenTime,
    painPoints, nonNegotiables,
    primaryGoal, secondaryGoals, specificTarget, timelineMonths,
    timeBudget, monthlyBudget, experimental,
  });

  const buildProfileData = (completed = false, stepNum = step) => {
    const data = buildOnboardingData();
    return {
      age: data.age, sex, heightCm: data.heightCm, weightKg: data.weightKg,
      activityLevel: ['sedentary', 'light', 'moderate', 'active', 'elite'][activityLevel],
      occupation, ethnicity,
      sleepHoursAvg: data.sleepHours, sleepQuality, dietType,
      alcoholDrinksPerWeek: alcoholPerWeek, caffeineMgPerDay: caffeineServings * 80,
      smoker, cardioMinutesPerWeek: cardioMin, strengthSessionsPerWeek: strengthSessions,
      conditions,
      medications: medications.filter(m => m.name.trim()),
      currentSupplements: supplements.split(',').map(s => s.trim()).filter(Boolean),
      allergies: foodAllergies,
      goals: [primaryGoal, ...secondaryGoals].filter(Boolean),
      timeBudgetMin: timeBudget, monthlyBudgetRon: monthlyBudget,
      experimentalOpenness: experimental,
      onboardingCompleted: completed, onboardingStep: stepNum,
      onboardingData: data,
    };
  };

  const saveProgress = async (stepNum: number) => {
    await fetch('/api/save-profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(buildProfileData(false, stepNum)),
    });
  };

  const handleNext = async () => {
    if (step === 0 && hasBloodWork === false) { await saveProgress(0); setStep(2); return; }
    await saveProgress(step + 1);
    setStep(step + 1);
  };

  const handleBack = () => {
    if (step === 2 && hasBloodWork === false) { setStep(0); return; }
    setStep(Math.max(0, step - 1));
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

    const profileData = buildProfileData(true, 5);

    try {
      await fetch('/api/save-profile', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(profileData) });
      if (biomarkerValues.length > 0) {
        await fetch('/api/save-bloodtest', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ biomarkers: biomarkerValues }) });
      }
      const genRes = await fetch('/api/generate-protocol', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profile: profileData, biomarkers: biomarkerValues }),
      });
      if (!genRes.ok) {
        const err = await genRes.json().catch(() => ({}));
        throw new Error(err.error || `Protocol generation failed (${genRes.status})`);
      }
      window.location.href = '/dashboard';
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error. Try again.');
      setLoading(false);
    }
  };

  const addMedication = () => setMedications(prev => [...prev, { name: '', dose: '', frequency: 'daily' }]);
  const updateMed = (i: number, field: keyof Medication, val: string) => setMedications(prev => prev.map((m, idx) => idx === i ? { ...m, [field]: val } : m));
  const removeMed = (i: number) => setMedications(prev => prev.filter((_, idx) => idx !== i));

  if (loading) return <GeneratingScreen />;
  if (!restored) return <div className="flex items-center justify-center min-h-dvh"><div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" /></div>;

  const markersToShowBig11 = BIOMARKER_DB.filter(b => BIG_11_CODES.includes(b.code));
  const filledCount = Object.values(biomarkers).filter(Boolean).length;

  return (
    <div className="min-h-dvh flex flex-col">
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
        {/* STEP 0 — Basics */}
        {step === 0 && (
          <div className="space-y-5">
            <div>
              <h1 className="text-2xl font-bold">The Basics</h1>
              <p className="text-muted-foreground text-sm mt-1">~45 seconds. Core data for calibration.</p>
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
              <div>
                <label className="text-xs text-muted-foreground">Ethnicity (optional)</label>
                <select value={ethnicity} onChange={e => setEthnicity(e.target.value)} className="w-full mt-1 rounded-xl bg-card border border-card-border px-3 py-2.5 text-sm outline-none focus:border-accent">
                  <option value="">Select...</option>
                  <option value="european">European</option>
                  <option value="african">African</option>
                  <option value="asian_east">East Asian</option>
                  <option value="asian_south">South Asian</option>
                  <option value="hispanic">Hispanic/Latino</option>
                  <option value="middle_eastern">Middle Eastern</option>
                  <option value="mixed">Mixed / Other</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Resting HR (optional)</label>
                <input type="number" value={restingHR} onChange={e => setRestingHR(e.target.value)} placeholder="65" className="w-full mt-1 rounded-xl bg-card border border-card-border px-3 py-2.5 text-sm outline-none focus:border-accent font-mono" />
              </div>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-2 block">Occupation type</label>
              <div className="grid grid-cols-4 gap-2">
                {(['desk', 'physical', 'shift', 'mixed'] as const).map(o => (
                  <button key={o} onClick={() => setOccupation(o)} className={clsx('py-2 rounded-xl text-xs font-medium capitalize transition-all', occupation === o ? 'bg-accent text-black' : 'bg-card border border-card-border text-muted-foreground')}>{o}</button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-2 block">Activity Level: <span className="text-accent font-medium">{activityLabels[activityLevel]}</span></label>
              <input type="range" min={0} max={4} value={activityLevel} onChange={e => setActivityLevel(parseInt(e.target.value))} className="w-full h-2 bg-card-border rounded-lg appearance-none cursor-pointer accent-[#00ff88]" />
              <div className="flex justify-between text-[9px] text-muted mt-1">{activityLabels.map(l => <span key={l}>{l}</span>)}</div>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-2 block">Do you have recent blood work?</label>
              <div className="flex gap-3">
                {[{ v: true, l: 'Yes, I have results' }, { v: false, l: 'No, skip this' }].map(({ v, l }) => (
                  <button key={String(v)} onClick={() => setHasBloodWork(v)} className={clsx('flex-1 py-3 rounded-xl text-sm font-medium transition-all', hasBloodWork === v ? 'bg-accent text-black' : 'bg-card border border-card-border text-muted-foreground')}>{l}</button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* STEP 1 — Blood Work */}
        {step === 1 && (
          <div className="space-y-5">
            <div>
              <h1 className="text-2xl font-bold">Your Blood Work</h1>
              <p className="text-muted-foreground text-sm mt-1">Upload a PDF or enter manually.</p>
            </div>
            <div className={clsx('border-2 border-dashed rounded-2xl p-8 text-center transition-all cursor-pointer hover:border-accent/50', pdfParsed ? 'border-accent/50 bg-accent/5' : 'border-card-border')} onClick={() => fileInputRef.current?.click()}>
              <input ref={fileInputRef} type="file" accept=".pdf" className="hidden" onChange={e => e.target.files?.[0] && handlePdfUpload(e.target.files[0])} />
              {pdfParsing ? <div className="space-y-3"><div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin mx-auto" /><p className="text-sm text-accent">Parsing with AI...</p></div>
                : pdfParsed ? <div className="space-y-2"><FileText className="w-10 h-10 text-accent mx-auto" /><p className="text-sm text-accent font-medium">{filledCount} biomarkers detected</p></div>
                : <div className="space-y-3"><Upload className="w-10 h-10 text-muted-foreground mx-auto" /><p className="text-sm font-medium">Drop lab report PDF</p><p className="text-xs text-muted-foreground">Synevo, Regina Maria, MedLife, LabCorp, Quest</p></div>}
            </div>
            <p className="text-[10px] text-accent uppercase tracking-wider">Core markers (Big 11)</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {markersToShowBig11.map(b => {
                const cls = getLiveClassification(b.code, biomarkers[b.code] || '');
                return (
                  <div key={b.code} className="flex items-center gap-2 rounded-xl border border-card-border p-2.5">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate">{b.shortName}</p>
                      <p className="text-[10px] text-muted">Optimal: {b.longevityOptimalLow}-{b.longevityOptimalHigh}</p>
                    </div>
                    <input type="number" value={biomarkers[b.code] || ''} onChange={e => updateBiomarker(b.code, e.target.value)} placeholder={b.bryanJohnsonValue ? String(b.bryanJohnsonValue) : ''} step="0.1" className="w-20 rounded-lg bg-background border border-card-border px-2 py-1.5 text-sm text-right outline-none focus:border-accent font-mono" />
                    <span className="text-[10px] text-muted w-14">{b.unit}</span>
                    {cls && <span className={clsx('w-2 h-2 rounded-full', cls === 'OPTIMAL' ? 'bg-accent' : cls.includes('SUBOPTIMAL') ? 'bg-amber-400' : 'bg-red-400')} />}
                  </div>
                );
              })}
            </div>
            <button onClick={() => setShowAllMarkers(!showAllMarkers)} className="flex items-center gap-1 text-xs text-accent hover:underline mx-auto">
              {showAllMarkers ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}{showAllMarkers ? 'Show less' : `Show all ${BIOMARKER_DB.length} markers`}
            </button>
            {showAllMarkers && BIOMARKER_CATEGORIES.map(cat => {
              const catMarkers = BIOMARKER_DB.filter(b => b.category === cat && !BIG_11_CODES.includes(b.code));
              if (catMarkers.length === 0) return null;
              return (
                <div key={cat} className="space-y-2">
                  <p className="text-[10px] text-accent uppercase tracking-wider">{CATEGORY_LABELS[cat] || cat}</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {catMarkers.map(b => {
                      const cls = getLiveClassification(b.code, biomarkers[b.code] || '');
                      return (
                        <div key={b.code} className="flex items-center gap-2 bg-card rounded-xl border border-card-border p-2.5">
                          <div className="flex-1 min-w-0"><p className="text-xs font-medium truncate">{b.shortName}</p><p className="text-[10px] text-muted">{b.longevityOptimalLow}-{b.longevityOptimalHigh} {b.unit}</p></div>
                          <input type="number" value={biomarkers[b.code] || ''} onChange={e => updateBiomarker(b.code, e.target.value)} step="0.1" className="w-20 rounded-lg bg-background border border-card-border px-2 py-1.5 text-sm text-right outline-none focus:border-accent font-mono" />
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

        {/* STEP 2 — Lifestyle */}
        {step === 2 && (
          <div className="space-y-4">
            <div>
              <h1 className="text-2xl font-bold">Your Lifestyle</h1>
              <p className="text-muted-foreground text-sm mt-1">~90 seconds. Shapes protocol as much as blood work.</p>
            </div>

            {/* Sleep */}
            <CollapseSection title="😴 Sleep" expanded={lifestyleExpanded.sleep} onToggle={() => setLifestyleExpanded(p => ({ ...p, sleep: !p.sleep }))}>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-xs text-muted-foreground">Hours/night</label><input type="number" value={sleepHours} onChange={e => setSleepHours(e.target.value)} step="0.5" className="w-full mt-1 rounded-xl bg-card border border-card-border px-3 py-2.5 text-sm outline-none focus:border-accent font-mono" /></div>
                <div><label className="text-xs text-muted-foreground">Quality (1-10)</label>
                  <div className="flex gap-1 mt-1">{[...Array(10)].map((_, i) => (
                    <button key={i} onClick={() => setSleepQuality(i + 1)} className={clsx('flex-1 h-9 rounded-lg text-xs font-mono transition-all', sleepQuality === i + 1 ? 'bg-accent text-black' : i + 1 <= sleepQuality ? 'bg-accent/20 text-accent' : 'bg-card border border-card-border text-muted')}>{i + 1}</button>
                  ))}</div>
                </div>
                <div><label className="text-xs text-muted-foreground">Typical bedtime</label><input type="time" value={bedtime} onChange={e => setBedtime(e.target.value)} className="w-full mt-1 rounded-xl bg-card border border-card-border px-3 py-2.5 text-sm outline-none focus:border-accent font-mono" /></div>
                <div><label className="text-xs text-muted-foreground">Typical wake time</label><input type="time" value={wakeTime} onChange={e => setWakeTime(e.target.value)} className="w-full mt-1 rounded-xl bg-card border border-card-border px-3 py-2.5 text-sm outline-none focus:border-accent font-mono" /></div>
              </div>
              <div><label className="text-xs text-muted-foreground mb-2 block">Chronotype</label>
                <div className="flex gap-2">
                  {([{ v: 'morning', l: '🌅 Morning person' }, { v: 'neutral', l: '😐 Neutral' }, { v: 'night', l: '🌙 Night owl' }] as const).map(({ v, l }) => (
                    <button key={v} onClick={() => setChronotype(v)} className={clsx('flex-1 py-2 rounded-xl text-xs font-medium transition-all', chronotype === v ? 'bg-accent text-black' : 'bg-card border border-card-border text-muted-foreground')}>{l}</button>
                  ))}
                </div>
              </div>
              <div><label className="text-xs text-muted-foreground mb-2 block">Sleep issues</label>
                <div className="flex flex-wrap gap-2">
                  {SLEEP_ISSUES.map(si => (
                    <button key={si} onClick={() => toggle<string>(setSleepIssues as (f: (p: string[]) => string[]) => void, si)} className={clsx('px-3 py-1.5 rounded-xl text-xs transition-all', sleepIssues.includes(si) ? 'bg-warning/20 text-warning border border-warning/50' : 'bg-card border border-card-border text-muted-foreground')}>{si}</button>
                  ))}
                </div>
              </div>
            </CollapseSection>

            {/* Diet */}
            <CollapseSection title="🥗 Diet" expanded={lifestyleExpanded.diet} onToggle={() => setLifestyleExpanded(p => ({ ...p, diet: !p.diet }))}>
              <div><label className="text-xs text-muted-foreground mb-2 block">Diet type</label>
                <div className="flex flex-wrap gap-2">
                  {['omnivore', 'vegetarian', 'vegan', 'keto', 'carnivore', 'mediterranean'].map(d => (
                    <button key={d} onClick={() => setDietType(d)} className={clsx('px-3 py-2 rounded-xl text-xs font-medium transition-all capitalize', dietType === d ? 'bg-accent text-black' : 'bg-card border border-card-border text-muted-foreground')}>{d}</button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-xs text-muted-foreground">Meals/day</label><input type="number" value={mealsPerDay} onChange={e => setMealsPerDay(parseInt(e.target.value) || 3)} min={1} max={6} className="w-full mt-1 rounded-xl bg-card border border-card-border px-3 py-2.5 text-sm outline-none focus:border-accent font-mono" /></div>
                <div><label className="text-xs text-muted-foreground">Water (glasses/day)</label><input type="number" value={hydration} onChange={e => setHydration(parseInt(e.target.value) || 6)} min={0} max={20} className="w-full mt-1 rounded-xl bg-card border border-card-border px-3 py-2.5 text-sm outline-none focus:border-accent font-mono" /></div>
              </div>
              <div><label className="text-xs text-muted-foreground mb-2 block">Food allergies/intolerances</label>
                <div className="flex flex-wrap gap-2">
                  {['gluten', 'dairy', 'nuts', 'seafood', 'eggs', 'soy', 'shellfish'].map(f => (
                    <button key={f} onClick={() => toggle<string>(setFoodAllergies as (f: (p: string[]) => string[]) => void, f)} className={clsx('px-3 py-1.5 rounded-xl text-xs capitalize transition-all', foodAllergies.includes(f) ? 'bg-warning/20 text-warning border border-warning/50' : 'bg-card border border-card-border text-muted-foreground')}>{f}</button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-xs text-muted-foreground">Alcohol (drinks/week)</label><input type="number" value={alcoholPerWeek} onChange={e => setAlcoholPerWeek(parseInt(e.target.value) || 0)} min={0} max={50} className="w-full mt-1 rounded-xl bg-card border border-card-border px-3 py-2.5 text-sm outline-none focus:border-accent font-mono" /></div>
                <div><label className="text-xs text-muted-foreground">Caffeine (servings/day)</label><input type="number" value={caffeineServings} onChange={e => setCaffeineServings(parseInt(e.target.value) || 0)} min={0} max={10} className="w-full mt-1 rounded-xl bg-card border border-card-border px-3 py-2.5 text-sm outline-none focus:border-accent font-mono" /></div>
              </div>
              <div className="flex items-center gap-3"><button onClick={() => setSmoker(!smoker)} className={clsx('w-6 h-6 rounded-lg border-2 flex items-center justify-center shrink-0', smoker ? 'bg-warning border-warning' : 'border-card-border')}>{smoker && <span className="text-black text-xs">✓</span>}</button><span className="text-sm">Smoker / nicotine user</span></div>
            </CollapseSection>

            {/* Exercise */}
            <CollapseSection title="🏋️ Exercise" expanded={lifestyleExpanded.exercise} onToggle={() => setLifestyleExpanded(p => ({ ...p, exercise: !p.exercise }))}>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-xs text-muted-foreground">Cardio (min/week)</label><input type="number" value={cardioMin} onChange={e => setCardioMin(parseInt(e.target.value) || 0)} min={0} max={1000} className="w-full mt-1 rounded-xl bg-card border border-card-border px-3 py-2.5 text-sm outline-none focus:border-accent font-mono" /></div>
                <div><label className="text-xs text-muted-foreground">Strength sessions/week</label><input type="number" value={strengthSessions} onChange={e => setStrengthSessions(parseInt(e.target.value) || 0)} min={0} max={7} className="w-full mt-1 rounded-xl bg-card border border-card-border px-3 py-2.5 text-sm outline-none focus:border-accent font-mono" /></div>
              </div>
            </CollapseSection>

            {/* Mental/Stress */}
            <CollapseSection title="🧠 Stress & Mental" expanded={lifestyleExpanded.mental} onToggle={() => setLifestyleExpanded(p => ({ ...p, mental: !p.mental }))}>
              <div><label className="text-xs text-muted-foreground mb-2 block">Stress level (1-10): <span className="text-accent font-medium">{stressLevel}</span></label>
                <input type="range" min={1} max={10} value={stressLevel} onChange={e => setStressLevel(parseInt(e.target.value))} className="w-full h-2 bg-card-border rounded-lg appearance-none cursor-pointer accent-[#00ff88]" />
              </div>
              <div><label className="text-xs text-muted-foreground mb-2 block">Meditation/mindfulness</label>
                <div className="flex gap-2">
                  {(['none', 'occasional', 'daily'] as const).map(v => (
                    <button key={v} onClick={() => setMeditationPractice(v)} className={clsx('flex-1 py-2 rounded-xl text-xs font-medium capitalize transition-all', meditationPractice === v ? 'bg-accent text-black' : 'bg-card border border-card-border text-muted-foreground')}>{v}</button>
                  ))}
                </div>
              </div>
            </CollapseSection>

            {/* Medical */}
            <CollapseSection title="⚕️ Medical" expanded={lifestyleExpanded.medical} onToggle={() => setLifestyleExpanded(p => ({ ...p, medical: !p.medical }))}>
              <div><label className="text-xs text-muted-foreground mb-2 block">Diagnosed conditions</label>
                <div className="flex flex-wrap gap-2">
                  {CONDITIONS.map(c => (
                    <button key={c} onClick={() => toggle<string>(setConditions as (f: (p: string[]) => string[]) => void, c)} className={clsx('px-3 py-1.5 rounded-xl text-xs transition-all', conditions.includes(c) ? 'bg-warning/20 text-warning border border-warning/50' : 'bg-card border border-card-border text-muted-foreground')}>{c}</button>
                  ))}
                </div>
              </div>
              <div><label className="text-xs text-muted-foreground mb-2 block">Family history</label>
                <div className="flex flex-wrap gap-2">
                  {FAMILY_CONDITIONS.map(c => (
                    <button key={c} onClick={() => toggle<string>(setFamilyHistory as (f: (p: string[]) => string[]) => void, c)} className={clsx('px-3 py-1.5 rounded-xl text-xs transition-all', familyHistory.includes(c) ? 'bg-accent/20 text-accent border border-accent/50' : 'bg-card border border-card-border text-muted-foreground')}>{c}</button>
                  ))}
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs text-muted-foreground">Current medications</label>
                  <button onClick={addMedication} className="flex items-center gap-1 text-xs text-accent"><Plus className="w-3 h-3" /> Add</button>
                </div>
                {medications.length === 0 && <p className="text-[10px] text-muted">None. Click &quot;Add&quot; if you take any.</p>}
                <div className="space-y-2">
                  {medications.map((m, i) => (
                    <div key={i} className="flex gap-2 items-center">
                      <input value={m.name} onChange={e => updateMed(i, 'name', e.target.value)} placeholder="Name (e.g. Metformin)" className="flex-1 rounded-lg bg-card border border-card-border px-2 py-1.5 text-xs outline-none focus:border-accent" />
                      <input value={m.dose} onChange={e => updateMed(i, 'dose', e.target.value)} placeholder="500mg" className="w-20 rounded-lg bg-card border border-card-border px-2 py-1.5 text-xs outline-none focus:border-accent" />
                      <select value={m.frequency} onChange={e => updateMed(i, 'frequency', e.target.value)} className="rounded-lg bg-card border border-card-border px-2 py-1.5 text-xs outline-none focus:border-accent">
                        <option value="daily">daily</option><option value="2x/day">2x/day</option><option value="weekly">weekly</option><option value="as needed">as needed</option>
                      </select>
                      <button onClick={() => removeMed(i)} className="p-1.5 text-muted hover:text-danger"><X className="w-3 h-3" /></button>
                    </div>
                  ))}
                </div>
              </div>
              <div><label className="text-xs text-muted-foreground">Current supplements (comma-separated)</label>
                <input type="text" value={supplements} onChange={e => setSupplements(e.target.value)} placeholder="Vitamin D, Omega-3, Magnesium..." className="w-full mt-1 rounded-xl bg-card border border-card-border px-3 py-2.5 text-sm outline-none focus:border-accent" />
              </div>
            </CollapseSection>
          </div>
        )}

        {/* STEP 3 — Day-to-Day */}
        {step === 3 && (
          <div className="space-y-5">
            <div>
              <h1 className="text-2xl font-bold">Your Day-to-Day</h1>
              <p className="text-muted-foreground text-sm mt-1">Helps us build a protocol that fits your actual life.</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="text-xs text-muted-foreground">Work starts</label><input type="time" value={workStart} onChange={e => setWorkStart(e.target.value)} className="w-full mt-1 rounded-xl bg-card border border-card-border px-3 py-2.5 text-sm outline-none focus:border-accent font-mono" /></div>
              <div><label className="text-xs text-muted-foreground">Work ends</label><input type="time" value={workEnd} onChange={e => setWorkEnd(e.target.value)} className="w-full mt-1 rounded-xl bg-card border border-card-border px-3 py-2.5 text-sm outline-none focus:border-accent font-mono" /></div>
            </div>
            <div><label className="text-xs text-muted-foreground mb-2 block">Work location</label>
              <div className="flex gap-2">
                {(['home', 'office', 'hybrid'] as const).map(v => (
                  <button key={v} onClick={() => setWorkLocation(v)} className={clsx('flex-1 py-2 rounded-xl text-xs font-medium capitalize transition-all', workLocation === v ? 'bg-accent text-black' : 'bg-card border border-card-border text-muted-foreground')}>{v}</button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="text-xs text-muted-foreground">Sitting hours/day: <span className="text-accent">{sittingHours}</span></label><input type="range" min={0} max={16} value={sittingHours} onChange={e => setSittingHours(parseInt(e.target.value))} className="w-full mt-2 h-2 bg-card-border rounded-lg appearance-none cursor-pointer accent-[#00ff88]" /></div>
              <div><label className="text-xs text-muted-foreground">Screen time/day: <span className="text-accent">{screenTime}h</span></label><input type="range" min={1} max={16} value={screenTime} onChange={e => setScreenTime(parseInt(e.target.value))} className="w-full mt-2 h-2 bg-card-border rounded-lg appearance-none cursor-pointer accent-[#00ff88]" /></div>
            </div>
            <div><label className="text-xs text-muted-foreground mb-2 block">Best time for exercise</label>
              <div className="grid grid-cols-5 gap-2">
                {(['morning', 'lunch', 'evening', 'weekends', 'inconsistent'] as const).map(v => (
                  <button key={v} onClick={() => setExerciseWindow(v)} className={clsx('py-2 rounded-xl text-[10px] font-medium capitalize transition-all', exerciseWindow === v ? 'bg-accent text-black' : 'bg-card border border-card-border text-muted-foreground')}>{v}</button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Biggest pain points (what bothers you most?)</label>
              <textarea value={painPoints} onChange={e => setPainPoints(e.target.value)} rows={3} placeholder="e.g. Afternoon energy crash at 2 PM, brain fog in meetings, lower back stiffness, can't fall asleep..." className="w-full rounded-xl bg-card border border-card-border px-3 py-2.5 text-sm outline-none focus:border-accent resize-none" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Non-negotiables (things you won&apos;t give up)</label>
              <textarea value={nonNegotiables} onChange={e => setNonNegotiables(e.target.value)} rows={2} placeholder="e.g. Friday pizza night, morning coffee, weekend drinks..." className="w-full rounded-xl bg-card border border-card-border px-3 py-2.5 text-sm outline-none focus:border-accent resize-none" />
            </div>
          </div>
        )}

        {/* STEP 4 — Goals */}
        {step === 4 && (
          <div className="space-y-5">
            <div>
              <h1 className="text-2xl font-bold">Your Goals</h1>
              <p className="text-muted-foreground text-sm mt-1">What matters most?</p>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-2 block">Primary goal (pick ONE)</label>
              <div className="grid grid-cols-2 gap-2">
                {GOALS.map(g => (
                  <button key={g} onClick={() => setPrimaryGoal(g)} className={clsx('p-3 rounded-xl text-sm text-left transition-all', primaryGoal === g ? 'bg-accent/10 border border-accent/50 text-accent' : 'bg-card border border-card-border text-muted-foreground')}>{g}</button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-2 block">Secondary goals (up to 3)</label>
              <div className="grid grid-cols-2 gap-2">
                {GOALS.filter(g => g !== primaryGoal).map(g => (
                  <button key={g} onClick={() => {
                    if (secondaryGoals.includes(g)) setSecondaryGoals(p => p.filter(x => x !== g));
                    else if (secondaryGoals.length < 3) setSecondaryGoals(p => [...p, g]);
                  }} className={clsx('p-2 rounded-xl text-xs text-left transition-all', secondaryGoals.includes(g) ? 'bg-accent/10 border border-accent/50 text-accent' : 'bg-card border border-card-border text-muted-foreground')}>{g}</button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Specific target (optional)</label>
              <input type="text" value={specificTarget} onChange={e => setSpecificTarget(e.target.value)} placeholder="e.g. Lose 10kg by summer, HbA1c < 5.3" className="w-full mt-1 rounded-xl bg-card border border-card-border px-3 py-2.5 text-sm outline-none focus:border-accent" />
            </div>
            <div><label className="text-xs text-muted-foreground mb-2 block">Commitment horizon</label>
              <div className="grid grid-cols-5 gap-2">
                {[{ v: 1, l: '1 mo' }, { v: 3, l: '3 mo' }, { v: 6, l: '6 mo' }, { v: 12, l: '1 yr' }, { v: 120, l: 'ongoing' }].map(({ v, l }) => (
                  <button key={v} onClick={() => setTimelineMonths(v)} className={clsx('py-2 rounded-xl text-xs font-medium transition-all', timelineMonths === v ? 'bg-accent text-black' : 'bg-card border border-card-border text-muted-foreground')}>{l}</button>
                ))}
              </div>
            </div>
            <div><label className="text-xs text-muted-foreground mb-2 block">Time available per day</label>
              <div className="flex gap-2">
                {[{ v: 30, l: '<30 min' }, { v: 60, l: '30-60' }, { v: 120, l: '1-2h' }, { v: 180, l: '2+h' }].map(({ v, l }) => (
                  <button key={v} onClick={() => setTimeBudget(v)} className={clsx('flex-1 py-2 rounded-xl text-xs font-medium transition-all', timeBudget === v ? 'bg-accent text-black' : 'bg-card border border-card-border text-muted-foreground')}>{l}</button>
                ))}
              </div>
            </div>
            <div><label className="text-xs text-muted-foreground mb-2 block">Monthly budget (RON)</label>
              <div className="flex gap-2">
                {[{ v: 200, l: '<200' }, { v: 500, l: '200-500' }, { v: 1500, l: '500-1500' }, { v: 5000, l: '1500+' }].map(({ v, l }) => (
                  <button key={v} onClick={() => setMonthlyBudget(v)} className={clsx('flex-1 py-2 rounded-xl text-xs font-medium transition-all', monthlyBudget === v ? 'bg-accent text-black' : 'bg-card border border-card-border text-muted-foreground')}>{l} RON</button>
                ))}
              </div>
            </div>
            <div><label className="text-xs text-muted-foreground mb-2 block">Experimental openness</label>
              <div className="space-y-2">
                {[{ v: 'otc_only', l: 'OTC Only', d: 'Over-the-counter supplements only' }, { v: 'open_rx', l: 'Open to Rx', d: 'Including prescription medication discussion' }, { v: 'open_experimental', l: 'Experimental', d: 'Peptides, advanced therapies, off-label' }].map(({ v, l, d }) => (
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

      <div className="sticky bottom-16 md:bottom-0 z-30 bg-background/90 backdrop-blur-xl border-t border-card-border px-6 py-4 max-w-2xl mx-auto w-full flex gap-3">
        {step > 0 && (
          <button onClick={handleBack} className="px-4 py-3 rounded-xl bg-card border border-card-border text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">← Back</button>
        )}
        <button
          onClick={() => step < 4 ? handleNext() : handleFinish()}
          disabled={!canNext() || loading}
          className="flex-1 py-3 rounded-xl bg-accent text-black font-semibold text-sm transition-all hover:bg-accent-dim active:scale-[0.98] disabled:opacity-40">
          {step < 4 ? 'Continue →' : '⚡ Generate Protocol'}
        </button>
      </div>
    </div>
  );
}

function CollapseSection({ title, expanded, onToggle, children }: { title: string; expanded: boolean; onToggle: () => void; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl bg-card border border-card-border overflow-hidden">
      <button onClick={onToggle} className="w-full flex items-center justify-between p-4 text-left hover:bg-background/50 transition-colors">
        <span className="text-sm font-semibold">{title}</span>
        {expanded ? <ChevronUp className="w-4 h-4 text-muted" /> : <ChevronDown className="w-4 h-4 text-muted" />}
      </button>
      {expanded && <div className="px-4 pb-4 space-y-3 border-t border-card-border">{children}</div>}
    </div>
  );
}
