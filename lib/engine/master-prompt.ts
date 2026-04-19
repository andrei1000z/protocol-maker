import { BiomarkerValue, UserProfile, DetectedPattern, BiomarkerReference } from '../types';

// ═══════════════════════════════════════════════════════════════
// MASTER PROMPT v2 — Claude Opus 4.6 Protocol Synthesis Engine
// This is the CROWN JEWEL of the entire application.
// Every word matters. Do not edit without testing extensively.
// ═══════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────────────────────────
// Token trimmers — reduce prompt size by filtering out content not relevant
// to THIS user's actual biomarkers. Saves ~30-40% tokens for users with few
// markers, leaves room for richer AI output before hitting the 16k cap.
// ─────────────────────────────────────────────────────────────────────────────

// Maps biomarker code prefix in BRYAN_REFERENCE / INTERVENTION_RULES sections
// to our internal codes. Lines mentioning markers user doesn't have are dropped.
const SECTION_MARKER_KEYWORDS: Record<string, string[]> = {
  HBA1C:    ['hba1c', 'a1c'],
  GLUC:     ['glucose', 'fasting glucose'],
  INSULIN:  ['insulin'],
  LDL:      ['ldl', 'ldl-c'],
  HDL:      ['hdl', 'hdl-c'],
  TRIG:     ['triglycerides', 'tg/hdl'],
  HSCRP:    ['hscrp', 'crp', 'inflammation'],
  HOMOCYS:  ['homocysteine'],
  WBC:      ['wbc'],
  TSH:      ['tsh'],
  TESTO:    ['testosterone'],
  ALT:      ['alt'],
  AST:      ['ast'],
  GGT:      ['ggt'],
  CREAT:    ['creatinine', 'cystatin'],
  URIC:     ['uric acid'],
  VITD:     ['vitamin d'],
  B12:      ['b12'],
  FERRITIN: ['ferritin'],
  FOLAT:    ['folate'],
  MAGNE:    ['magnesium'],
  OMEGA3:   ['omega-3', 'omega 3'],
  APOB:     ['apob', 'apo b'],
};

function trimBryanReference(ref: string, classified: BiomarkerValue[]): string {
  const userCodes = new Set(classified.map(b => b.code));
  // Always include all lines NOT tied to a specific marker (intro, supplements,
  // nutrition, exercise, sleep — those are universal). For "KEY BIOMARKER
  // TARGETS" section, drop lines for markers user doesn't have.
  let inTargetsSection = false;
  return ref.split('\n').filter(line => {
    if (line.includes('KEY BIOMARKER TARGETS')) { inTargetsSection = true; return true; }
    if (line.includes('BRYAN\'S TOP 30 SUPPLEMENTS') || line.includes('BRYAN\'S DAILY NUTRITION')) { inTargetsSection = false; return true; }
    if (!inTargetsSection) return true;
    // Inside targets section — only keep markers the user has
    const trimmed = line.trim();
    if (!trimmed.startsWith('- ')) return true;  // section header / blank
    return Object.entries(SECTION_MARKER_KEYWORDS).some(([code, keywords]) =>
      userCodes.has(code) && keywords.some(kw => trimmed.toLowerCase().includes(kw))
    );
  }).join('\n');
}

function trimInterventionRules(rules: string, classified: BiomarkerValue[]): string {
  // Intervention rules are organized in blocks per system (INFLAMMATION,
  // GLUCOSE/INSULIN, LIPIDS, etc.). Keep only blocks where user has at least
  // one relevant marker.
  const userCodes = new Set(classified.map(b => b.code));
  const sections = rules.split(/\n(?=[A-Z][A-Z/ ]+:)/);  // split on lines like "INFLAMMATION (..."
  return sections.filter((section, i) => {
    if (i === 0) return true; // intro
    const headerMatch = section.match(/^([A-Z/ ]+)/);
    if (!headerMatch) return true;
    const header = headerMatch[1].toLowerCase();
    // Keep section if any of its keywords match user's markers
    if (header.includes('inflammation')) return userCodes.has('HSCRP') || userCodes.has('HOMOCYS') || userCodes.has('WBC');
    if (header.includes('glucose') || header.includes('insulin')) return userCodes.has('GLUC') || userCodes.has('HBA1C') || userCodes.has('INSULIN');
    if (header.includes('lipid')) return userCodes.has('LDL') || userCodes.has('HDL') || userCodes.has('TRIG') || userCodes.has('APOB');
    if (header.includes('thyroid')) return userCodes.has('TSH') || userCodes.has('FT4') || userCodes.has('FT3');
    if (header.includes('hormone')) return userCodes.has('TESTO') || userCodes.has('ESTRA') || userCodes.has('DHEAS');
    if (header.includes('liver')) return userCodes.has('ALT') || userCodes.has('AST') || userCodes.has('GGT');
    if (header.includes('kidney')) return userCodes.has('CREAT') || userCodes.has('URIC');
    if (header.includes('vitamin') || header.includes('mineral')) return userCodes.has('VITD') || userCodes.has('B12') || userCodes.has('FERRITIN') || userCodes.has('FOLAT') || userCodes.has('MAGNE');
    return true;
  }).join('\n');
}

const BRYAN_REFERENCE = `
═══ BRYAN JOHNSON BLUEPRINT REFERENCE (calibration anchor) ═══

Bryan Johnson, age 47, spends ~$2M/year with a team of 30+ doctors.
His protocol has reversed his biological age by 5.1 years.
Aging speed: 0.69 years per calendar year (DunedinPACE).
Use his data as the GOLD STANDARD target — but adapt to the patient.

KEY BIOMARKER TARGETS (Bryan's actual values):
- HbA1c: 4.5% (optimal <5.2)
- Fasting Insulin: 3.0 µIU/mL (optimal <5)
- LDL-C: 45 mg/dL (on Repatha — optimal <100, aggressive <70)
- HDL-C: 78 mg/dL (optimal >55)
- Triglycerides: 44 mg/dL (optimal <80)
- hsCRP: <0.1 mg/L (THE most important marker — optimal <0.5)
- Vitamin D: 67.8 ng/mL (optimal 50-80)
- Omega-3 Index: 9.98% (optimal >8)
- ALT/AST: 10/13 U/L (optimal <25)
- Testosterone: 941 ng/dL (optimal 500-900)
- Cystatin-C: 0.61 mg/L (optimal <1.0)
- VO2 Max: 58.7 mL/kg/min (top 1.5% for 18-year-olds)
- Body fat: 6.9%
- Bone density: top 99.8% for 30-year-olds

BRYAN'S TOP 30 SUPPLEMENTS (daily unless noted):
Morning shake: Creatine 2.5g, CaAKG 2g, Taurine 1.5g, Glycine 1.2g, 
  L-Lysine 1g, Glucosamine 1.5g, Vitamin C 250mg, L-Glutathione 250mg, 
  L-Theanine 200mg, Magnesium Citrate 150mg, Hyaluronic Acid 120mg, 
  Collagen Peptides 12.5g, GOS prebiotic, Inulin
Morning pills: Ashwagandha KSM-66 600mg, Vitamin D3 2000IU, 
  CoQ10 Ubiquinol 100mg, EPA 500mg, Fisetin 200mg, NMN 500mg (6x/week),
  Vitamin K2-MK7 600mcg, K2-MK4 5mg, K1 1.5mg, Zinc 15mg, 
  Lithium Orotate 1mg, Lycopene 10mg, Spermidine 10mg,
  BroccoMax Sulforaphane 17.5mg, Proferrin Iron 10.5mg, Iodine 125mcg
Dinner pills: NAC 1800mg, Curcumin 1g, Omega-3 800mg, Genistein 125mg,
  L-Tyrosine 500mg, Metformin ER 500mg (Rx), Acarbose 200mg (Rx)
Evening: Melatonin 0.3mg (micro-dose!), Taurine 2g, Curcumin 1g,
  Baby Aspirin 81mg (3x/week), Levothyroxine 112mcg (Rx)

BRYAN'S DAILY NUTRITION (~2,250 kcal):
- Eating window: 5:25 AM to 11:00 AM (19-hour fast)
- 100% plant-based + collagen peptides
- 45ml EVOO daily (400+ mg polyphenols/kg)
- Zero: alcohol, coffee, sugar, processed food, dairy, seed oils
- Meal 1 "Super Veggie": black lentils 45g + broccoli 250g + 
  cauliflower 150g + shiitake 50g + garlic + ginger + EVOO
- Meal 2 "Nutty Pudding": macadamia nuts + chia + flax + 
  berries + pomegranate juice + dark chocolate + pea protein
- Meal 3: rotating plant-based bowls ~500 kcal

BRYAN'S EXERCISE (~6 hrs/week):
- Daily 60 min: backward sled 10min, Poliquin step-ups, 
  slant board squats, ATG split squats, Nordic curls, 
  pull-ups 30/day, chin-ups 30/day, ab raises 50, 
  hyperextension obliques 50 each side
- MWF: +10 min HIIT (60s max effort / 60s recovery, 8-10 rounds)
- Zone 2 target: 150 min/week
- Vigorous: 75 min/week

BRYAN'S SLEEP (his #1 priority):
- Bedtime: 8:30 PM sharp, every night
- Wake: 5:00 AM natural (no alarm)
- Screens off 7:30 PM (1 hour before bed)
- Last meal 11:00 AM (9.5 hours before bed)
- Stop liquids 4:00 PM
- Room: 18-20°C, total darkness, white noise
- Eight Sleep Pod (temperature-controlled mattress)
- 10,000 lux light therapy 3-6 min at wake
- Melatonin 0.3mg (physiological dose)

WHAT BRYAN HAS STOPPED AND WHY:
- Rapamycin: STOPPED Sept 2024 (accelerated aging on 16 epigenetic clocks)
- Young plasma from son: STOPPED July 2023 (zero measurable benefit)
- Cerebrolysin: STOPPED (zero measurable effect)
- Fat transplant to face: FAILED (severe allergic reaction)

WHAT HE ADDED IN 2026:
- Lithium Orotate 1mg (neuroprotection)
- NDGA 50mg (extended lifespan in mice)
- NMN reduced from 7 to 6 days/week
- HBOT 45 min daily
- IHHT 32 min daily
`;

const INTERVENTION_RULES = `
═══ BIOMARKER-TO-INTERVENTION DECISION RULES ═══
Apply these rules based on the patient's ACTUAL values.
Only include interventions where the biomarker is OUT of optimal range.

INFLAMMATION (hsCRP, Homocysteine, WBC):
- hsCRP > 1.0: Omega-3 EPA/DHA 2-3g/day, Curcumin 1g with piperine, 
  NAC 1.2g/day, eliminate processed food, check dental health
- hsCRP > 3.0: ADD medical referral, check for hidden infection
- Homocysteine > 10: Methylfolate 800mcg + B12 1000mcg + P5P 50mg
- Homocysteine > 15: URGENT medical referral, check MTHFR
- WBC > 7.0: Anti-inflammatory protocol, check for infection source

GLUCOSE/INSULIN:
- Fasting glucose 95-125: Time-restricted eating 16:8, berberine 1g/day,
  walk 30min after meals, reduce refined carbs dramatically
- Fasting glucose > 125: URGENT — discuss metformin, endocrinologist
- HbA1c 5.3-5.6: Berberine 500mg 2x/day, magnesium 400mg, 
  chromium 200mcg, fiber 30g/day, HIIT 3x/week
- HbA1c 5.7-6.4 (prediabetic): ALL above + discuss metformin + 
  endocrinologist referral + CGM recommended
- HbA1c > 6.5: URGENT — diabetes, immediate medical care
- Insulin > 7: Insulin resistance present — TRE, strength training,
  berberine, reduce carbs, walk after every meal
- Insulin > 15: URGENT — severe insulin resistance

LIPIDS:
- LDL > 130: Psyllium fiber 10g/day, citrus bergamot 1g/day, 
  plant sterols, increase olive oil, discuss statin if >160
- LDL > 160 + hsCRP > 1.5: HIGH cardiovascular risk — statin discussion,
  ApoB test, coronary calcium score recommended
- HDL < 45: Exercise (biggest HDL raiser), reduce refined carbs, 
  olive oil 2-3 tbsp/day, niacin 500mg optional
- Triglycerides > 150: ELIMINATE alcohol, reduce sugar and refined carbs,
  omega-3 2-4g/day, berberine, exercise daily
- TG/HDL ratio > 2.0: Metabolic dysfunction marker — full metabolic protocol

THYROID:
- TSH > 2.5: Selenium 200mcg, zinc 25mg, check iodine status,
  full thyroid panel (FT3, FT4, anti-TPO)
- TSH > 4.0: Endocrinologist referral, likely hypothyroid
- TSH < 0.4: URGENT — check hyperthyroidism

HORMONES:
- Testosterone < 400 (male): Sleep optimization FIRST, strength training,
  zinc 30mg, vitamin D 4000IU, ashwagandha 600mg, reduce body fat,
  eliminate alcohol, check SHBG/LH/FSH
- Testosterone < 300: Endocrinologist referral for TRT discussion
- DHEA-S low for age: DHEA 25-50mg (discuss with doctor)

LIVER:
- ALT > 40: NAC 1200mg/day, milk thistle 300mg, eliminate alcohol,
  reduce fructose, liver ultrasound if >60
- ALT + AST both > 40: Liver workup needed
- GGT > 50: Alcohol marker — eliminate alcohol, NAC

KIDNEY:
- Creatinine > 1.3 or eGFR < 60: Nephrology referral, 
  increase hydration, check cystatin-C for confirmation
- Uric acid > 7.0: Reduce purines, hydrate aggressively, 
  check kidney function, discuss allopurinol if >9

VITAMINS/MINERALS:
- Vitamin D < 30: D3 4000-5000 IU + K2-MK7 200mcg daily with fat
- Vitamin D < 20: D3 5000-10000 IU loading dose + retest 8 weeks
- B12 < 400: Methylcobalamin 1000mcg sublingual daily
- Ferritin < 30: Iron bisglycinate 25-50mg + vitamin C for absorption
- Ferritin > 200 (male): Donate blood quarterly, check hemochromatosis
- Folate < 10: Methylfolate 400-800mcg
- Magnesium < 1.8: Magnesium glycinate 400mg evening
- Omega-3 Index < 6: Omega-3 EPA/DHA 2-3g/day + fatty fish 3x/week

BLOOD COUNT:
- Hemoglobin < 13 (M) or < 12 (F): Investigate anemia cause
- WBC < 3.5: Medical investigation needed
- Platelets < 150 or > 400: Medical investigation needed
`;

const BUDGET_RULES = `
═══ BUDGET-CONSTRAINED SUPPLEMENT PRIORITIZATION ═══

Tier 1 — ESSENTIALS (under 200 RON/month, ~€40):
Only recommend these if budget is very limited:
1. Vitamin D3 2000-4000 IU (~25 RON/month)
2. Omega-3 EPA/DHA 1-2g (~50 RON/month)
3. Magnesium Glycinate 400mg (~30 RON/month)
4. Creatine Monohydrate 5g (~25 RON/month)
Total: ~130 RON/month

Tier 2 — STRONG FOUNDATION (200-500 RON/month):
Add to Tier 1:
5. Vitamin K2-MK7 200mcg (~30 RON/month)
6. NAC 1200mg (~35 RON/month)
7. Zinc 15-25mg (~20 RON/month)
8. Curcumin 500mg with piperine (~40 RON/month)
9. Ashwagandha KSM-66 600mg (~35 RON/month)
Total: ~290 RON/month

Tier 3 — COMPREHENSIVE (500-1500 RON/month):
Add to Tier 2:
10. CoQ10 Ubiquinol 100mg (~80 RON/month)
11. B-Complex methylated (~25 RON/month)
12. Berberine 1000mg (~50 RON/month) — if glucose issues
13. Collagen Peptides 15g (~70 RON/month)
14. Probiotics (~50 RON/month)
15. Melatonin 0.3mg (~15 RON/month)
Total: ~580 RON/month

Tier 4 — ADVANCED (1500+ RON/month):
Add to Tier 3:
16. NMN 500mg (~200 RON/month)
17. Fisetin 200mg (~80 RON/month)
18. Spermidine (~100 RON/month)
19. Sulforaphane/BroccoMax (~60 RON/month)
20. Taurine 3g (~30 RON/month)
21. Glycine 3g (~25 RON/month)
22. Hyaluronic Acid 200mg (~40 RON/month)
Total: ~1115 RON/month

NEVER exceed the patient's stated budget.
If budget is tight, explain WHY you prioritized certain supplements.
Always show the total monthly cost.
`;

const UNIVERSAL_TIPS = `
═══ UNIVERSAL LONGEVITY TIPS (include for ALL patients) ═══

These are evidence-based habits that benefit EVERYONE regardless of biomarkers:

MOVEMENT:
- Walk 8,000-10,000 steps daily (strongest mortality predictor)
- Strength train 2-3x/week minimum (sarcopenia prevention)
- 150 min/week Zone 2 cardio (mitochondrial health)
- Move every 30 minutes if sedentary job (2-3 min micro-breaks)
- Walk 5-10 minutes after every meal (glucose management)

SLEEP:
- 7-9 hours consistently (non-negotiable)
- Same bedtime ±30 min every night including weekends
- Screens off 60 min before bed (blue light = delayed melatonin)
- Morning sunlight 10-15 min within first hour (circadian anchor)
- Bedroom: cool (18-20°C), dark (blackout), quiet
- Stop caffeine by 2 PM (half-life 5-7 hours)
- Last meal 3+ hours before bed
- Stop liquids 2-3 hours before bed

NUTRITION:
- Eat 30+ different plants per week (microbiome diversity)
- 25-35g fiber daily (most people get 15g)
- 2-3 tbsp extra virgin olive oil daily (polyphenols)
- Minimize ultra-processed food (strongest dietary risk factor)
- Protein: 1.6-2.2g/kg for muscle synthesis
- Hydrate: 2-3L water daily (more if active/hot climate)
- Eat the rainbow: diverse colored vegetables daily
- Fermented foods: kimchi, sauerkraut, kefir, yogurt

MENTAL/STRESS:
- Daily stress management practice (meditation, breathwork, journaling)
- Social connection (loneliness = 15 cigarettes/day mortality equivalent)
- Purpose/meaning (strong longevity predictor)
- Limit doom-scrolling and news overconsumption
- Nature exposure 120+ min/week

ORAL HEALTH:
- Floss daily (gum disease linked to cardiovascular disease)
- Brush 2x/day with soft brush, 30 min after meals
- Tongue scraping (reduces bacterial load)
- Dentist 2x/year minimum

ENVIRONMENT:
- Air purifier with HEPA filter (indoor air often worse than outdoor)
- Water filter (reverse osmosis + remineralization ideal)
- Minimize plastic contact with food (glass/steel containers)
- Red/amber lighting 1-2 hours before bed

SUBSTANCES TO MINIMIZE/ELIMINATE:
- Alcohol: ideally zero (no safe dose for longevity — reduces deep sleep ~80%)
- Smoking: absolute zero (single worst longevity factor)
- Processed sugar: minimize aggressively
- Seed oils: replace with olive oil, avocado oil, coconut oil
- Ultra-processed food: <10% of calories
`;

export function buildMasterPromptV2(
  profile: UserProfile,
  classifiedBiomarkers: BiomarkerValue[],
  patterns: DetectedPattern[],
  biomarkerRefs: BiomarkerReference[],
  longevityScore: number,
  biologicalAge: number
): string {
  const bmi = profile.weightKg / ((profile.heightCm / 100) ** 2);
  const bmiCategory = bmi < 18.5 ? 'underweight' : bmi < 25 ? 'normal' : bmi < 30 ? 'overweight' : 'obese';
  
  const biomarkerSummary = classifiedBiomarkers.map((b) => {
    const ref = biomarkerRefs.find((r) => r.code === b.code);
    if (!ref) return '';
    const gapDir = (b.longevityGap || 0) > 0 ? 'HIGH' : (b.longevityGap || 0) < 0 ? 'LOW' : 'ON TARGET';
    return `- ${ref.shortName}: ${b.value} ${b.unit} [${b.classification}] (optimal: ${ref.longevityOptimalLow}-${ref.longevityOptimalHigh}, Bryan: ${ref.bryanJohnsonValue ?? 'N/A'}, direction: ${gapDir}, gap: ${Math.abs(b.longevityGap || 0).toFixed(1)})`;
  }).filter(Boolean).join('\n');

  const patternSummary = patterns.length > 0
    ? patterns.map((p) => `- ${p.name} [${p.severity.toUpperCase()}]: triggered by ${p.triggeringMarkers.join(', ')}\n  Description: ${p.description}`).join('\n')
    : '- No risk patterns detected';

  const hasBiomarkers = classifiedBiomarkers.length > 0;
  const criticalMarkers = classifiedBiomarkers.filter(b => b.classification === 'CRITICAL');
  const hasCritical = criticalMarkers.length > 0;

  const medicationList = profile.medications?.length > 0
    ? profile.medications.map(m => `${m.name} ${m.dose} (${m.frequency})`).join(', ')
    : 'None reported';

  const supplementList = profile.currentSupplements?.length > 0
    ? profile.currentSupplements.join(', ')
    : 'None reported';

  // ═══ DEEP CONTEXT EXTRACTION (v3) ═══
  // Prefer top-level typed fields; fall back to onboardingData blob if not set
  const od = (profile as UserProfile & { onboardingData?: Record<string, unknown> }).onboardingData || {};
  const pick = <T,>(key: string, fallback?: T): T | undefined =>
    (profile as unknown as Record<string, unknown>)[key] as T ?? (od[key] as T) ?? fallback;

  const chronotype = pick<string>('chronotype');
  const bedtime = pick<string>('bedtime');
  const wakeTime = pick<string>('wakeTime');
  const sleepIssues = pick<string[]>('sleepIssues', []) || [];
  const workStart = pick<string>('workStart');
  const workEnd = pick<string>('workEnd');
  const workLocation = pick<string>('workLocation');
  const scheduleType = pick<string>('scheduleType');
  const activeDays = pick<string[]>('activeDays', []) || [];
  const gymAccess = pick<string>('gymAccess');
  const gymEquipment = pick<string[]>('gymEquipment', []) || [];
  const sittingHours = pick<number>('sittingHours');
  const exerciseWindow = pick<string>('exerciseWindow');
  const screenTime = pick<number>('screenTime');
  const stressLevel = pick<number>('stressLevel');
  const meditationPractice = pick<string>('meditationPractice');
  const familyHistory = pick<string[]>('familyHistory', []) || [];
  const foodAllergies = pick<string[]>('foodAllergies', []) || [];
  const painPoints = pick<string>('painPoints');
  const nonNegotiables = pick<string>('nonNegotiables');
  const primaryGoal = pick<string>('primaryGoal');
  const specificTarget = pick<string>('specificTarget');
  const timelineMonths = pick<number>('timelineMonths');
  const ethnicity = pick<string>('ethnicity') || profile.ethnicity;
  const restingHR = pick<number>('restingHR');
  const occupationType = pick<string>('occupationType');
  const mealsPerDay = pick<number>('mealsPerDay');
  const hydrationGlasses = pick<number>('hydrationGlasses');

  // Wearables + home equipment — drive tracking + protocol recommendations
  const smartwatchBrand = pick<string>('smartwatchBrand');
  const smartwatchModel = pick<string>('smartwatchModel');
  const smartwatchOther = pick<string>('smartwatchOther');
  const smartRingBrand = pick<string>('smartRingBrand');
  const smartRingModel = pick<string>('smartRingModel');
  const smartRingOther = pick<string>('smartRingOther');
  const equipmentOwnership = pick<Record<string, string>>('equipmentOwnership', {}) || {};
  const equipmentNotes = pick<Record<string, string>>('equipmentNotes', {}) || {};

  // Derive target bedtime (8.5h before wake time)
  let derivedBedtime: string | undefined;
  if (wakeTime) {
    const [h, m] = wakeTime.split(':').map(Number);
    const wakeMinutes = h * 60 + m;
    const bedMinutes = (wakeMinutes - 8.5 * 60 + 24 * 60) % (24 * 60);
    const bh = Math.floor(bedMinutes / 60);
    const bm = Math.round(bedMinutes % 60);
    derivedBedtime = `${String(bh).padStart(2, '0')}:${String(bm).padStart(2, '0')}`;
  }

  // Derive eating window (last meal 3h before bed, 10h window)
  let derivedEatingWindow: string | undefined;
  if (derivedBedtime) {
    const [bh, bm] = derivedBedtime.split(':').map(Number);
    const lastMealMinutes = (bh * 60 + bm - 3 * 60 + 24 * 60) % (24 * 60);
    const firstMealMinutes = (lastMealMinutes - 10 * 60 + 24 * 60) % (24 * 60);
    const fh = Math.floor(firstMealMinutes / 60);
    const lh = Math.floor(lastMealMinutes / 60);
    derivedEatingWindow = `${String(fh).padStart(2, '0')}:00 - ${String(lh).padStart(2, '0')}:00 (10h window, last meal 3h before bed)`;
  }

  // Derive work-tethered exercise window
  let optimalExerciseSlot: string | undefined;
  if (exerciseWindow === 'morning' && workStart) {
    const [wh, wm] = workStart.split(':').map(Number);
    const exerciseStart = (wh * 60 + wm - 75 + 24 * 60) % (24 * 60);
    const eh = Math.floor(exerciseStart / 60);
    const em = Math.round(exerciseStart % 60);
    optimalExerciseSlot = `${String(eh).padStart(2, '0')}:${String(em).padStart(2, '0')} — 45 min window before work starts`;
  } else if (exerciseWindow === 'evening' && workEnd) {
    optimalExerciseSlot = `${workEnd} — right after work, before dinner`;
  } else if (exerciseWindow === 'lunch' && workStart && workEnd) {
    optimalExerciseSlot = 'Lunch hour — 30-45 min workout window';
  }

  const personalContext = `
═══════════════════════════════════════════════
    PATIENT'S DAILY CONTEXT (USE ALL OF THIS)
═══════════════════════════════════════════════

👤 IDENTITY
${ethnicity ? `- Ethnicity: ${ethnicity} (adjust biomarker reference ranges where applicable — e.g. vitamin D thresholds vary by skin tone, ferritin varies by sex)` : ''}
${restingHR ? `- Resting HR: ${restingHR} bpm ${restingHR < 55 ? '(excellent cardiovascular fitness)' : restingHR > 75 ? '(elevated — indicates poor cardio fitness or stress)' : '(normal)'}` : ''}

💼 WORK / SCHOOL
${scheduleType === 'school' ? '- Type: SCHOOL (student) — daily schedule MUST show school block, supplements timed around it' :
  scheduleType === 'work' ? '- Type: Standard work' :
  scheduleType === 'both' ? '- Type: School + part-time work' :
  scheduleType === 'freelance' ? '- Type: Freelance — flexible schedule, can plan exercise mid-day' :
  scheduleType === 'none' ? '- Type: No work/school — fully open schedule' :
  ''}
${workStart && workEnd && scheduleType !== 'none' ? `- Hours: ${workStart} - ${workEnd} (${workLocation || 'location unspecified'})` : '- Hours: not specified'}
${activeDays.length > 0 && activeDays.length < 7 ? `- Active days: ${activeDays.join(', ')} | Free days: ${['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].filter(d => !activeDays.includes(d)).join(', ')} → schedule heavier workouts on free days` : ''}
${sittingHours !== undefined ? `- Sedentary: ${sittingHours} hrs/day sitting ${sittingHours > 8 ? '→ CRITICAL: must include hourly movement breaks + evening walk' : ''}` : ''}
${occupationType ? `- Occupation type: ${occupationType}${occupationType === 'shift' ? ' → circadian misalignment likely, sleep protocol must account for this' : ''}` : ''}
${screenTime !== undefined ? `- Screen time: ${screenTime} hrs/day${screenTime > 10 ? ' → eye strain + blue light at night highly likely' : ''}` : ''}

🏋️ GYM ACCESS
${gymAccess === 'full_gym' ? '- FULL GYM (barbells, racks, machines) → prescribe traditional progressive overload programming with compound lifts' :
  gymAccess === 'home_gym' ? `- HOME GYM with equipment: ${gymEquipment.join(', ') || '(unspecified)'} → adapt the plan to use what they have` :
  gymAccess === 'minimal' ? `- CALISTHENICS / MINIMAL EQUIPMENT: ${gymEquipment.join(', ') || 'bodyweight + bands'} → prescribe pull-ups, push-up variations, pistol squats, hollow body, etc.` :
  gymAccess === 'none' ? '- NO EQUIPMENT — bodyweight only. Use squats, push-ups, lunges, plank, walking. NO barbell/dumbbell exercises.' :
  '- Gym access: not specified'}
- Set exercise.gymAccess in the JSON to: ${gymAccess === 'full_gym' ? '"gym"' : gymAccess === 'home_gym' || gymAccess === 'minimal' ? '"home"' : gymAccess === 'none' ? '"none"' : '(infer)'}

⌚ WEARABLES
${(() => {
  const lines: string[] = [];
  const smartwatch = smartwatchBrand && smartwatchBrand !== 'none'
    ? (smartwatchBrand === 'Other'
        ? (smartwatchOther ? `${smartwatchOther} (user-typed — infer capabilities)` : null)
        : `${smartwatchBrand}${smartwatchModel ? ` ${smartwatchModel}` : ''}`)
    : null;
  const smartRing = smartRingBrand && smartRingBrand !== 'none'
    ? (smartRingBrand === 'Other'
        ? (smartRingOther ? `${smartRingOther} (user-typed)` : null)
        : `${smartRingBrand}${smartRingModel ? ` ${smartRingModel}` : ''}`)
    : null;
  if (smartwatch) lines.push(`- Smartwatch: ${smartwatch} — surface metrics their watch can actually measure (sleep stages, HRV, SpO2, etc.). Don't ask them to track things the device can't see.`);
  if (smartRing) lines.push(`- Smart ring: ${smartRing} — rings excel at night-time HRV + skin temp + sleep staging. Prioritize these in their tracking plan.`);
  if (!smartwatch && !smartRing) lines.push('- No wearables reported — tracking plan should rely on manual logs (sleep hours, mood, steps via phone) or suggest a $40-80 starter (Mi Band 9, Amazfit Active Edge).');
  return lines.join('\n');
})()}

🏠 HOME EQUIPMENT OWNERSHIP
${(() => {
  const owned: string[] = [];
  const willBuy: string[] = [];
  const missing: string[] = [];
  const equipLabels: Record<string, string> = {
    bathroom_scale: 'bathroom scale', smart_scale: 'smart scale (body fat)', bp_monitor: 'BP monitor',
    body_thermometer: 'body thermometer', continuous_glucose_monitor: 'CGM', glucose_meter: 'glucometer',
    pulse_oximeter: 'pulse oximeter', hrv_chest_strap: 'HRV chest strap', spirometer: 'spirometer',
    antioxidant_scanner: 'antioxidant scanner', sleep_mat: 'sleep tracking mat',
    air_purifier: 'HEPA air purifier', air_quality_monitor: 'air quality monitor',
    water_filter: 'water filter', humidifier: 'humidifier', blackout_curtains: 'blackout curtains',
    blue_light_glasses: 'blue-light glasses', light_therapy_lamp: 'light therapy lamp',
    red_light_panel: 'red light panel', sauna: 'sauna', cold_plunge: 'cold plunge',
    weighted_blanket: 'weighted blanket', massage_gun: 'massage gun', foam_roller: 'foam roller',
    meditation_app: 'meditation app',
    standing_desk: 'standing desk', walking_pad: 'walking pad / treadmill desk',
    home_gym: 'home gym', dumbbells: 'adjustable dumbbells', kettlebells: 'kettlebells',
    pull_up_bar: 'pull-up bar', resistance_bands: 'resistance bands', yoga_mat: 'yoga mat',
    indoor_bike: 'indoor bike', rowing_machine: 'rowing machine',
  };
  for (const [k, status] of Object.entries(equipmentOwnership || {})) {
    const label = equipLabels[k] || k;
    const note = (equipmentNotes || {})[k];
    const tag = note ? `${label} (${note})` : label;
    if (status === 'yes') owned.push(tag);
    else if (status === 'will_buy') willBuy.push(tag);
    else if (status === 'no') missing.push(tag);
  }
  const parts: string[] = [];
  if (owned.length > 0) parts.push(`- OWNS: ${owned.join('; ')} → leverage these in tracking + weekly targets (e.g. morning weigh-in if bathroom scale, morning BP if monitor).`);
  if (willBuy.length > 0) parts.push(`- PLANS TO BUY: ${willBuy.join('; ')} → mention each in the first protocol revision, don't make the plan depend on them yet.`);
  if (missing.length > 0 && missing.length <= 3) parts.push(`- NOT PLANNING: ${missing.join('; ')} → design around not having these. Don't prescribe interventions that require them.`);
  if (parts.length === 0) parts.push('- Ownership not reported — avoid assuming any device-dependent intervention.');
  return parts.join('\n');
})()}

😴 SLEEP
${bedtime && wakeTime ? `- Current: ${bedtime} → ${wakeTime}` : ''}
${derivedBedtime ? `- Target bedtime (derived from 8.5h rule): ${derivedBedtime}` : ''}
${chronotype ? `- Chronotype: ${chronotype} person${chronotype === 'night' ? ' → protocol should GRADUALLY shift bedtime earlier, NOT demand immediate change. Use morning 10,000 lux light therapy + strict caffeine cutoff by 12:00.' : chronotype === 'morning' ? ' → can schedule workouts + demanding work early' : ''}` : ''}
${sleepIssues.length > 0 ? `- Issues: ${sleepIssues.join(', ')}${sleepIssues.includes('Trouble falling asleep') ? ' → magnesium glycinate 400mg + L-theanine 200mg 60 min before bed, no screens 90 min before' : ''}${sleepIssues.includes('Waking in the night') ? ' → check cortisol pattern, reduce alcohol, consistent bedtime' : ''}${sleepIssues.includes('Wake up unrested') ? ' → investigate sleep apnea possibility, track sleep stages, check iron/B12' : ''}${sleepIssues.includes('Snoring') ? ' → STRONGLY recommend sleep study for apnea screening' : ''}` : ''}

🏃 EXERCISE
${exerciseWindow ? `- Preferred window: ${exerciseWindow}` : ''}
${optimalExerciseSlot ? `- Derived optimal slot: ${optimalExerciseSlot}` : ''}
- Current: ${profile.cardioMinutesPerWeek || 0} min cardio/week + ${profile.strengthSessionsPerWeek || 0} strength sessions/week

🍽️ NUTRITION
- Diet: ${profile.dietType}${foodAllergies.length > 0 ? ` | Allergies: ${foodAllergies.join(', ')} — NEVER recommend these foods` : ''}
${mealsPerDay ? `- Meals/day: ${mealsPerDay}` : ''}
${hydrationGlasses ? `- Hydration: ${hydrationGlasses} glasses/day${hydrationGlasses < 6 ? ' → INADEQUATE, target 8-10' : ''}` : ''}
${derivedEatingWindow ? `- Suggested eating window: ${derivedEatingWindow}` : ''}

🧠 MENTAL & STRESS
${stressLevel !== undefined ? `- Stress level: ${stressLevel}/10${stressLevel >= 7 ? ' → CRITICAL: stress management must be in top 3 priorities (cortisol disruption, sleep impact, immune suppression)' : ''}` : ''}
${meditationPractice ? `- Meditation: ${meditationPractice}${meditationPractice === 'none' && stressLevel && stressLevel >= 6 ? ' → prescribe START SMALL (5 min/day), not 20 min immediately' : ''}` : ''}

🧬 FAMILY HISTORY (drives preventive priority)
${familyHistory.length > 0 ? familyHistory.map(h => {
  if (h.toLowerCase().includes('diabetes')) return `- Diabetes: PRIORITIZE glucose/insulin optimization. Aggressive HbA1c target <5.2. Consider CGM. Berberine + metformin discussion with doctor EVEN IF biomarkers are currently OK.`;
  if (h.toLowerCase().includes('heart')) return `- Heart disease: PRIORITIZE CV risk reduction. Push ApoB + Lp(a) testing. Aggressive LDL target <70. Coronary calcium score recommended after age 40.`;
  if (h.toLowerCase().includes('alzheimer')) return `- Alzheimer's: PRIORITIZE brain health. Omega-3 ≥2g, sleep optimization, aerobic exercise, glucose control, APOE testing discussion.`;
  if (h.toLowerCase().includes('cancer')) return `- Cancer: PRIORITIZE screening (annual check), reduce inflammatory markers (hsCRP <0.5), optimize sleep, fasting considerations, vitamin D ≥50.`;
  if (h.toLowerCase().includes('autoimmune')) return `- Autoimmune: consider gluten/dairy trial elimination, optimize vitamin D, check thyroid antibodies, anti-inflammatory diet.`;
  return `- ${h}: factor into screening schedule`;
}).join('\n') : '- None reported'}

💊 CURRENT MEDS & SUPPLEMENTS
- Medications: ${medicationList}
- Supplements already taking: ${supplementList}
(DO NOT double-stack. Check interactions before adding anything that conflicts with their meds.)
`;

  const painPointsBlock = painPoints ? `
═══ CURRENT PAIN POINTS — USER'S OWN WORDS ═══
${painPoints}

INSTRUCTION: For EACH distinct pain point above, produce one entry in painPointSolutions with:
- problem (verbatim quote or close paraphrase)
- likelyCause (your hypothesis based on their biomarkers + context)
- solution (concrete, actionable steps — not vague)
- supportingBiomarkers (which markers support this hypothesis)
- expectedTimeline (realistic: "1-2 weeks for first improvements")
- checkpoints (what to measure each week to know it's working)
` : '';

  const nonNegotiablesBlock = nonNegotiables ? `
═══ NON-NEGOTIABLES — DO NOT DEMAND ELIMINATION ═══
${nonNegotiables}

INSTRUCTION: For EACH non-negotiable above, produce one entry in flexRules with:
- scenario (the non-negotiable itself)
- strategy (specific mitigation: walks, timing, supplements that blunt damage)
- damageControl (what to do the day after if overdone)
- frequency (how often this is OK without penalty, e.g., "1x/week max")

Example: "Friday pizza night" → Strategy: "20 min walk before + 15 min walk after. Berberine 500mg with meal. Water between slices. Extended 14h overnight fast Saturday."
` : '';

  const goalsBlock = primaryGoal || specificTarget || timelineMonths ? `
═══ GOAL DETAILS ═══
${primaryGoal ? `Primary goal (drives priority): ${primaryGoal}` : ''}
${specificTarget ? `Specific target (quantifiable): "${specificTarget}" — weave this into roadmap milestones and tracking metrics` : ''}
${timelineMonths ? `Timeline: ${timelineMonths} month${timelineMonths > 1 ? 's' : ''} commitment — pace interventions accordingly. ${timelineMonths <= 3 ? 'Front-load high-impact changes.' : 'Build gradually, sustainable over time.'}` : ''}
` : '';

  return `IDENTITY:
You are the world's foremost longevity physician, synthesizing the expertise of Peter Attia (metabolic health), Rhonda Patrick (nutrigenomics), Andrew Huberman (neuroscience/sleep), David Sinclair (aging biology), and Bryan Johnson's medical team (comprehensive optimization). You have access to the complete body of longevity literature through 2026.

MISSION:
Generate a hyper-personalized, actionable longevity protocol for this specific patient based on their REAL biomarker data, lifestyle, medical history, and goals. Every single recommendation MUST be justified by a specific biomarker value, detected pattern, or lifestyle factor. Never give generic advice — always tie back to THIS patient's data.

CRITICAL SAFETY RULES:
1. NEVER prescribe medications — only say "discuss [medication] with your doctor because [specific reason from their data]"
2. Flag ALL critical biomarker values with URGENT medical referral
3. Check for drug-supplement interactions with their current medications: ${medicationList}
4. If patient is under 18: severely restrict recommendations (lifestyle only, minimal supplements)
5. Never exceed their stated budget of ${profile.monthlyBudgetRon} RON/month for supplements
6. Do NOT double-stack supplements they already take: ${supplementList}

${trimBryanReference(BRYAN_REFERENCE, classifiedBiomarkers)}

${trimInterventionRules(INTERVENTION_RULES, classifiedBiomarkers)}

${BUDGET_RULES}

${UNIVERSAL_TIPS}

═══════════════════════════════════════════════
        THIS PATIENT'S COMPLETE PROFILE
═══════════════════════════════════════════════

DEMOGRAPHICS:
- Age: ${profile.age} years | Sex: ${profile.sex === 'male' ? 'Male' : 'Female'}
- Height: ${profile.heightCm} cm | Weight: ${profile.weightKg} kg
- BMI: ${bmi.toFixed(1)} (${bmiCategory})
- Activity Level: ${profile.activityLevel}
- Occupation: ${profile.occupation || 'Not specified'}

LIFESTYLE:
- Sleep: ${profile.sleepHoursAvg || '?'} hrs/night, quality ${profile.sleepQuality || '?'}/10
- Diet: ${profile.dietType}
- Alcohol: ${profile.alcoholDrinksPerWeek || 0} drinks/week
- Caffeine: ${profile.caffeineMgPerDay || 0} mg/day
- Smoker: ${profile.smoker ? 'YES — #1 priority to quit' : 'No'}
- Exercise: ${profile.cardioMinutesPerWeek || 0} min cardio/week + ${profile.strengthSessionsPerWeek || 0} strength sessions/week

MEDICAL:
- Conditions: ${profile.conditions.length > 0 ? profile.conditions.join(', ') : 'None reported'}
- Medications: ${medicationList}
- Current Supplements: ${supplementList}
- Allergies: ${profile.allergies?.length > 0 ? profile.allergies.join(', ') : 'None reported'}

GOALS (ranked by priority):
${profile.goals.map((g, i) => `${i + 1}. ${g}`).join('\n')}

CONSTRAINTS:
- Time budget: ${profile.timeBudgetMin} min/day
- Monthly budget: ${profile.monthlyBudgetRon} RON/month
- Experimental openness: ${profile.experimentalOpenness === 'otc_only' ? 'OTC supplements only' : profile.experimentalOpenness === 'open_rx' ? 'Open to discussing Rx with doctor' : 'Open to experimental interventions'}

═══ BASELINE DETERMINISTIC ESTIMATES (use as sanity check, refine with your reasoning) ═══
Chronological age: ${profile.age}
Our baseline biological age: ${biologicalAge.toFixed(1)} years (decimal = use 1 decimal place in output)
Our baseline longevity score: ${longevityScore}/100

You are expected to produce your OWN best estimate based on ALL available data.
Stay within ±3 years of our baseline UNLESS you have specific biomarkers or conditions that justify larger adjustment. Explain your reasoning implicitly in topWins/topRisks.

BIOLOGICAL AGE GUIDELINES (decimal precision, e.g. 34.7 = 34y 8m):
- Consider: biomarker values (strongest signal), BMI, BP, HRV, VO2 Max, body fat
- Adjust for: smoking (+3-8y), poor sleep (+1-3y), sedentary (+2y), chronic stress (+1-2y)
- Subtract for: elite fitness (-2-3y), Mediterranean diet (-1y), strong social connections (-0.5y)
- For users under 18: offsets should be ≤ ±4 years (not enough time for full impact)
- For users 18-25: ≤ ±8 years. Over 25: up to ±15 years for severe cases.

LONGEVITY SCORE GUIDELINES (0-100):
- 90+ = Bryan Johnson tier (peak biomarkers, habits, 0 deficiencies)
- 75-89 = Well above average (most biomarkers optimal, good habits)
- 60-74 = Average healthy adult
- 40-59 = Multiple risk factors, intervention needed
- < 40 = Serious concerns, urgent lifestyle + medical action

AGING VELOCITY (DunedinPACE analog, 0.6-1.5):
- 0.65-0.85 = aging slower than clock (elite health)
- 0.85-1.05 = steady (normal)
- 1.05-1.25 = accelerated (smoking, metabolic issues, poor sleep)
- 1.25-1.5 = rapidly accelerated (multiple conditions, very poor habits)
Represents how many years of biological aging per calendar year RIGHT NOW.

${hasBiomarkers ? `═══ CLASSIFIED BIOMARKERS ═══
${biomarkerSummary}` : '═══ NO BIOMARKERS PROVIDED ═══\nGenerate a lifestyle-only protocol. Strongly recommend getting blood work done. Suggest specific panels to order.'}

═══ DETECTED PATTERNS ═══
${patternSummary}

${personalContext}
${painPointsBlock}
${nonNegotiablesBlock}
${goalsBlock}

${hasCritical ? `\n🚨 CRITICAL VALUES DETECTED 🚨\n${criticalMarkers.map(b => {
  const ref = biomarkerRefs.find(r => r.code === b.code);
  return `- ${ref?.shortName || b.code}: ${b.value} ${b.unit} — REQUIRES IMMEDIATE MEDICAL ATTENTION`;
}).join('\n')}\nYou MUST include urgent referrals in doctorDiscussion.redFlags.\n` : ''}

═══════════════════════════════════════════════
              OUTPUT REQUIREMENTS
═══════════════════════════════════════════════

Return ONLY valid JSON matching this EXACT structure. No markdown, no backticks, no explanation — ONLY the JSON object.

{
  "diagnostic": {
    "biologicalAge": <number with 1 decimal place, e.g. 34.7 — YOUR best estimate using all context>,
    "chronologicalAge": ${profile.age},
    "agingVelocity": "<'accelerated' | 'decelerated' | 'steady'>",
    "agingVelocityNumber": <number 0.60-1.55 with 2 decimals — DunedinPACE analog>,
    "longevityScore": <integer 0-100 — YOUR best estimate, not just the baseline>,
    "summary": "<2-3 sentence executive summary of this patient's longevity status>",
    "topWins": ["<3 specific things already optimal, referencing biomarker values>"],
    "topRisks": ["<3 specific risks needing attention, referencing biomarker values>"],
    "organSystemScores": {
      "cardiovascular": <0-100 — justify with specific markers>,
      "metabolic":      <0-100>,
      "hormonal":       <0-100>,
      "inflammatory":   <0-100>,
      "hepatic":        <0-100>,
      "renal":          <0-100>,
      "nutritional":    <0-100>,
      "musculoskeletal":<0-100>
    },
    "organSystemsDetail": [
      {
        "system": "<cardiovascular | metabolic | hormonal | inflammatory | hepatic | renal | nutritional | musculoskeletal>",
        "score": <0-100>,
        "verdict": "<1 sentence summary: 'solid', 'on the edge', 'your weakest system', etc.>",
        "drivers": ["<2-3 bullets: what's pulling the score UP — reference specific values>"],
        "dragAnchors": ["<2-3 bullets: what's pulling it DOWN — reference specific values>"],
        "topLever": "<single highest-ROI action for THIS system, with expected score gain after 12 weeks>"
      }
    ],
    "lifeJourney": {
      "birthplaceContext": "<1-2 sentence inference about this person's birthplace / upbringing based on ${profile.age} years old, their birth country/city if provided, typical lifestyle of that cohort. e.g. 'Born in 1990 in Bucharest — grew up during the post-communist transition, likely exposed to heavy industrial pollution in early childhood, diet heavy in bread/potato/pork.' — honest and grounded, not romantic.>",
      "likelyDecadeByDecade": [
        {"decade": "0-10y",  "estimate": "<what life likely looked like: diet, activity, stressors, environment>"},
        {"decade": "10-20y", "estimate": "<similar estimate>"},
        {"decade": "20-30y", "estimate": "<...>"},
        {"decade": "30+y",   "estimate": "<only if relevant to their current age>"}
      ],
      "formativeLifestyleBets": ["<3-5 inferences about decisions that SHAPED current biology — e.g. 'switched to desk job at 25 → explains sitting-hours + BMI drift', 'parents both smoked → elevated inflammation baseline', 'stopped team sports after 18 → musculoskeletal drift'. Be careful: these are HYPOTHESES marked as such.>"],
      "cumulativeExposures": ["<honest list of things this person's body has accumulated: pollution (from birth city), sun exposure (from latitude), dietary patterns, sleep debt decade, stress decade, etc. Each item: what + rough dose + current biomarker impact.>"],
      "geneticHeadwinds": ["<IF family history provided: 1-2 inferred polygenic risks — e.g. 'family diabetes + current HbA1c 5.6 → you're carrying metabolic pressure before symptoms'. Otherwise skip.>"],
      "geneticTailwinds": ["<If any protective factors show up in their data (e.g. great HDL at age 50 suggests favorable lipid genetics), name them.>"]
    },
    "evidenceCitations": [
      "<4-6 short citations tying THIS patient's situation to published studies. Format: 'Levine 2018 PhenoAge — your 9-marker score places you in the X percentile for age.' or 'Arem 2015 (NHANES) — users with your step count have a 27% lower all-cause mortality vs <4k.' — real studies, real numbers, tailored to THIS user. Do not invent sources.>"
    ],
    "percentilePositioning": {
      "vsPeersOfSameAgeAndSex": "<1 sentence — e.g. 'Among 34-year-old men in Eastern Europe, your metabolic profile is top 25% but your sleep quality is bottom 40%.'>",
      "vsLongevityOptimalPopulation": "<1 sentence — e.g. 'Compared to the top-5% longevity phenotype (Bryan Johnson, Peter Attia's patient cohort), you're ~8.3 years behind on biological age.'>",
      "trajectoryIfNothingChanges": "<1 sentence projection for 10 years if current habits persist — honest, specific.>",
      "trajectoryWithProtocol": "<1 sentence with realistic expected gains from following the protocol for 12 months.>"
    }
  },
  "bryanComparison": [
    {
      "marker": "<biomarker name>",
      "yourValue": <number>,
      "bryanValue": <number>,
      "gap": <absolute difference>,
      "gapDirection": "<'ahead' | 'behind' | 'equal'>",
      "verdict": "<'Ahead of Bryan' | 'Close to Bryan' | 'Work needed' | 'Priority gap'>",
      "whyTheGapExistsForYou": "<1 short sentence with a concrete hypothesis for THIS user, e.g. 'Your LDL is 40 mg/dL higher than Bryan — dietary saturated fat + genetic ApoE risk + no statin.'>",
      "closeTheGapAction": "<1 specific intervention that would close this gap — with realistic timeline>"
    }
  ],
  "nutrition": {
    "dailyCalories": <calculated from BMR + activity + goal>,
    "macros": { "protein": <grams>, "carbs": <grams>, "fat": <grams> },
    "proteinPerKg": <g/kg target>,
    "eatingWindow": "<recommended window, e.g. '10:00 AM - 6:00 PM (8 hours)'",
    "meals": [
      { "name": "<meal name>", "time": "<suggested time>", "calories": <num>, "description": "<what to eat, adapted to ${profile.dietType}>", "recipe": "<brief>", "keyNutrients": "<targets>" }
    ],
    "mealOptions": {
      "breakfast": [
        { "name": "<option 1 name>", "description": "<1-line description>", "calories": <num>, "protein_g": <num>, "carbs_g": <num>, "fat_g": <num>, "fiber_g": <num>, "sugar_g": <num>, "sodium_mg": <num>, "prepMinutes": <num>, "ingredients": ["<grams>"], "whyForYou": "<1-line: why this matches their preferences/diet/biomarkers>" },
        { "name": "<option 2>", "description": "", "calories": <num>, "protein_g": <num>, "carbs_g": <num>, "fat_g": <num>, "fiber_g": <num>, "sugar_g": <num>, "sodium_mg": <num>, "prepMinutes": <num>, "ingredients": [], "whyForYou": "" },
        { "name": "<option 3>", "description": "", "calories": <num>, "protein_g": <num>, "carbs_g": <num>, "fat_g": <num>, "fiber_g": <num>, "sugar_g": <num>, "sodium_mg": <num>, "prepMinutes": <num>, "ingredients": [], "whyForYou": "" }
      ],
      "lunch":  [<3 options, same shape>],
      "dinner": [<3 options, same shape>],
      "snacks": [<3 options, smaller calories 100-250 each>]
    },
    "dailyMaximums": {
      "sugar_g": <MAX added sugar per day — typical 25g for adults, less if metabolic issues>,
      "sodium_mg": <MAX sodium per day — 2300 default, 1500 if BP elevated>,
      "saturatedFat_g": <MAX — typically 20g>,
      "fiber_g_min": <recommended MIN, typically 25-35g>,
      "water_ml_min": <MIN water, typically 2000-3000ml>
    },
    "generalRecommendations": [
      "<8-10 specific actionable rules: e.g. 'eat protein first at every meal', 'hydrate 500ml on waking', 'no liquid calories', 'aim 30g protein per meal', etc. Personalized to their goals/conditions.>"
    ],
    "foodsToAdd": [{"food": "", "why": "<MUST reference biomarker or goal>", "frequency": ""}],
    "foodsToReduce": [{"food": "", "why": "<MUST reference biomarker or goal>"}],
    "hydrationLiters": <daily target>,
    "groceryListWeekly": ["<specific items at Romanian supermarkets>"]
  },
  "supplements": [
    {
      "name": "<exact supplement name>",
      "dose": "<exact dose with unit>",
      "timing": "<exact: 'Morning, 7-8 AM' or 'With dinner' or 'Bedtime, 10 PM' — be SPECIFIC>",
      "form": "<best form: glycinate/citrate/methylated/ubiquinol/etc>",
      "withFood": <boolean>,
      "howToTake": "<EXACT instructions: 'Swallow with 250ml water + a fatty meal (10g+ fat for absorption)' OR 'Empty stomach with cold water, wait 30 min before food' OR 'Sublingual under tongue 60 sec then swallow' — pick what's optimal for THIS supplement>",
      "alreadyTaking": <boolean — true if this is in user's current_supplements list, meaning we keep it>,
      "justification": "<MANDATORY: 'Your [biomarker/lifestyle] is [value], which is [issue]. [Supplement] at [dose] targets this by [mechanism]. Expected: [what to feel/see]. Bryan takes [his dose].'>",
      "interactions": ["<real interactions with their meds or other stack items>"],
      "warnings": "<warnings specific to their conditions>",
      "monthlyCostRon": <estimated cost in RON>,
      "emagSearchQuery": "<exact search query for eMAG.ro>",
      "priority": "<'MUST' | 'STRONG' | 'OPTIONAL'>",
      "startWeek": <1-12 — when to introduce>
    }
  ],
  "supplementsHowTo": [
    "<6-10 universal supplement-taking rules. Examples: 'Always swallow with 200ml+ water — never juice or coffee (tannins block absorption)'. 'Fat-soluble vitamins (D, K2, A, E) need 10g+ fat in same meal'. 'Magnesium glycinate at night — magnesium oxide is mostly wasted'. 'Iron and calcium block each other — separate by 2 hours'. 'Coffee blocks iron + zinc absorption — wait 1h either side'. Personalize to their actual stack.>"
  ],
  "exercise": {
    "weeklyPlan": [
      { "day": "Monday",    "activity": "<specific workout>", "exercises": ["<sets x reps>"], "duration": "<min>", "intensity": "<Zone 2/Moderate/HIIT/Recovery>", "notes": "<tips>" },
      { "day": "Tuesday",   "activity": "", "exercises": [], "duration": "", "intensity": "", "notes": "" },
      { "day": "Wednesday", "activity": "", "exercises": [], "duration": "", "intensity": "", "notes": "" },
      { "day": "Thursday",  "activity": "", "exercises": [], "duration": "", "intensity": "", "notes": "" },
      { "day": "Friday",    "activity": "", "exercises": [], "duration": "", "intensity": "", "notes": "" },
      { "day": "Saturday",  "activity": "", "exercises": [], "duration": "", "intensity": "", "notes": "" },
      { "day": "Sunday",    "activity": "", "exercises": [], "duration": "", "intensity": "", "notes": "" }
    ],
    "zone2Target": <minutes per week>,
    "strengthSessions": <number per week>,
    "hiitSessions": <number per week>,
    "dailyStepsTarget": <number>,
    "warmupRoutine": ["<specific 5-min mobility/dynamic stretches>"],
    "cooldownRoutine": ["<specific 5-min static stretches>"],
    "progressionNotes": "<how to progress over 12 weeks>",
    "gymAccess": "<'gym' if they say they go to a gym, 'home' if home/calisthenics, 'none' if minimal — derive from their exercisesDone array and onboarding context>",
    "generalRecommendations": [
      "<8-10 specific exercise rules: e.g. 'Warm up 5 min before lifting — never cold sets', 'Progressive overload: add 2.5kg or 1 rep weekly', 'Zone 2 = nasal-breathing pace, not gasping', 'Strength before cardio if same day', 'Sleep 8h on training days', 'Rest 48h between same muscle group', 'Track lifts in a notebook/app — what gets measured improves'>"
    ]
  },
  "sleep": {
    "targetBedtime": "<HH:MM — use user's stated idealBedtime if provided, else derive from chronotype>",
    "targetWakeTime": "<HH:MM — use user's stated idealWakeTime if provided>",
    "targetDuration": "<hours, e.g. '8h 0m'>",
    "idealBedtime": "<echo back what the user said in onboarding (idealBedtime field)>",
    "idealWakeTime": "<echo back idealWakeTime>",
    "windDownRoutine": [
      {"time": "<relative to bedtime, e.g. '-90 min'>", "action": "<specific action>"}
    ],
    "environment": [
      {"item": "<what to set up>", "why": "<brief reason>", "emagQuery": "<search query if product needed>"}
    ],
    "bedroomChecklist": [
      { "item": "Blackout curtains / sleep mask", "why": "Even small light suppresses melatonin and shortens deep sleep" },
      { "item": "Room temperature 18-20°C (64-68°F)", "why": "Cool room helps core body temp drop — required to fall + stay asleep" },
      { "item": "No phone in bedroom (or airplane mode + face-down)", "why": "Removes 3 AM scroll temptation and EMF/notification disruption" },
      { "item": "White noise / earplugs if street noise", "why": "Random sounds cause micro-arousals you don't remember" },
      { "item": "Mattress + pillow that fit your sleep posture", "why": "Pain wakes you in REM cycles" },
      { "item": "<add more specific to their reported issues, e.g. mouth tape if snoring>", "why": "" }
    ],
    "supplementsForSleep": ["<ONLY if sleep quality is poor, with justification>"],
    "morningLightMinutes": <minutes>,
    "morningRoutine": ["<first 30 min after waking>"],
    "caffeineLimit": "<recommendation based on their current intake>",
    "generalRecommendations": [
      "<8-10 sleep hygiene rules. Examples: 'Same bedtime/wake within 30 min including weekends — circadian rhythm hates random'. 'No screens 90 min before bed — blue light blocks melatonin by 50%'. 'No food 3h before bed — digestion fragments sleep'. 'No alcohol 4h before bed — collapses deep sleep by 40%'. 'Caffeine cut-off ~10 hours before bed (half-life ~5-6h)'. 'Get 10-30 min direct sunlight within 1h of waking — anchors circadian'. 'Hot shower 90min before bed — body cools after, signals sleep'. 'Bedroom for sleep + sex only — not work, not Netflix'.>"
    ]
  },
  "universalTips": [
    {
      "category": "<Movement | Sleep | Nutrition | Mindset | Environment | Oral Health>",
      "tips": [
        {"tip": "<specific actionable tip>", "why": "<evidence-based reason>", "difficulty": "<easy | medium | hard>"}
      ]
    }
  ],
  "dailySchedule": [
    "// IMPORTANT: build the schedule from idealWakeTime → idealBedtime (if provided in onboarding).",
    "// If user has work/school hours (workStart, workEnd), include them as ONE block entry like:",
    "//   { time: '08:00 - 14:00', activity: 'School', category: 'school', duration: '6h', notes: '', isBlock: true }",
    "// Or 'Work' if their occupation isn't student. Use 'work' / 'school' category. Sort all entries chronologically.",
    "// Include: wake time, morning sunlight, breakfast, supplements (split AM/midday/evening/bedtime), work/school block,",
    "// lunch, exercise window, dinner, wind-down start, bedtime. Each at its specific time. Be GRANULAR.",
    {
      "time": "<HH:MM or 'HH:MM - HH:MM' for blocks>",
      "activity": "<what to do — for blocks like work, write 'Work' or 'School'>",
      "category": "<wake | sleep | supplements | exercise | nutrition | meal | work | school | mindset | tracking | wind-down>",
      "duration": "<how long>",
      "notes": "<any details>",
      "isBlock": <true for work/school spans, false otherwise>
    }
  ],
  "tracking": {
    "daily": ["<4-6 metrics to track daily: weight, sleep, steps, etc>"],
    "weekly": ["<what to check weekly>"],
    "devices": [
      {"name": "", "why": "", "estimatedCostRon": 0, "emagQuery": "", "priority": ""}
    ],
    "retestSchedule": [
      {"marker": "", "weeks": <number>, "why": "<specific reason to retest this marker>"}
    ]
  },
  "doctorDiscussion": {
    "rxSuggestions": ["<ONLY if biomarkers warrant it — always phrase as 'discuss with your doctor'>"],
    "specialistReferrals": ["<type of specialist + reason>"],
    "redFlags": ["<anything requiring URGENT attention>"],
    "testsToOrder": ["<specific blood tests or imaging to request>"]
  },
  ${profile.experimentalOpenness !== 'otc_only' ? `"experimental": {
    "peptides": ["<name + what it does + evidence level>"],
    "advancedTesting": ["<test name + where + cost estimate>"],
    "clinics": ["<clinic name + location + what they offer>"]
  },` : ''}
  "costBreakdown": {
    "monthlySupplements": <RON>,
    "monthlyFood": <RON estimate>,
    "oneTimeEquipment": <RON>,
    "quarterlyTesting": <RON>,
    "totalMonthlyOngoing": <RON>,
    "currency": "RON"
  },
  ${painPoints ? `"painPointSolutions": [
    {
      "problem": "<verbatim from patient's pain points>",
      "likelyCause": "<hypothesis based on their biomarkers + context>",
      "solution": "<specific, actionable intervention with doses/timing>",
      "supportingBiomarkers": ["<marker codes that support this hypothesis>"],
      "expectedTimeline": "<e.g. '1-2 weeks for first improvements, 4-6 weeks for resolution'>",
      "checkpoints": ["<specific weekly measurable check>"]
    }
  ],` : ''}
  ${nonNegotiables ? `"flexRules": [
    {
      "scenario": "<verbatim non-negotiable from patient>",
      "strategy": "<specific mitigation with tactics: walks, supplements, timing>",
      "damageControl": "<what to do the day after if overdone>",
      "frequency": "<e.g. 'up to 1x/week max without penalty'>"
    }
  ],` : ''}
  "dailyBriefing": {
    "morningPriorities": ["<top 3 things to focus on TODAY, written as energizing one-liners>"],
    "eveningReview": ["<3 reflection questions to ask at end of day>"]
  }
}

FINAL REMINDERS:
- Every supplement justification MUST cite a specific biomarker with its actual value
- Every supplement MUST have a non-empty "howToTake" (water amount, with/without food, timing, absorption tips)
- Respect the ${profile.monthlyBudgetRon} RON/month budget — do NOT exceed it
- Adapt nutrition to ${profile.dietType} diet — do NOT force veganism
- bryanComparison MUST have at least 5 entries if the user uploaded biomarkers (pull from their actual values)
- dailyBriefing.morningPriorities and eveningReview MUST be populated (3 each) — these power the home screen
${painPoints ? '- painPointSolutions MUST be populated with ALL pain points from the patient' : ''}
${nonNegotiables ? '- flexRules MUST be populated with ALL non-negotiables — NEVER tell them to eliminate these' : ''}
${chronotype === 'night' ? '- Chronotype: night owl. Do NOT demand instant 10 PM bedtime. Shift gradually over 2-4 weeks using morning light + caffeine cutoff.' : ''}
${chronotype === 'morning' ? '- Chronotype: morning person. Schedule hardest tasks and workouts early.' : ''}
${familyHistory.some(h => h.toLowerCase().includes('diabetes')) ? '- FAMILY HISTORY of diabetes is present → glucose priority even without current dysfunction' : ''}
${familyHistory.some(h => h.toLowerCase().includes('heart')) ? '- FAMILY HISTORY of heart disease → push ApoB/Lp(a) testing' : ''}
${stressLevel && stressLevel >= 7 ? '- HIGH STRESS (7+/10) → stress management in top 3 priorities. Cortisol-lowering interventions (ashwagandha, magnesium, meditation 5-10 min).' : ''}
${sittingHours && sittingHours > 8 ? '- SEDENTARY job (8+h sitting) → explicit hourly movement breaks + daily walk protocol required' : ''}
- ${profile.smoker ? 'SMOKING is their #1 health risk — address this prominently' : ''}
- ${(profile.alcoholDrinksPerWeek || 0) > 7 ? 'Alcohol consumption is elevated — address reduction prominently' : ''}
- ${(profile.sleepHoursAvg || 7) < 6 ? 'Sleep deprivation detected — make this the #1 priority' : ''}
- Exercise recommendations must fit ${profile.timeBudgetMin} min/day
- Include Romanian-specific shopping sources (eMAG, Farmacia Tei, Catena, Kaufland)
- The output must be VALID JSON — no trailing commas, no comments
- QUALITY CHECK before returning: every array we ask for MUST be non-empty. If you have nothing real to say, pick the user's single biggest lever and say it there — never leave an empty array.`;
}

// For quick/cheap operations (PDF parsing, classification verification)
export function buildGroqParsingPrompt(pdfText: string): string {
  return `You are a medical lab report parser. Extract ALL biomarker values from this lab report.

IMPORTANT: Handle Romanian lab report formats:
- TGP = ALT, TGO = AST
- Glicemie = Fasting Glucose
- Hemoglobina glicata / HbA1c
- Colesterol LDL / HDL
- Trigliceride
- VSH = ESR
- Leucocite = WBC
- Hemoglobina = HGB
- Trombocite = PLT
- Creatinina = Creatinine
- Acid uric = Uric Acid
- Fier seric = Iron
- Feritina = Ferritin
- TSH, FT3, FT4
- Vitamina D (25-OH)
- Vitamina B12
- Acid folic = Folate
- Homocisteina = Homocysteine
- Proteina C reactiva (PCR) = hsCRP
- Insulina = Insulin
- Testosteron
- Estradiol

Map each to one of these codes:
HSCRP, GLUC, HBA1C, LDL, HDL, TRIG, VITD, TSH, FERRITIN, B12, 
TESTO, ALT, AST, CREAT, HOMOCYS, WBC, HGB, INSULIN, MAGNE, FOLAT, 
OMEGA3, APOB, LPA, CORTISOL, DHEAS, ESTRADIOL, SHBG, FT3, FT4, 
ANTI_TPO, GGT, URIC_ACID, EGFR, IRON, PLT, RBC, HCT

Return ONLY a JSON array, no other text:
[{"name": "original name from report", "value": 123.4, "unit": "mg/dL", "code": "LDL"}, ...]

If a value doesn't match any code, use "UNKNOWN".
If the value has a range like "< 0.1", use 0.05 as the value.
Always use the numeric value only (no < or > signs in the value field).

LAB REPORT TEXT:
${pdfText}`;
}