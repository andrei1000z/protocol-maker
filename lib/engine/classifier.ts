import { BiomarkerValue, Classification } from '../types';
import { getBiomarkerRef } from './biomarkers';
import { calculatePhenoAge, extractPhenoAgeInputs } from './phenoage';

export function classifyBiomarker(value: BiomarkerValue): BiomarkerValue {
  const ref = getBiomarkerRef(value.code);
  if (!ref) return { ...value, classification: 'OPTIMAL', longevityGap: 0 };

  const v = value.value;
  const { longevityOptimalLow: lo, longevityOptimalHigh: hi } = ref;
  const optimalMid = (lo + hi) / 2;
  const optimalRange = hi - lo;

  let classification: Classification;
  let longevityGap: number;

  if (v >= lo && v <= hi) {
    classification = 'OPTIMAL';
    longevityGap = 0;
  } else if (v < lo) {
    const distFromOptimal = lo - v;
    const pctBelow = distFromOptimal / (optimalRange || 1);
    longevityGap = -distFromOptimal;

    if (pctBelow > 1.5 || v < lo * 0.4) classification = 'CRITICAL';
    else if (pctBelow > 0.8 || v < lo * 0.6) classification = 'DEFICIENT';
    else classification = 'SUBOPTIMAL_LOW';
  } else {
    const distFromOptimal = v - hi;
    const pctAbove = distFromOptimal / (optimalRange || 1);
    longevityGap = distFromOptimal;

    if (pctAbove > 2.0 || v > hi * 2.5) classification = 'CRITICAL';
    else if (pctAbove > 1.0 || v > hi * 1.8) classification = 'EXCESS';
    else classification = 'SUBOPTIMAL_HIGH';
  }

  // Special critical thresholds (clinical red flags)
  if (value.code === 'HBA1C' && v >= 6.5) classification = 'CRITICAL';
  if (value.code === 'GLUC' && v >= 126) classification = 'CRITICAL';
  if (value.code === 'INSULIN' && v >= 15) classification = 'CRITICAL';
  if (value.code === 'CREAT' && v >= 1.5) classification = 'CRITICAL';
  if (value.code === 'TSH' && (v < 0.3 || v > 6)) classification = 'CRITICAL';
  if (value.code === 'TRIG' && v >= 500) classification = 'CRITICAL';
  if (value.code === 'PLT' && (v < 100 || v > 450)) classification = 'CRITICAL';
  if (value.code === 'WBC' && (v < 3.0 || v > 12)) classification = 'CRITICAL';
  if (value.code === 'HGB' && (v < 10 || v > 18)) classification = 'CRITICAL';

  return { ...value, classification, longevityGap };
}

export function classifyAll(biomarkers: BiomarkerValue[]): BiomarkerValue[] {
  return biomarkers.map(classifyBiomarker);
}

// Lifestyle-only score component (0-100). Combines with biomarker score when both available.
function lifestyleScore(profile: Record<string, unknown>): number {
  const od = (profile.onboardingData || {}) as Record<string, unknown>;
  const pick = <T>(key: string, fallback: T): T => {
    const v = profile[key] ?? od[key];
    return (v === undefined || v === null || v === '') ? fallback : (v as T);
  };
  const num = (v: unknown) => { const n = Number(v); return Number.isFinite(n) ? n : NaN; };

  let score = 75; // baseline — average healthy person

  // Sleep (up to ±12)
  const sleep = num(pick('sleepHoursAvg', pick('sleepHours', 7)));
  if (sleep >= 7 && sleep <= 9) score += 4;
  else if (sleep < 5) score -= 12;
  else if (sleep < 6) score -= 7;
  else if (sleep < 7) score -= 3;
  else if (sleep > 10) score -= 4;
  const sq = num(pick('sleepQuality', 7));
  if (sq >= 8) score += 3;
  else if (sq <= 4) score -= 6;

  // Exercise (up to ±14)
  const cardio = num(pick('cardioMinutesPerWeek', pick('cardioMin', 90)));
  const strength = num(pick('strengthSessionsPerWeek', pick('strengthSessions', 2)));
  if (cardio >= 300 && strength >= 3) score += 10;
  else if (cardio >= 150 && strength >= 2) score += 6;
  else if (cardio >= 75) score += 2;
  else if (cardio < 30 && strength < 1) score -= 14;
  else if (cardio < 75) score -= 5;
  const steps = num(pick('stepsPerDay', 0));
  if (steps >= 10000) score += 3;
  else if (steps > 0 && steps < 3000) score -= 4;

  // BMI (up to ±12)
  const h = num(pick('heightCm', 0)) / 100;
  const w = num(pick('weightKg', 0));
  if (h > 0 && w > 0) {
    const bmi = w / (h * h);
    if (bmi >= 35) score -= 15;
    else if (bmi >= 30) score -= 9;
    else if (bmi >= 27) score -= 4;
    else if (bmi < 18.5) score -= 5;
    else if (bmi >= 20 && bmi < 25) score += 3;
  }

  // Smoking / alcohol (up to ±20)
  if (pick('smoker', false)) {
    const cigs = num(pick('cigarettesPerDay', 0));
    if (cigs >= 20) score -= 25;
    else if (cigs >= 10) score -= 18;
    else if (cigs > 0) score -= 12;
    else score -= 8;
  }
  const alc = num(pick('alcoholPerWeek', 0));
  if (alc >= 21) score -= 10;
  else if (alc >= 14) score -= 6;
  else if (alc >= 7) score -= 2;
  else if (alc === 0) score += 1;

  // Stress / mental (up to ±10)
  const stress = num(pick('stressLevel', 5));
  if (stress >= 9) score -= 8;
  else if (stress >= 7) score -= 4;
  else if (stress <= 3) score += 2;
  if (pick('depressionSymptoms', false) && !pick('therapyNow', false)) score -= 5;
  if (pick('anxietySymptoms', false) && !pick('therapyNow', false)) score -= 3;
  const purpose = num(pick('lifeSenseOfPurpose', 7));
  if (purpose >= 8) score += 2;
  else if (purpose <= 3) score -= 3;

  // Social (up to ±8)
  const lonely = num(pick('lonelinessLevel', 3));
  if (lonely >= 8) score -= 7;
  else if (lonely >= 6) score -= 3;
  const friends = num(pick('closeFriendsCount', -1));
  if (friends === 0) score -= 3;
  else if (friends >= 3) score += 1;

  // Diet quality (up to ±10)
  const dietType = String(pick('dietType', 'omnivore'));
  if (dietType === 'mediterranean') score += 3;
  const ultra = num(pick('ultraProcessedPerWeek', 0));
  if (ultra >= 20) score -= 7;
  else if (ultra >= 10) score -= 3;
  const fastFood = num(pick('fastFoodPerWeek', 0));
  if (fastFood >= 5) score -= 4;
  const veg = num(pick('veggiesPerDay', 0));
  if (veg >= 5) score += 3;
  else if (veg >= 3) score += 1;

  // Longevity habits (up to ±6)
  if (pick('sauna', false)) score += 2;
  if (String(pick('meditationPractice', '')) === 'daily') score += 2;
  if (pick('flossDaily', false)) score += 1;
  if (pick('spfDaily', false)) score += 1;

  // Conditions (up to -20)
  const conditions = (pick('conditions', []) as string[]) || [];
  conditions.forEach(c => {
    if (/diabetes/i.test(c)) score -= 8;
    else if (/hypertension|cardio/i.test(c)) score -= 6;
    else if (/autoimmune|thyroid/i.test(c)) score -= 3;
    else score -= 2;
  });

  // Fitness signals
  const vo2 = num(pick('vo2Max', 0));
  const age = num(pick('age', 35));
  if (vo2 > 0) {
    const expected = Math.max(25, 55 - (age - 20) * 0.35);
    const diff = vo2 - expected;
    score += Math.max(-8, Math.min(8, diff * 0.4));
  }
  const rhr = num(pick('restingHR', 0));
  if (rhr > 0) {
    if (rhr <= 55) score += 2;
    else if (rhr >= 80) score -= 4;
  }
  const sys = num(pick('bloodPressureSys', 0));
  const dia = num(pick('bloodPressureDia', 0));
  if (sys >= 160 || dia >= 100) score -= 10;
  else if (sys >= 140 || dia >= 90) score -= 6;
  else if (sys >= 130 || dia >= 85) score -= 2;

  return score;
}

export function calculateLongevityScore(classified: BiomarkerValue[], profile?: Record<string, unknown>): number {
  // Weight each biomarker by its strength as a longevity / all-cause-mortality
  // predictor. Values roughly reflect the effect size of the marker in large
  // cohort studies (e.g. Ference 2020 for ApoB, Ridker 2002 for hsCRP,
  // Nordestgaard 2018 for Lp(a), Kunutsor 2018 for GGT). Every biomarker in
  // BIOMARKER_DB must appear here — unweighted codes previously fell through to
  // weight=1, so a 33-marker panel scored roughly the same as the canonical 17.
  const weights: Record<string, number> = {
    // Inflammation / cardiometabolic (strongest signals)
    HSCRP: 3, HBA1C: 3, INSULIN: 2.5, APOB: 2.5, LPA: 2.5, OMEGA3: 2.5,
    // Glucose + lipids
    GLUC: 2, LDL: 2, HDL: 2, TRIG: 2, HOMOCYS: 2, VITD: 2,
    // Liver (GGT is a strong independent mortality predictor)
    GGT: 1.5, ALT: 1, AST: 1,
    // Kidney + metabolic
    CREAT: 1.5, URIC_ACID: 1.5,
    // Thyroid
    TSH: 1.5, FT4: 1, ANTI_TPO: 1.2,
    // Hormones
    TESTO: 1.5, ESTRADIOL: 1.5, CORTISOL: 1.5, DHEAS: 1.5,
    // Micronutrients
    B12: 1.5, FOLAT: 1.2, FERRITIN: 1.5, IRON: 1, MAGNE: 1.2,
    // CBC
    WBC: 1.5, HGB: 1, PLT: 1, RBC: 0.8,
  };

  let bmScore: number | null = null;
  if (classified.length > 0) {
    let totalWeight = 0;
    let weightedScore = 0;
    for (const b of classified) {
      const w = weights[b.code] || 1;
      totalWeight += w;
      // Base bucket score by classification. Then nudge within ±10 based on
      // longevityGap so a marker 1% outside optimal doesn't carry the same
      // penalty as one 50% outside. gap is normalized: 0 = at target, 1 =
      // fully outside the longevity-optimal range.
      let base = 50;
      switch (b.classification) {
        case 'OPTIMAL':         base = 100; break;
        case 'SUBOPTIMAL_LOW':
        case 'SUBOPTIMAL_HIGH': base = 65;  break;
        case 'DEFICIENT':
        case 'EXCESS':          base = 35;  break;
        case 'CRITICAL':        base = 10;  break;
      }
      const gap = Math.min(1, Math.abs(b.longevityGap ?? 0));
      // For non-optimal classifications, subtract up to 10 pts for severity;
      // for OPTIMAL, small positive gap shouldn't drag the 100 down.
      const nudge = b.classification === 'OPTIMAL' ? 0 : -10 * gap;
      weightedScore += w * Math.max(0, Math.min(100, base + nudge));
    }
    bmScore = totalWeight > 0 ? weightedScore / totalWeight : 50;
    const dataBonusFactor = Math.min(1, classified.length / 15);
    bmScore *= (0.85 + 0.15 * dataBonusFactor);
  }

  const lsScore = profile ? lifestyleScore(profile) : null;

  let final: number;
  if (bmScore !== null && lsScore !== null) {
    const bmWeight = Math.min(0.75, 0.3 + (classified.length / 15) * 0.45);
    final = bmScore * bmWeight + lsScore * (1 - bmWeight);
  } else if (bmScore !== null) {
    final = bmScore;
  } else if (lsScore !== null) {
    final = lsScore;
  } else {
    final = 50;
  }

  return Math.max(0, Math.min(100, Math.round(final)));
}

// Lifestyle-based modifiers applied on top of chronological age.
// Returns years-offset (can be negative if healthier than chronological).
// Based on published population studies (smoking: Doll 2004, sleep: Cappuccio 2010,
// exercise: Arem 2015, BMI: Di Angelantonio 2016, loneliness: Holt-Lunstad 2015, etc.)
function lifestyleAgeOffset(profile: Record<string, unknown>): number {
  let offset = 0;
  const od = (profile.onboardingData || {}) as Record<string, unknown>;
  const pick = <T>(key: string, fallback: T): T => {
    const v = profile[key] ?? od[key];
    return (v === undefined || v === null || v === '') ? fallback : (v as T);
  };
  const num = (v: unknown) => { const n = Number(v); return Number.isFinite(n) ? n : NaN; };

  // BMI
  const h = num(pick('heightCm', 0)) / 100;
  const w = num(pick('weightKg', 0));
  if (h > 0 && w > 0) {
    const bmi = w / (h * h);
    if (bmi >= 35) offset += 4;
    else if (bmi >= 30) offset += 2.5;
    else if (bmi >= 27) offset += 1;
    else if (bmi >= 25) offset += 0.4;
    else if (bmi < 18.5) offset += 1.2;
    else if (bmi >= 21 && bmi < 24) offset -= 0.5;
  }

  // Smoking / nicotine
  if (pick('smoker', false)) {
    const cigs = num(pick('cigarettesPerDay', 0));
    const vape = num(pick('vapePuffsPerDay', 0));
    if (cigs >= 20) offset += 8;
    else if (cigs >= 10) offset += 5;
    else if (cigs > 0) offset += 3;
    else if (vape > 100) offset += 2;
    else offset += 1.5;
  }

  // Alcohol
  const alc = num(pick('alcoholPerWeek', 0));
  if (alc >= 21) offset += 3;
  else if (alc >= 14) offset += 1.5;
  else if (alc >= 7) offset += 0.5;

  // Sleep
  const sleep = num(pick('sleepHoursAvg', pick('sleepHours', 7)));
  if (sleep < 5) offset += 3;
  else if (sleep < 6) offset += 1.8;
  else if (sleep < 7) offset += 0.6;
  else if (sleep >= 7 && sleep <= 9) offset -= 0.6;
  else if (sleep > 10) offset += 1;
  const sq = num(pick('sleepQuality', 7));
  if (sq <= 3) offset += 1.5;
  else if (sq <= 5) offset += 0.5;
  else if (sq >= 9) offset -= 0.3;

  // Exercise
  const cardio = num(pick('cardioMinutesPerWeek', pick('cardioMin', 90)));
  const strength = num(pick('strengthSessionsPerWeek', pick('strengthSessions', 2)));
  if (cardio < 30 && strength < 1) offset += 2.5;
  else if (cardio < 75) offset += 1;
  else if (cardio >= 300) offset -= 1.8;
  else if (cardio >= 150) offset -= 1.2;
  if (strength >= 3) offset -= 0.8;
  else if (strength >= 2) offset -= 0.4;
  else if (strength === 0) offset += 0.5;

  // Sitting / sedentary
  const sitting = num(pick('sittingHours', 6));
  if (sitting >= 10) offset += 1.2;
  else if (sitting >= 8) offset += 0.5;

  // Steps
  const steps = num(pick('stepsPerDay', 0));
  if (steps >= 10000) offset -= 0.8;
  else if (steps >= 7500) offset -= 0.4;
  else if (steps > 0 && steps < 3000) offset += 1;

  // VO2 Max, resting HR, BP, HRV
  const vo2 = num(pick('vo2Max', 0));
  const age = num(pick('age', 35));
  if (vo2 > 0) {
    const expected = Math.max(25, 55 - (age - 20) * 0.35);
    const diff = vo2 - expected;
    offset -= Math.max(-3, Math.min(3, diff * 0.15));
  }
  const rhr = num(pick('restingHR', 0));
  if (rhr > 0) {
    if (rhr >= 80) offset += 1.5;
    else if (rhr >= 70) offset += 0.4;
    else if (rhr <= 55) offset -= 0.8;
  }
  const sys = num(pick('bloodPressureSys', 0));
  const dia = num(pick('bloodPressureDia', 0));
  if (sys >= 160 || dia >= 100) offset += 3;
  else if (sys >= 140 || dia >= 90) offset += 1.8;
  else if (sys >= 130 || dia >= 85) offset += 0.6;
  else if (sys > 0 && sys < 120 && dia < 80) offset -= 0.3;
  const hrv = num(pick('hrv', 0));
  if (hrv > 0) {
    if (hrv >= 70) offset -= 0.8;
    else if (hrv >= 50) offset -= 0.3;
    else if (hrv < 25) offset += 1.2;
    else if (hrv < 35) offset += 0.5;
  }

  // Body fat
  const bf = num(pick('bodyFatPct', 0));
  const sex = String(pick('sex', 'male'));
  if (bf > 0) {
    if (sex === 'female') {
      if (bf >= 40) offset += 2;
      else if (bf >= 32) offset += 0.8;
      else if (bf >= 21 && bf <= 28) offset -= 0.3;
    } else {
      if (bf >= 30) offset += 2;
      else if (bf >= 25) offset += 0.8;
      else if (bf >= 10 && bf <= 18) offset -= 0.3;
    }
  }

  // Stress / mental health
  const stress = num(pick('stressLevel', 5));
  if (stress >= 9) offset += 2;
  else if (stress >= 7) offset += 0.8;
  else if (stress <= 3) offset -= 0.2;
  if (pick('depressionSymptoms', false) && !pick('therapyNow', false)) offset += 1.2;
  if (pick('anxietySymptoms', false) && !pick('therapyNow', false)) offset += 0.6;
  const purpose = num(pick('lifeSenseOfPurpose', 7));
  if (purpose <= 3) offset += 0.8;
  else if (purpose >= 8) offset -= 0.4;
  const happy = num(pick('happinessScore', 7));
  if (happy <= 3) offset += 1;
  else if (happy >= 8) offset -= 0.3;

  // Social
  const lonely = num(pick('lonelinessLevel', 3));
  if (lonely >= 8) offset += 1.8;
  else if (lonely >= 6) offset += 0.8;
  const friends = num(pick('closeFriendsCount', -1));
  if (friends === 0) offset += 0.8;
  else if (friends >= 3) offset -= 0.3;
  const relSat = num(pick('relationshipSatisfaction', 7));
  const relStatus = String(pick('relationshipStatus', ''));
  if (relStatus === 'partnered' || relStatus === 'married') {
    if (relSat >= 8) offset -= 0.4;
    else if (relSat <= 3) offset += 0.5;
  }

  // Diet quality signals
  const dietType = String(pick('dietType', 'omnivore'));
  if (dietType === 'mediterranean') offset -= 0.8;
  else if (dietType === 'vegan' || dietType === 'vegetarian') offset -= 0.2;
  const ultra = num(pick('ultraProcessedPerWeek', 0));
  if (ultra >= 20) offset += 1.8;
  else if (ultra >= 10) offset += 0.8;
  const fastFood = num(pick('fastFoodPerWeek', 0));
  if (fastFood >= 5) offset += 1;
  else if (fastFood >= 2) offset += 0.3;
  const veg = num(pick('veggiesPerDay', 0));
  if (veg >= 5) offset -= 0.5;
  else if (veg >= 3) offset -= 0.2;
  const fish = num(pick('fishPerWeek', 0));
  if (fish >= 2) offset -= 0.3;

  // Longevity habits
  if (pick('sauna', false)) offset -= 0.6;
  if (pick('iceBath', false)) offset -= 0.2;
  if (pick('yogaPilates', false)) offset -= 0.3;
  const meditation = String(pick('meditationPractice', 'none'));
  if (meditation === 'daily') offset -= 0.4;
  if (pick('flossDaily', false)) offset -= 0.3;
  if (pick('spfDaily', false)) offset -= 0.2;
  const sunlight = num(pick('sunlightMinutes', 0));
  if (sunlight >= 15) offset -= 0.2;

  // Environment
  const pollution = String(pick('pollutionLevel', ''));
  if (pollution === 'very_high') offset += 1.2;
  else if (pollution === 'high') offset += 0.5;
  if (pick('moldAtHome', false)) offset += 0.4;
  const water = String(pick('waterFilter', ''));
  if (water === 'ro' || water === 'carbon') offset -= 0.1;

  // Existing conditions
  const conditions = (pick('conditions', []) as string[]) || [];
  conditions.forEach(c => {
    if (/diabetes/i.test(c)) offset += 2;
    else if (/hypertension|cardio/i.test(c)) offset += 1.5;
    else if (/autoimmune|thyroid/i.test(c)) offset += 0.8;
    else if (/depression|anxiety/i.test(c)) offset += 0.5;
    else offset += 0.4;
  });

  // Family history (early onset in 1st degree relatives → small bump)
  if (pick('familyCardio', false)) offset += 0.4;
  if (pick('familyDiabetes', false)) offset += 0.3;
  if (pick('familyCancer', false)) offset += 0.3;
  if (pick('familyAlzheimers', false)) offset += 0.2;

  // COVID
  if (pick('longCovid', false)) offset += 1.2;

  // Age-calibrated clamp: teens haven't had time to accumulate full impact.
  // Also prevents a 14yo with bad habits from showing as age 32.
  const chronoAge = Number(profile.age) || 35;
  const maxOffsetUp = chronoAge < 18 ? 4 : chronoAge < 25 ? 10 : chronoAge < 40 ? 14 : 18;
  const maxOffsetDown = chronoAge < 18 ? 2 : chronoAge < 25 ? 5 : chronoAge < 40 ? 8 : 12;
  return Math.max(-maxOffsetDown, Math.min(maxOffsetUp, offset));
}

export function estimateBiologicalAge(profile: Record<string, unknown> | number, classified: BiomarkerValue[]): number {
  // Backward compatibility: if called with just a number (chronologicalAge)
  const isLegacy = typeof profile === 'number';
  const chronologicalAge = isLegacy ? (profile as number) : Number(profile.age) || 35;
  const profileObj = isLegacy ? { age: chronologicalAge } : (profile as Record<string, unknown>);

  // Try PhenoAge first if enough biomarkers
  if (classified.length > 0) {
    const phenoInputs = extractPhenoAgeInputs(classified);
    const phenoAge = calculatePhenoAge(phenoInputs, chronologicalAge);
    if (phenoAge !== null && phenoAge > 0 && phenoAge < 120) {
      // Even with PhenoAge, apply a small lifestyle nudge (20% weight)
      const lifestyleOff = lifestyleAgeOffset(profileObj);
      return Math.max(5, Math.round((phenoAge + lifestyleOff * 0.2) * 10) / 10);
    }
  }

  // Biomarker-score nudge on top of chronological age
  let bioAge = chronologicalAge;
  if (classified.length > 0) {
    const score = calculateLongevityScore(classified);
    const offset = ((50 - score) / 50) * 6;
    const criticalCount = classified.filter(b => b.classification === 'CRITICAL').length;
    bioAge += offset + criticalCount * 1.2;
  }

  // Add lifestyle offset (primary driver when no biomarkers)
  bioAge += lifestyleAgeOffset(profileObj);

  return Math.max(5, Math.round(bioAge * 10) / 10);
}

// DunedinPACE-style aging velocity. 1.00 = normal rate. < 1 = slower aging. > 1 = faster.
// Typical range: 0.65 (elite health) → 1.45 (poor habits + disease).
export function estimateAgingPace(profile: Record<string, unknown>, classified: BiomarkerValue[]): number {
  const chronologicalAge = Number(profile.age) || 35;
  const bioAge = estimateBiologicalAge(profile, classified);

  // Base pace from bio-age divergence over chronological age
  // e.g. 5yr ahead at age 35 → (35+5)/35 = 1.14 pace ratio, scaled toward 1.0
  const ageRatio = bioAge / Math.max(20, chronologicalAge);
  let pace = 1.0 + (ageRatio - 1.0) * 0.8;

  // Adjust for current trajectory (recent habits predict NEXT year's pace, not last)
  const od = (profile.onboardingData || {}) as Record<string, unknown>;
  const pick = <T>(key: string, fallback: T): T => {
    const v = profile[key] ?? od[key];
    return (v === undefined || v === null || v === '') ? fallback : (v as T);
  };
  const num = (v: unknown) => { const n = Number(v); return Number.isFinite(n) ? n : NaN; };

  // Poor habits accelerate
  if (pick('smoker', false)) pace += 0.08;
  const alc = num(pick('alcoholPerWeek', 0));
  if (alc >= 14) pace += 0.05;
  const sleep = num(pick('sleepHoursAvg', pick('sleepHours', 7)));
  if (sleep < 6) pace += 0.06;
  const stress = num(pick('stressLevel', 5));
  if (stress >= 8) pace += 0.04;
  const cardio = num(pick('cardioMinutesPerWeek', pick('cardioMin', 90)));
  if (cardio < 30) pace += 0.03;
  else if (cardio >= 300) pace -= 0.04;
  const ultra = num(pick('ultraProcessedPerWeek', 0));
  if (ultra >= 15) pace += 0.04;

  // Good habits decelerate
  if (pick('sauna', false)) pace -= 0.02;
  if (String(pick('dietType', '')) === 'mediterranean') pace -= 0.02;
  if (String(pick('meditationPractice', '')) === 'daily') pace -= 0.02;
  if (pick('flossDaily', false)) pace -= 0.01;

  // Critical biomarkers accelerate
  const crit = classified.filter(b => b.classification === 'CRITICAL').length;
  pace += crit * 0.04;

  // Conditions
  const conditions = (pick('conditions', []) as string[]) || [];
  if (conditions.some(c => /diabetes/i.test(c))) pace += 0.06;
  if (conditions.some(c => /hypertension|cardio/i.test(c))) pace += 0.04;

  // Clamp
  return Math.max(0.6, Math.min(1.55, Math.round(pace * 100) / 100));
}

export function getClassificationColor(c: Classification): string {
  switch (c) {
    case 'OPTIMAL': return 'text-accent';
    case 'SUBOPTIMAL_LOW':
    case 'SUBOPTIMAL_HIGH': return 'text-amber-400';
    case 'DEFICIENT':
    case 'EXCESS': return 'text-orange-400';
    case 'CRITICAL': return 'text-red-400';
  }
}

export function getClassificationBg(c: Classification): string {
  switch (c) {
    case 'OPTIMAL': return 'bg-accent/10 border-accent/30';
    case 'SUBOPTIMAL_LOW':
    case 'SUBOPTIMAL_HIGH': return 'bg-amber-500/10 border-amber-500/30';
    case 'DEFICIENT':
    case 'EXCESS': return 'bg-orange-500/10 border-orange-500/30';
    case 'CRITICAL': return 'bg-red-500/10 border-red-500/30';
  }
}

export function getClassificationLabel(c: Classification): string {
  switch (c) {
    case 'OPTIMAL': return 'Optimal';
    case 'SUBOPTIMAL_LOW': return 'Low';
    case 'SUBOPTIMAL_HIGH': return 'High';
    case 'DEFICIENT': return 'Deficient';
    case 'EXCESS': return 'Excess';
    case 'CRITICAL': return 'Critical';
  }
}
