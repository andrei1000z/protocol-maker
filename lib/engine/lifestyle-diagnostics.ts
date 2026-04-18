// ============================================================================
// LIFESTYLE-BASED DIAGNOSTICS
// ============================================================================
// When a user hasn't uploaded bloodwork yet, these functions produce evidence-
// based estimates from onboarding data so the dashboard has real values to
// display instead of blank placeholders.
//
// All estimates are clearly labeled `estimated: true` so the UI can show "~"
// or a confidence badge. Sources: Levine 2018 (PhenoAge), Arem 2015 (exercise),
// Cappuccio 2010 (sleep), Di Angelantonio 2016 (BMI), Holt-Lunstad 2015 (social),
// and standard population biomarker references.
// ============================================================================

import type { BiomarkerValue } from '../types';

type Profile = Record<string, unknown>;

const pick = <T>(profile: Profile, key: string, fallback: T): T => {
  const od = (profile.onboardingData || {}) as Profile;
  const v = profile[key] ?? od[key];
  return (v === undefined || v === null || v === '') ? fallback : (v as T);
};

const num = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : NaN;
};

// ============================================================================
// ORGAN SYSTEM SCORES — 0-100 for each of 8 systems
// ============================================================================

export interface OrganSystem {
  key: string;
  label: string;
  description: string;
  score: number;        // 0-100
  estimated: boolean;   // true if no biomarkers used
  drivers: string[];    // what pushed the score up/down
  improvers: string[];  // top 2 levers to raise the score
}

export function computeOrganSystems(profile: Profile, classified: BiomarkerValue[]): OrganSystem[] {
  const age = num(pick(profile, 'age', 35));
  const h = num(pick(profile, 'heightCm', 0)) / 100;
  const w = num(pick(profile, 'weightKg', 0));
  const bmi = h > 0 && w > 0 ? w / (h * h) : 22;
  const sleep = num(pick(profile, 'sleepHoursAvg', pick(profile, 'sleepHours', 7)));
  const cardio = num(pick(profile, 'cardioMinutesPerWeek', pick(profile, 'cardioMin', 90)));
  const strength = num(pick(profile, 'strengthSessionsPerWeek', pick(profile, 'strengthSessions', 2)));
  const stress = num(pick(profile, 'stressLevel', 5));
  const smoker = pick(profile, 'smoker', false);
  const alc = num(pick(profile, 'alcoholPerWeek', 0));
  const ultra = num(pick(profile, 'ultraProcessedPerWeek', 0));
  const vo2 = num(pick(profile, 'vo2Max', 0));
  const sys = num(pick(profile, 'bloodPressureSys', 0));
  const dia = num(pick(profile, 'bloodPressureDia', 0));
  const hrv = num(pick(profile, 'hrv', 0));
  const rhr = num(pick(profile, 'restingHR', 0));
  const dietType = String(pick(profile, 'dietType', 'omnivore'));
  const veg = num(pick(profile, 'veggiesPerDay', 0));
  const fish = num(pick(profile, 'fishPerWeek', 0));
  const steps = num(pick(profile, 'stepsPerDay', 0));
  const sunlight = num(pick(profile, 'sunlightMinutes', 0));
  const conditions = (pick(profile, 'conditions', []) as string[]) || [];

  const bmFor = (code: string) => classified.find(b => b.code === code);
  const biomarkerAdjust = (score: number, codes: string[], maxSwing = 20) => {
    const relevant = codes.map(bmFor).filter(Boolean);
    if (relevant.length === 0) return { score, estimated: true };
    let bmScore = 0;
    relevant.forEach(b => {
      const c = b!.classification;
      bmScore += c === 'OPTIMAL' ? 100 : c === 'SUBOPTIMAL_LOW' || c === 'SUBOPTIMAL_HIGH' ? 65
               : c === 'DEFICIENT' || c === 'EXCESS' ? 35 : c === 'CRITICAL' ? 10 : 70;
    });
    bmScore = bmScore / relevant.length;
    // Blend lifestyle estimate (base) with biomarker truth
    const weight = Math.min(0.7, 0.35 + relevant.length * 0.1);
    const blended = Math.round(score * (1 - weight) + bmScore * weight);
    const pulled = Math.abs(blended - score) > maxSwing
      ? score + Math.sign(blended - score) * maxSwing
      : blended;
    return { score: pulled, estimated: false };
  };

  const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

  const systems: OrganSystem[] = [];

  // ── Cardiovascular ────────────────────────────────────────────────────────
  {
    let s = 75;
    const drivers: string[] = [];
    const improvers: string[] = [];
    if (smoker) { s -= 18; drivers.push('Smoking (+risk)'); improvers.push('Quit nicotine — gains start within weeks'); }
    if (alc >= 14) { s -= 5; drivers.push('Alcohol ≥14/wk'); }
    if (cardio >= 300) { s += 10; drivers.push('Strong cardio volume'); }
    else if (cardio >= 150) { s += 5; drivers.push('Adequate cardio'); }
    else if (cardio < 75) { s -= 8; drivers.push('Low cardio'); improvers.push('Add 150 min/wk zone-2 cardio'); }
    if (bmi >= 30) { s -= 10; drivers.push('BMI ≥30'); }
    else if (bmi >= 27) { s -= 4; }
    if (sys >= 140 || dia >= 90) { s -= 12; drivers.push('Elevated BP'); improvers.push('Check BP weekly — see GP if sustained'); }
    else if (sys >= 130) { s -= 4; drivers.push('Borderline BP'); }
    if (vo2 > 0) {
      const expected = Math.max(25, 55 - (age - 20) * 0.35);
      s += Math.max(-10, Math.min(10, (vo2 - expected) * 0.5));
    }
    if (rhr > 0) {
      if (rhr >= 80) { s -= 6; drivers.push('Resting HR high'); }
      else if (rhr <= 55) { s += 3; drivers.push('Low resting HR'); }
    }
    if (hrv > 0 && hrv >= 60) { s += 3; drivers.push('Good HRV'); }
    if (conditions.some(c => /hypertension|cardio/i.test(c))) s -= 8;
    if (improvers.length < 2 && cardio < 300) improvers.push('Zone-2 cardio 2x/wk builds VO2 Max');
    if (improvers.length < 2) improvers.push('Mediterranean diet pattern');
    const adjusted = biomarkerAdjust(s, ['HSCRP', 'LDL', 'HDL', 'TRIG', 'APOB']);
    systems.push({
      key: 'cardiovascular',
      label: 'Cardiovascular',
      description: 'Heart + vessels. Blood pressure, lipids, inflammation, cardio fitness.',
      score: clamp(adjusted.score),
      estimated: adjusted.estimated,
      drivers: drivers.slice(0, 3),
      improvers: improvers.slice(0, 2),
    });
  }

  // ── Metabolic ─────────────────────────────────────────────────────────────
  {
    let s = 75;
    const drivers: string[] = [];
    const improvers: string[] = [];
    if (bmi >= 30) { s -= 15; drivers.push('Obesity-range BMI'); improvers.push('Sustained -5% weight loss normalizes most markers'); }
    else if (bmi >= 27) { s -= 6; drivers.push('BMI 27-30'); }
    else if (bmi >= 20 && bmi < 25) { s += 4; }
    if (ultra >= 15) { s -= 10; drivers.push('High ultra-processed intake'); improvers.push('Cut ultra-processed to <3 meals/wk'); }
    else if (ultra >= 8) { s -= 4; }
    if (strength >= 2) { s += 6; drivers.push('Strength training'); }
    else { s -= 5; improvers.push('Add 2 strength sessions/wk — muscle = glucose sink'); }
    if (cardio >= 150) s += 4;
    if (conditions.some(c => /diabetes/i.test(c))) { s -= 20; drivers.push('Diabetes dx'); }
    if (dietType === 'mediterranean') { s += 3; drivers.push('Mediterranean diet'); }
    if (sleep < 6) { s -= 5; drivers.push('Short sleep reduces insulin sensitivity'); }
    if (improvers.length < 2) improvers.push('16:8 time-restricted eating');
    const adjusted = biomarkerAdjust(s, ['HBA1C', 'GLUC', 'INSULIN']);
    systems.push({
      key: 'metabolic',
      label: 'Metabolic',
      description: 'Blood sugar + insulin sensitivity. How well your body handles carbs.',
      score: clamp(adjusted.score),
      estimated: adjusted.estimated,
      drivers: drivers.slice(0, 3),
      improvers: improvers.slice(0, 2),
    });
  }

  // ── Hormonal ──────────────────────────────────────────────────────────────
  {
    let s = 72;
    const drivers: string[] = [];
    const improvers: string[] = [];
    if (sleep >= 7 && sleep <= 9) { s += 5; drivers.push('Adequate sleep'); } else { s -= 6; drivers.push('Sleep debt disrupts hormones'); improvers.push('Prioritize 7-9h sleep — testosterone/GH peak overnight'); }
    if (stress >= 8) { s -= 8; drivers.push('Chronic stress (cortisol)'); improvers.push('Daily breathwork or meditation'); }
    if (strength >= 3) { s += 5; drivers.push('Strength → androgens'); }
    if (bmi >= 30) { s -= 6; drivers.push('Adiposity → SHBG ↓'); }
    const pregnant = pick(profile, 'pregnant', false);
    if (pregnant) drivers.push('Pregnancy — hormone shifts expected');
    if (conditions.some(c => /thyroid|PCOS/i.test(c))) { s -= 8; drivers.push('Endocrine condition'); }
    if (improvers.length < 2) improvers.push('Sunlight morning + magnesium evening');
    const adjusted = biomarkerAdjust(s, ['TSH', 'FT4', 'TESTO', 'CORTISOL']);
    systems.push({
      key: 'hormonal',
      label: 'Hormonal',
      description: 'Thyroid, sex hormones, cortisol. Drives energy, libido, mood, body comp.',
      score: clamp(adjusted.score),
      estimated: adjusted.estimated,
      drivers: drivers.slice(0, 3),
      improvers: improvers.slice(0, 2),
    });
  }

  // ── Inflammatory ──────────────────────────────────────────────────────────
  {
    let s = 78;
    const drivers: string[] = [];
    const improvers: string[] = [];
    if (smoker) { s -= 15; drivers.push('Nicotine → systemic inflammation'); }
    if (ultra >= 10) { s -= 8; drivers.push('Ultra-processed diet'); improvers.push('Swap ultra-processed for whole foods'); }
    if (stress >= 8) { s -= 5; drivers.push('Chronic stress'); }
    if (sleep < 6) { s -= 6; drivers.push('Sleep deprivation'); }
    if (fish >= 2) { s += 4; drivers.push('Omega-3 intake'); }
    if (veg >= 5) { s += 5; drivers.push('Anti-inflammatory veggies'); }
    if (bmi >= 30) { s -= 8; drivers.push('Adipose → cytokines'); }
    if (pick(profile, 'sauna', false)) { s += 3; drivers.push('Sauna'); }
    if (conditions.some(c => /autoimmune/i.test(c))) { s -= 10; drivers.push('Autoimmune dx'); }
    if (improvers.length < 2) improvers.push('Daily 2g omega-3 + 400mg curcumin');
    const adjusted = biomarkerAdjust(s, ['HSCRP', 'HOMOCYS']);
    systems.push({
      key: 'inflammatory',
      label: 'Inflammatory',
      description: 'Chronic low-grade inflammation. The fire behind heart disease + dementia.',
      score: clamp(adjusted.score),
      estimated: adjusted.estimated,
      drivers: drivers.slice(0, 3),
      improvers: improvers.slice(0, 2),
    });
  }

  // ── Hepatic (liver) ───────────────────────────────────────────────────────
  {
    let s = 82;
    const drivers: string[] = [];
    const improvers: string[] = [];
    if (alc >= 14) { s -= 15; drivers.push('Alcohol ≥14/wk'); improvers.push('Drop to ≤7/wk — ALT normalizes fast'); }
    else if (alc >= 7) { s -= 5; drivers.push('Moderate alcohol'); }
    if (bmi >= 30) { s -= 10; drivers.push('NAFLD risk'); improvers.push('Weight loss + cardio reverses early NAFLD'); }
    else if (bmi >= 27) s -= 4;
    if (ultra >= 10) s -= 5;
    const meds = pick(profile, 'medications', []) as Array<{ name?: string }>;
    if (Array.isArray(meds) && meds.length >= 3) s -= 4;
    if (improvers.length < 2) improvers.push('Milk thistle + coffee 2-3 cups/day');
    const adjusted = biomarkerAdjust(s, ['ALT', 'AST', 'GGT']);
    systems.push({
      key: 'hepatic',
      label: 'Hepatic',
      description: 'Liver function. Filters toxins, processes drugs, makes cholesterol.',
      score: clamp(adjusted.score),
      estimated: adjusted.estimated,
      drivers: drivers.slice(0, 3),
      improvers: improvers.slice(0, 2),
    });
  }

  // ── Renal (kidney) ────────────────────────────────────────────────────────
  {
    let s = 85;
    const drivers: string[] = [];
    const improvers: string[] = [];
    if (sys >= 140 || dia >= 90) { s -= 8; drivers.push('High BP stresses kidneys'); }
    if (conditions.some(c => /diabetes/i.test(c))) { s -= 10; drivers.push('Diabetes — nephropathy risk'); }
    const hydration = num(pick(profile, 'hydration', 6));
    if (hydration >= 8) { s += 2; drivers.push('Well hydrated'); }
    else if (hydration <= 3) { s -= 3; drivers.push('Low fluid intake'); improvers.push('Aim 2-3L water/day'); }
    if (improvers.length < 2) improvers.push('Limit NSAIDs; hydrate; keep BP <130/80');
    const adjusted = biomarkerAdjust(s, ['CREAT', 'BUN']);
    systems.push({
      key: 'renal',
      label: 'Renal',
      description: 'Kidney function. Filters blood, balances electrolytes, controls BP.',
      score: clamp(adjusted.score),
      estimated: adjusted.estimated,
      drivers: drivers.slice(0, 3),
      improvers: improvers.slice(0, 2),
    });
  }

  // ── Nutritional ───────────────────────────────────────────────────────────
  {
    let s = 70;
    const drivers: string[] = [];
    const improvers: string[] = [];
    if (veg >= 5) { s += 8; drivers.push('5+ veggie servings/day'); }
    else if (veg >= 3) s += 3;
    else { s -= 6; improvers.push('Add 3+ cups veggies/day'); }
    if (fish >= 2) { s += 5; drivers.push('Omega-3 from fish'); } else if (fish === 0) improvers.push('Fatty fish 2x/week or 2g EPA/DHA supp');
    if (dietType === 'vegan' || dietType === 'vegetarian') { s -= 3; drivers.push('Plant-only: watch B12/iron/D3'); improvers.push('B12 supplement essential'); }
    if (dietType === 'mediterranean') s += 5;
    if (sunlight >= 15) s += 3;
    else if (sunlight === 0 || sunlight < 5) { s -= 4; improvers.push('15 min morning sunlight = vitamin D + circadian'); }
    const supsCount = (pick(profile, 'current_supplements', pick(profile, 'currentSupplements', [])) as unknown);
    if (typeof supsCount === 'string' && supsCount.length > 5) s += 2;
    else if (Array.isArray(supsCount) && supsCount.length >= 3) s += 3;
    if (improvers.length < 2) improvers.push('Vitamin D3 4000 IU + K2 daily');
    const adjusted = biomarkerAdjust(s, ['VITD', 'B12', 'FERRITIN', 'MAGNE', 'OMEGA3', 'FOLAT']);
    systems.push({
      key: 'nutritional',
      label: 'Nutritional',
      description: 'Vitamins, minerals, omega-3. The building blocks your cells need.',
      score: clamp(adjusted.score),
      estimated: adjusted.estimated,
      drivers: drivers.slice(0, 3),
      improvers: improvers.slice(0, 2),
    });
  }

  // ── Musculoskeletal ───────────────────────────────────────────────────────
  {
    let s = 70;
    const drivers: string[] = [];
    const improvers: string[] = [];
    if (strength >= 3) { s += 12; drivers.push('3+ strength sessions/wk'); }
    else if (strength >= 2) { s += 7; drivers.push('2 strength sessions/wk'); }
    else if (strength === 0) { s -= 10; drivers.push('No strength training'); improvers.push('Start 2x/wk compound lifts — priority after 30'); }
    if (steps >= 10000) { s += 5; drivers.push('10k+ daily steps'); }
    else if (steps > 0 && steps < 5000) { s -= 5; drivers.push('Sedentary <5k steps'); improvers.push('Target 8-10k steps/day'); }
    if (pick(profile, 'yogaPilates', false)) { s += 3; drivers.push('Yoga/Pilates → mobility'); }
    const injuries = String(pick(profile, 'injuries', ''));
    if (injuries.length > 3) s -= 5;
    const pain = String(pick(profile, 'chronicPain', ''));
    if (pain.length > 3) { s -= 6; drivers.push('Chronic pain'); }
    const sitting = num(pick(profile, 'sittingHours', 6));
    if (sitting >= 10) { s -= 5; drivers.push('10+ hrs sitting/day'); improvers.push('Stand-up every 30 min, walk breaks'); }
    const grip = num(pick(profile, 'gripStrength', 0));
    if (grip > 0) {
      const sex = String(pick(profile, 'sex', 'male'));
      const target = sex === 'female' ? 27 : 42;
      if (grip >= target) { s += 4; drivers.push('Strong grip'); }
      else if (grip < target * 0.7) s -= 4;
    }
    if (improvers.length < 2) improvers.push('Protein 1.6g/kg + creatine 5g/day');
    systems.push({
      key: 'musculoskeletal',
      label: 'Musculoskeletal',
      description: 'Muscle + bone + joints. Strength + mobility = functional longevity.',
      score: clamp(s),
      estimated: true,  // no direct biomarkers for this
      drivers: drivers.slice(0, 3),
      improvers: improvers.slice(0, 2),
    });
  }

  return systems;
}

// ============================================================================
// TOP WINS / TOP RISKS — human-readable insights for the hero card
// ============================================================================

export function generateTopWins(profile: Profile, classified: BiomarkerValue[], organs: OrganSystem[]): string[] {
  const wins: string[] = [];

  // Best organ systems
  const topOrgans = [...organs].sort((a, b) => b.score - a.score).slice(0, 2);
  topOrgans.forEach(o => {
    if (o.score >= 80) wins.push(`${o.label} system scoring ${o.score}/100 — above average for your age`);
  });

  // Specific biomarker wins
  const optimalBm = classified.filter(b => b.classification === 'OPTIMAL').slice(0, 2);
  optimalBm.forEach(b => wins.push(`${b.code} at ${b.value} ${b.unit} — optimal range`));

  // Lifestyle wins
  const cardio = num(pick(profile, 'cardioMinutesPerWeek', pick(profile, 'cardioMin', 0)));
  const strength = num(pick(profile, 'strengthSessionsPerWeek', pick(profile, 'strengthSessions', 0)));
  const sleep = num(pick(profile, 'sleepHoursAvg', pick(profile, 'sleepHours', 7)));
  const smoker = pick(profile, 'smoker', false);
  const alc = num(pick(profile, 'alcoholPerWeek', 0));

  if (!smoker && wins.length < 3) wins.push('Non-smoker — biggest single factor for longevity');
  if (cardio >= 150 && wins.length < 3) wins.push(`${cardio} min cardio/week — meets AHA guidelines`);
  if (strength >= 2 && wins.length < 3) wins.push(`${strength}x strength/week — muscle = metabolic health`);
  if (sleep >= 7 && sleep <= 9 && wins.length < 3) wins.push(`Sleep window ${sleep}h — in optimal zone`);
  if (alc === 0 && wins.length < 3) wins.push('Zero alcohol — hepatic + cognitive win');
  if (pick(profile, 'sauna', false) && wins.length < 4) wins.push('Regular sauna — cardio + longevity data');
  if (String(pick(profile, 'dietType', '')) === 'mediterranean' && wins.length < 4) wins.push('Mediterranean diet — strongest evidence for all-cause mortality');
  if (pick(profile, 'flossDaily', false) && wins.length < 4) wins.push('Daily flossing — oral bacteria drives systemic inflammation');

  if (wins.length === 0) wins.push('You showed up and filled this out — that puts you in the top 1% for intention');
  return wins.slice(0, 4);
}

export function generateTopRisks(profile: Profile, classified: BiomarkerValue[], organs: OrganSystem[]): string[] {
  const risks: string[] = [];

  const smoker = pick(profile, 'smoker', false);
  if (smoker) {
    const cigs = num(pick(profile, 'cigarettesPerDay', 0));
    risks.push(cigs >= 10 ? `Smoking ${cigs} cigs/day — costs ~10 years. #1 lever.` : 'Nicotine use — quitting wins more than anything else');
  }

  // Critical biomarkers
  const critical = classified.filter(b => b.classification === 'CRITICAL');
  critical.slice(0, 2).forEach(b => risks.push(`${b.code} at ${b.value} ${b.unit} — CRITICAL, see doctor`));

  // Bottom organ systems
  const bottomOrgans = [...organs].sort((a, b) => a.score - b.score).slice(0, 2);
  bottomOrgans.forEach(o => {
    if (o.score < 60 && risks.length < 3) risks.push(`${o.label} ${o.score}/100 — ${o.improvers[0] || 'needs attention'}`);
  });

  // Lifestyle risks
  const alc = num(pick(profile, 'alcoholPerWeek', 0));
  const cardio = num(pick(profile, 'cardioMinutesPerWeek', pick(profile, 'cardioMin', 90)));
  const sleep = num(pick(profile, 'sleepHoursAvg', pick(profile, 'sleepHours', 7)));
  const stress = num(pick(profile, 'stressLevel', 5));
  const h = num(pick(profile, 'heightCm', 0)) / 100;
  const w = num(pick(profile, 'weightKg', 0));
  const bmi = h > 0 && w > 0 ? w / (h * h) : 22;

  if (alc >= 14 && risks.length < 4) risks.push(`Alcohol ${alc}/week — consider ≤7/week`);
  if (cardio < 75 && risks.length < 4) risks.push(`Only ${cardio} min cardio/week — target 150+`);
  if (sleep < 6 && risks.length < 4) risks.push(`${sleep}h sleep — <6h doubles mortality risk`);
  if (stress >= 8 && risks.length < 4) risks.push(`Stress ${stress}/10 — chronic stress = accelerated aging`);
  if (bmi >= 30 && risks.length < 4) risks.push(`BMI ${bmi.toFixed(1)} — adiposity drives metabolic + cardio risk`);
  if (pick(profile, 'depressionSymptoms', false) && !pick(profile, 'therapyNow', false) && risks.length < 4) {
    risks.push('Untreated depression symptoms — therapy + movement first-line');
  }

  if (risks.length === 0) risks.push('No major red flags detected — keep the habits you have');
  return risks.slice(0, 4);
}

// ============================================================================
// BIOMARKER ESTIMATES — when user has no bloodwork, show expected ranges
// ============================================================================

export interface BiomarkerEstimate {
  code: string;
  shortName: string;
  unit: string;
  estimatedLow: number;
  estimatedHigh: number;
  expectedClassification: 'likely_optimal' | 'likely_borderline' | 'likely_off';
  rationale: string;
}

export function estimateBiomarkers(profile: Profile): BiomarkerEstimate[] {
  const age = num(pick(profile, 'age', 35));
  const sex = String(pick(profile, 'sex', 'male'));
  const h = num(pick(profile, 'heightCm', 0)) / 100;
  const w = num(pick(profile, 'weightKg', 0));
  const bmi = h > 0 && w > 0 ? w / (h * h) : 22;
  const smoker = pick(profile, 'smoker', false);
  const alc = num(pick(profile, 'alcoholPerWeek', 0));
  const cardio = num(pick(profile, 'cardioMinutesPerWeek', pick(profile, 'cardioMin', 90)));
  const sleep = num(pick(profile, 'sleepHoursAvg', pick(profile, 'sleepHours', 7)));
  const ultra = num(pick(profile, 'ultraProcessedPerWeek', 0));
  const fish = num(pick(profile, 'fishPerWeek', 0));
  const sunlight = num(pick(profile, 'sunlightMinutes', 0));
  const stress = num(pick(profile, 'stressLevel', 5));
  const conditions = (pick(profile, 'conditions', []) as string[]) || [];
  const dietType = String(pick(profile, 'dietType', 'omnivore'));

  const estimates: BiomarkerEstimate[] = [];

  // HbA1c
  let a1cMid = 5.2;
  if (bmi >= 30) a1cMid += 0.4;
  else if (bmi >= 27) a1cMid += 0.2;
  if (ultra >= 10) a1cMid += 0.2;
  if (cardio < 75) a1cMid += 0.1;
  if (conditions.some(c => /diabetes/i.test(c))) a1cMid += 1.5;
  estimates.push({
    code: 'HBA1C', shortName: 'HbA1c', unit: '%',
    estimatedLow: +(a1cMid - 0.2).toFixed(1),
    estimatedHigh: +(a1cMid + 0.2).toFixed(1),
    expectedClassification: a1cMid < 5.4 ? 'likely_optimal' : a1cMid < 5.7 ? 'likely_borderline' : 'likely_off',
    rationale: `Based on BMI ${bmi.toFixed(1)}, ${ultra} ultra-processed/wk, ${cardio} min cardio/wk`,
  });

  // Fasting Glucose
  let glucMid = 88;
  if (bmi >= 30) glucMid += 8;
  else if (bmi >= 27) glucMid += 4;
  if (ultra >= 15) glucMid += 4;
  if (conditions.some(c => /diabetes/i.test(c))) glucMid += 20;
  estimates.push({
    code: 'GLUC', shortName: 'Glucose', unit: 'mg/dL',
    estimatedLow: Math.round(glucMid - 4),
    estimatedHigh: Math.round(glucMid + 4),
    expectedClassification: glucMid < 95 ? 'likely_optimal' : glucMid < 110 ? 'likely_borderline' : 'likely_off',
    rationale: `BMI + diet pattern estimate`,
  });

  // LDL
  let ldlMid = 110;
  if (smoker) ldlMid += 10;
  if (bmi >= 30) ldlMid += 15;
  else if (bmi >= 27) ldlMid += 8;
  if (dietType === 'carnivore') ldlMid += 30;
  else if (dietType === 'mediterranean') ldlMid -= 10;
  else if (dietType === 'vegan') ldlMid -= 15;
  if (cardio >= 150) ldlMid -= 8;
  estimates.push({
    code: 'LDL', shortName: 'LDL-C', unit: 'mg/dL',
    estimatedLow: Math.round(ldlMid - 15),
    estimatedHigh: Math.round(ldlMid + 15),
    expectedClassification: ldlMid < 100 ? 'likely_optimal' : ldlMid < 130 ? 'likely_borderline' : 'likely_off',
    rationale: `${dietType} diet, BMI ${bmi.toFixed(1)}, ${cardio} min cardio`,
  });

  // HDL
  let hdlMid = sex === 'female' ? 60 : 50;
  if (cardio >= 150) hdlMid += 6;
  if (bmi >= 30) hdlMid -= 6;
  if (alc >= 7 && alc < 14) hdlMid += 3;
  estimates.push({
    code: 'HDL', shortName: 'HDL-C', unit: 'mg/dL',
    estimatedLow: Math.round(hdlMid - 5),
    estimatedHigh: Math.round(hdlMid + 5),
    expectedClassification: hdlMid > 55 ? 'likely_optimal' : hdlMid > 45 ? 'likely_borderline' : 'likely_off',
    rationale: 'Cardio volume + BMI',
  });

  // Triglycerides
  let trigMid = 90;
  if (bmi >= 30) trigMid += 40;
  if (ultra >= 15) trigMid += 20;
  if (alc >= 14) trigMid += 30;
  if (cardio >= 150) trigMid -= 15;
  estimates.push({
    code: 'TRIG', shortName: 'Triglycerides', unit: 'mg/dL',
    estimatedLow: Math.round(trigMid - 15),
    estimatedHigh: Math.round(trigMid + 20),
    expectedClassification: trigMid < 80 ? 'likely_optimal' : trigMid < 120 ? 'likely_borderline' : 'likely_off',
    rationale: 'BMI + refined carbs + alcohol',
  });

  // hsCRP
  let crpMid = 0.8;
  if (smoker) crpMid += 1.5;
  if (bmi >= 30) crpMid += 1.2;
  else if (bmi >= 27) crpMid += 0.5;
  if (stress >= 8) crpMid += 0.3;
  if (sleep < 6) crpMid += 0.3;
  estimates.push({
    code: 'HSCRP', shortName: 'hsCRP', unit: 'mg/L',
    estimatedLow: +(Math.max(0.1, crpMid - 0.4)).toFixed(1),
    estimatedHigh: +(crpMid + 0.5).toFixed(1),
    expectedClassification: crpMid < 1 ? 'likely_optimal' : crpMid < 3 ? 'likely_borderline' : 'likely_off',
    rationale: 'Inflammation proxies: smoking, adiposity, stress, sleep',
  });

  // Vitamin D
  let vdMid = 35;
  if (sunlight >= 15) vdMid += 10;
  else if (sunlight === 0) vdMid -= 8;
  if (bmi >= 30) vdMid -= 5;
  if ((pick(profile, 'current_supplements', '') as string | string[]).toString().toLowerCase().includes('d')) vdMid += 10;
  estimates.push({
    code: 'VITD', shortName: 'Vitamin D', unit: 'ng/mL',
    estimatedLow: Math.round(vdMid - 6),
    estimatedHigh: Math.round(vdMid + 6),
    expectedClassification: vdMid >= 40 ? 'likely_optimal' : vdMid >= 30 ? 'likely_borderline' : 'likely_off',
    rationale: `${sunlight} min sunlight/day, BMI, supplement use`,
  });

  // Omega-3 Index
  let o3Mid = 4.5;
  if (fish >= 3) o3Mid += 2.5;
  else if (fish >= 2) o3Mid += 1.5;
  else if (fish === 0) o3Mid -= 1;
  if ((pick(profile, 'current_supplements', '') as string | string[]).toString().toLowerCase().includes('omega')) o3Mid += 2;
  estimates.push({
    code: 'OMEGA3', shortName: 'Omega-3 Index', unit: '%',
    estimatedLow: +Math.max(2, o3Mid - 1).toFixed(1),
    estimatedHigh: +(o3Mid + 1).toFixed(1),
    expectedClassification: o3Mid >= 8 ? 'likely_optimal' : o3Mid >= 5 ? 'likely_borderline' : 'likely_off',
    rationale: `${fish} fish meals/wk + supplement use`,
  });

  return estimates;
}

// ============================================================================
// BRYAN JOHNSON COMPARISON METRICS (score + age gap + pace)
// ============================================================================

export interface BryanSummary {
  longevityScoreGap: number;         // positive = you ahead, negative = behind
  agingPaceGap: number;              // positive = you aging slower
  bioAgePctDifference: number;       // % younger/older than chronological
  verdict: string;                   // one-line verdict
  keyGaps: { marker: string; your: number | string; bryan: number | string }[];
}

// Bryan benchmark — re-exported from the single source of truth.
// All numbers live in lib/engine/bryan-constants.ts. Update there only.
import { BRYAN as BRYAN_SOURCE } from './bryan-constants';
export const BRYAN = BRYAN_SOURCE;

export function buildBryanSummary(
  longevityScore: number,
  agingPace: number,
  chronoAge: number,
  bioAgeDecimal: number
): BryanSummary {
  const longevityScoreGap = longevityScore - BRYAN.longevityScore;
  const agingPaceGap = +(BRYAN.agingPace - agingPace).toFixed(2);  // if yours < Bryan's, you're ahead
  const bioAgePctDifference = chronoAge > 0 ? +((chronoAge - bioAgeDecimal) / chronoAge * 100).toFixed(1) : 0;

  let verdict = '';
  if (bioAgePctDifference > 5) verdict = `You're biologically ${bioAgePctDifference}% younger than your chronological age — rare.`;
  else if (bioAgePctDifference > 0) verdict = `Biologically ${bioAgePctDifference}% younger than chronological — solid head start.`;
  else if (bioAgePctDifference > -5) verdict = `Aging at roughly chronological pace. Protocol can push you ahead.`;
  else verdict = `Biologically ${Math.abs(bioAgePctDifference)}% OLDER than chronological — reversible with focus.`;

  return {
    longevityScoreGap,
    agingPaceGap,
    bioAgePctDifference,
    verdict,
    keyGaps: [],  // filled by caller with biomarker data
  };
}
