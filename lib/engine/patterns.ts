import { BiomarkerValue, DetectedPattern } from '../types';
import { thresholdValue } from './clinical-thresholds';

type PatternRule = {
  name: string;
  description: string;
  check: (m: Map<string, BiomarkerValue>) => { triggered: boolean; severity: DetectedPattern['severity']; triggeringMarkers: string[] };
  recommendations: string[];
};

const PATTERNS: PatternRule[] = [
  {
    name: 'Metabolic Syndrome',
    description: 'Cluster of risk factors: elevated glucose + high triglycerides + low HDL. Strong predictor of type 2 diabetes and cardiovascular disease.',
    check: (m) => {
      const markers: string[] = [];
      let count = 0;
      if (m.get('GLUC')?.value && m.get('GLUC')!.value > thresholdValue('GLUC_PREDIABETES_LOW')) { count++; markers.push('GLUC'); }
      if (m.get('TRIG')?.value && m.get('TRIG')!.value > thresholdValue('TRIG_METABOLIC')) { count++; markers.push('TRIG'); }
      if (m.get('HDL')?.value && m.get('HDL')!.value < thresholdValue('HDL_METABOLIC_M')) { count++; markers.push('HDL'); }
      if (m.get('INSULIN')?.value && m.get('INSULIN')!.value > thresholdValue('INSULIN_METABOLIC')) { count++; markers.push('INSULIN'); }
      if (m.get('HBA1C')?.value && m.get('HBA1C')!.value > thresholdValue('HBA1C_METABOLIC_CLUSTER')) { count++; markers.push('HBA1C'); }
      return { triggered: count >= 2, severity: count >= 4 ? 'critical' : count >= 3 ? 'high' : 'moderate', triggeringMarkers: markers };
    },
    recommendations: ['Priority #1: reverse insulin resistance', 'Time-restricted eating (16:8)', 'Walk 30 min after every meal + strength train 3x/week', 'Berberine 1000mg/day + Magnesium 400mg evening', 'Discuss metformin with doctor'],
  },
  {
    name: 'Inflammatory Cluster',
    description: 'Chronic systemic inflammation — dramatically accelerates aging and increases risk of cancer, cardiovascular disease, and neurodegeneration.',
    check: (m) => {
      const markers: string[] = [];
      let count = 0;
      if (m.get('HSCRP')?.value && m.get('HSCRP')!.value > thresholdValue('HSCRP_ELEVATED')) { count++; markers.push('HSCRP'); }
      if (m.get('WBC')?.value && m.get('WBC')!.value > thresholdValue('WBC_ELEVATED')) { count++; markers.push('WBC'); }
      if (m.get('HOMOCYS')?.value && m.get('HOMOCYS')!.value > thresholdValue('HOMOCYS_ELEVATED')) { count++; markers.push('HOMOCYS'); }
      if (m.get('FERRITIN')?.value && m.get('FERRITIN')!.value > thresholdValue('FERRITIN_HIGH')) { count++; markers.push('FERRITIN'); }
      return { triggered: count >= 2, severity: count >= 3 ? 'high' : 'moderate', triggeringMarkers: markers };
    },
    recommendations: ['Intensive anti-inflammatory protocol', 'Omega-3 EPA/DHA 3g/day', 'Curcumin 1g with piperine', 'Eliminate processed food for 30 days', 'Investigate hidden sources: dental, gut, joint'],
  },
  {
    name: 'Thyroid Dysfunction',
    description: 'Signs of subclinical hypothyroidism — affects metabolism, energy, weight, mood, and cognition.',
    check: (m) => {
      const markers: string[] = [];
      const tsh = m.get('TSH');
      if (tsh && tsh.value > 2.5) markers.push('TSH');
      const ft4 = m.get('FT4');
      if (ft4 && ft4.value < 0.9) markers.push('FT4');
      const antiTpo = m.get('ANTI_TPO');
      if (antiTpo && antiTpo.value > 34) markers.push('ANTI_TPO');
      return { triggered: markers.length > 0, severity: (antiTpo && antiTpo.value > 34) || (tsh && tsh.value > 4.0) ? 'high' : 'moderate', triggeringMarkers: markers };
    },
    recommendations: ['Full thyroid panel: FT3, FT4, anti-TPO, anti-TG', 'Selenium 200mcg/day + Zinc 25mg/day', 'Check iodine status', 'Endocrinologist referral if TSH >4.0'],
  },
  {
    name: 'Nutritional Deficiency Cluster',
    description: 'Multiple vitamins/minerals below optimal — suggests inadequate diet or absorption issues.',
    check: (m) => {
      const markers: string[] = [];
      if (m.get('VITD')?.value && m.get('VITD')!.value < 30) markers.push('VITD');
      if (m.get('B12')?.value && m.get('B12')!.value < 400) markers.push('B12');
      if (m.get('FERRITIN')?.value && m.get('FERRITIN')!.value < 30) markers.push('FERRITIN');
      if (m.get('FOLAT')?.value && m.get('FOLAT')!.value < 10) markers.push('FOLAT');
      if (m.get('MAGNE')?.value && m.get('MAGNE')!.value < 1.8) markers.push('MAGNE');
      if (m.get('IRON')?.value && m.get('IRON')!.value < 50) markers.push('IRON');
      return { triggered: markers.length >= 2, severity: markers.length >= 4 ? 'high' : markers.length >= 3 ? 'moderate' : 'low', triggeringMarkers: markers };
    },
    recommendations: ['Evaluate current diet — possible malnutrition', 'Check gut health (absorption)', 'Targeted supplementation based on specific deficiencies', 'Diversify diet: organ meats, legumes, colored vegetables'],
  },
  {
    name: 'Cardiovascular Risk',
    description: 'Suboptimal lipid profile combined with inflammation — strong predictor of cardiovascular events.',
    check: (m) => {
      const markers: string[] = [];
      let count = 0;
      if (m.get('LDL')?.value && m.get('LDL')!.value > 130) { count++; markers.push('LDL'); }
      if (m.get('APOB')?.value && m.get('APOB')!.value > 90) { count++; markers.push('APOB'); }
      if (m.get('TRIG')?.value && m.get('TRIG')!.value > 150) { count++; markers.push('TRIG'); }
      if (m.get('HDL')?.value && m.get('HDL')!.value < 45) { count++; markers.push('HDL'); }
      if (m.get('HSCRP')?.value && m.get('HSCRP')!.value > 1.5) { count++; markers.push('HSCRP'); }
      if (m.get('HOMOCYS')?.value && m.get('HOMOCYS')!.value > 12) { count++; markers.push('HOMOCYS'); }
      if (m.get('LPA')?.value && m.get('LPA')!.value > 75) { count++; markers.push('LPA'); }
      return { triggered: count >= 2, severity: count >= 5 ? 'critical' : count >= 3 ? 'high' : 'moderate', triggeringMarkers: markers };
    },
    recommendations: ['Calculate ASCVD score with doctor', 'Get ApoB + Lp(a) + coronary calcium score', 'Fiber 30g/day + Omega-3 2g/day', 'Aerobic exercise 150+ min/week', 'Discuss statin if ASCVD score >7.5%'],
  },
  {
    name: 'Hormonal Imbalance',
    description: 'Low testosterone + high cortisol + low DHEA-S pattern — indicates chronic stress and accelerated hormonal aging.',
    check: (m) => {
      const markers: string[] = [];
      if (m.get('TESTO')?.value && m.get('TESTO')!.value < 400) markers.push('TESTO');
      if (m.get('CORTISOL')?.value && m.get('CORTISOL')!.value > 20) markers.push('CORTISOL');
      if (m.get('DHEAS')?.value && m.get('DHEAS')!.value < 150) markers.push('DHEAS');
      if (m.get('ESTRADIOL')?.value && m.get('ESTRADIOL')!.value > 50) markers.push('ESTRADIOL');
      return { triggered: markers.length >= 2, severity: markers.length >= 3 ? 'high' : 'moderate', triggeringMarkers: markers };
    },
    recommendations: ['Sleep optimization is #1 priority (7-9 hours)', 'Stress management: meditation, breathwork daily', 'Heavy strength training 3x/week', 'Ashwagandha KSM-66 600mg + Zinc 30mg + Vitamin D 4000IU', 'Endocrinologist if testosterone <300'],
  },
  {
    name: 'Iron Overload',
    description: 'Elevated ferritin and iron cause oxidative stress and accelerate aging. Hemochromatosis affects 1 in 200 people.',
    check: (m) => {
      const markers: string[] = [];
      if (m.get('FERRITIN')?.value && m.get('FERRITIN')!.value > 200) markers.push('FERRITIN');
      if (m.get('IRON')?.value && m.get('IRON')!.value > 150) markers.push('IRON');
      return { triggered: markers.length >= 1 && (m.get('FERRITIN')?.value || 0) > 200, severity: (m.get('FERRITIN')?.value || 0) > 400 ? 'high' : 'moderate', triggeringMarkers: markers };
    },
    recommendations: ['Donate blood every 3 months (most effective)', 'Reduce red meat intake', 'HFE genetic test for hemochromatosis', 'Avoid iron supplements and vitamin C with meals', 'Green tea as mild chelator'],
  },
  {
    name: 'Anemia Cluster',
    description: 'Low hemoglobin + low ferritin + low iron — indicates iron-deficiency anemia causing fatigue, poor exercise tolerance, and cognitive fog.',
    check: (m) => {
      const markers: string[] = [];
      if (m.get('HGB')?.value && m.get('HGB')!.value < 12.5) markers.push('HGB');
      if (m.get('FERRITIN')?.value && m.get('FERRITIN')!.value < 30) markers.push('FERRITIN');
      if (m.get('IRON')?.value && m.get('IRON')!.value < 50) markers.push('IRON');
      if (m.get('RBC')?.value && m.get('RBC')!.value < 4.2) markers.push('RBC');
      return { triggered: markers.length >= 2, severity: markers.length >= 3 ? 'high' : 'moderate', triggeringMarkers: markers };
    },
    recommendations: ['Iron bisglycinate 25-50mg with vitamin C', 'Investigate cause: blood loss, malabsorption, heavy periods', 'Eat iron-rich foods: red meat, lentils, spinach', 'Avoid tea/coffee at meals (inhibits absorption)', 'B12 and folate check (can cause anemia too)'],
  },
  {
    name: 'Liver Stress',
    description: 'Elevated liver enzymes indicate inflammation or fatty liver disease — affects detoxification, metabolism, and hormone clearance.',
    check: (m) => {
      const markers: string[] = [];
      if (m.get('ALT')?.value && m.get('ALT')!.value > 40) markers.push('ALT');
      if (m.get('AST')?.value && m.get('AST')!.value > 40) markers.push('AST');
      if (m.get('GGT')?.value && m.get('GGT')!.value > 50) markers.push('GGT');
      return { triggered: markers.length >= 2, severity: markers.length >= 3 ? 'high' : 'moderate', triggeringMarkers: markers };
    },
    recommendations: ['Eliminate alcohol completely for 30 days', 'NAC 1200mg/day + Milk Thistle 300mg/day', 'Lose weight if overweight (reduces fatty liver)', 'Liver ultrasound recommended', 'Check hepatitis B/C if not already done'],
  },
  {
    name: 'Kidney Decline',
    description: 'Elevated creatinine and/or uric acid suggest declining kidney function — early intervention is critical.',
    check: (m) => {
      const markers: string[] = [];
      if (m.get('CREAT')?.value && m.get('CREAT')!.value > 1.3) markers.push('CREAT');
      if (m.get('URIC_ACID')?.value && m.get('URIC_ACID')!.value > 7.0) markers.push('URIC_ACID');
      return { triggered: markers.length >= 1 && (m.get('CREAT')?.value || 0) > 1.3, severity: (m.get('CREAT')?.value || 0) > 1.5 ? 'high' : 'moderate', triggeringMarkers: markers };
    },
    recommendations: ['Hydrate aggressively (3L/day)', 'Nephrology referral if creatinine >1.5', 'Check Cystatin-C for confirmation', 'Reduce purine-rich foods if uric acid high', 'Stop creatine supplement temporarily for accurate reading'],
  },
  {
    name: 'Prediabetes',
    description: 'HbA1c 5.7-6.4% and/or fasting glucose 100-125 — reversible with aggressive lifestyle intervention. Without action, 70% progress to diabetes within 10 years.',
    check: (m) => {
      const markers: string[] = [];
      const hba1c = m.get('HBA1C');
      if (hba1c && hba1c.value >= thresholdValue('HBA1C_PREDIABETES_LOW') && hba1c.value < thresholdValue('HBA1C_DIABETES')) markers.push('HBA1C');
      const gluc = m.get('GLUC');
      if (gluc && gluc.value >= thresholdValue('GLUC_PREDIABETES_LOW') && gluc.value < thresholdValue('GLUC_DIABETES')) markers.push('GLUC');
      const insulin = m.get('INSULIN');
      if (insulin && insulin.value > thresholdValue('INSULIN_PREDIABETES')) markers.push('INSULIN');
      return { triggered: markers.length >= 1 && (markers.includes('HBA1C') || markers.includes('GLUC')), severity: markers.length >= 3 ? 'high' : 'moderate', triggeringMarkers: markers };
    },
    recommendations: ['URGENT: Prediabetes is reversible NOW', 'Berberine 1500mg/day (as effective as metformin in studies)', 'Eliminate refined carbs and sugar', 'Strength training 3x/week (muscle = glucose sink)', 'CGM (continuous glucose monitor) recommended for 2 weeks', 'Discuss metformin with endocrinologist'],
  },
  {
    name: 'Oxidative Stress',
    description: 'Pattern of low antioxidant markers + high inflammation — accelerates cellular aging through free radical damage.',
    check: (m) => {
      const markers: string[] = [];
      let count = 0;
      if (m.get('VITD')?.value && m.get('VITD')!.value < 30) { count++; markers.push('VITD'); }
      if (m.get('OMEGA3')?.value && m.get('OMEGA3')!.value < 6) { count++; markers.push('OMEGA3'); }
      if (m.get('HSCRP')?.value && m.get('HSCRP')!.value > 1.5) { count++; markers.push('HSCRP'); }
      if (m.get('HOMOCYS')?.value && m.get('HOMOCYS')!.value > 12) { count++; markers.push('HOMOCYS'); }
      if (m.get('GGT')?.value && m.get('GGT')!.value > 40) { count++; markers.push('GGT'); }
      return { triggered: count >= 3, severity: count >= 4 ? 'high' : 'moderate', triggeringMarkers: markers };
    },
    recommendations: ['NAC 1200mg/day (glutathione precursor)', 'Vitamin D 4000IU + Omega-3 2g/day', 'Eat 8-10 servings colorful vegetables/fruits daily', 'Curcumin 1g + green tea extract', 'Reduce alcohol, processed food, and seed oils'],
  },
];

// Count of known patterns — exported so landing page can use it as single
// source of truth (don't hardcode "12 patterns" in UI copy).
export const PATTERN_COUNT = PATTERNS.length;

// Descriptive-only view of PATTERNS (name / description / recommendations)
// stripped of the `check` fn so it serializes. Used by the SEO pages under
// /patterns/[slug]. Slug derived from name via URL-safe lowercase+dashes.
export function slugifyPatternName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}
// Biomarker codes each pattern can trigger on. Used by /patterns/[slug] to
// render "related biomarkers" links (internal SEO) and for downstream tooling
// that needs to know which markers feed which pattern without running a
// synthetic detection pass.
const PATTERN_CODE_MAP: Record<string, string[]> = {
  'Metabolic Syndrome':            ['GLUC', 'TRIG', 'HDL', 'INSULIN', 'HBA1C'],
  'Inflammatory Cluster':          ['HSCRP', 'WBC', 'HOMOCYS', 'FERRITIN'],
  'Thyroid Dysfunction':           ['TSH', 'FT4', 'ANTI_TPO'],
  'Nutritional Deficiency Cluster':['VITD', 'B12', 'FERRITIN', 'FOLAT', 'MAGNE', 'IRON'],
  'Cardiovascular Risk':           ['LDL', 'APOB', 'TRIG', 'HDL', 'HSCRP', 'HOMOCYS', 'LPA'],
  'Hormonal Imbalance':            ['TESTO', 'CORTISOL', 'DHEAS', 'ESTRADIOL'],
  'Iron Overload':                 ['FERRITIN', 'IRON'],
  'Anemia Cluster':                ['HGB', 'FERRITIN', 'IRON', 'RBC'],
  'Liver Stress':                  ['ALT', 'AST', 'GGT'],
  'Kidney Decline':                ['CREAT', 'URIC_ACID'],
  'Prediabetes':                   ['HBA1C', 'GLUC', 'INSULIN'],
  'Oxidative Stress':              ['VITD', 'OMEGA3', 'HSCRP', 'HOMOCYS', 'GGT'],
};

export const PATTERN_REFERENCE = PATTERNS.map(p => ({
  name: p.name,
  slug: slugifyPatternName(p.name),
  description: p.description,
  recommendations: p.recommendations,
  triggeringCodes: PATTERN_CODE_MAP[p.name] ?? [],
}));
export function getPatternRef(slug: string) {
  return PATTERN_REFERENCE.find(p => p.slug === slug);
}

/** Inverse lookup: given a biomarker code, which patterns can it trigger?
 *  Powers the "related patterns" links on /biomarkers/[code]. */
export function getPatternsForBiomarker(code: string): Array<{ name: string; slug: string }> {
  const upper = code.toUpperCase();
  return PATTERN_REFERENCE
    .filter(p => p.triggeringCodes.includes(upper))
    .map(p => ({ name: p.name, slug: p.slug }));
}

// ─────────────────────────────────────────────────────────────────────────────
// Exclusion layer — prevents the AI from being fed redundant overlapping
// patterns. Without this, a user with HbA1c 5.8 + TG 160 + HDL 38 would get
// Prediabetes + Metabolic Syndrome + (if HSCRP elevated) Inflammatory +
// Oxidative Stress, each with partially overlapping recommendations. The AI
// then writes four sets of similar advice. Pick the most specific / most
// actionable framing and drop the rest.
//
// Each rule: `suppress` is dropped when `when` is also triggered, UNLESS the
// `unless` override is truthy (escalation path — e.g. full diabetes overrides
// the "Prediabetes is enough" rule).
// ─────────────────────────────────────────────────────────────────────────────
type ExclusionRule = {
  suppress: string;
  when: string;
  unless?: (m: Map<string, BiomarkerValue>) => boolean;
};

const EXCLUSIONS: ExclusionRule[] = [
  // Prediabetes is a more actionable framing than the broader Metabolic Syndrome
  // for the same glucose signal. Keep Metabolic only if HbA1c crosses diabetic
  // threshold or the user has non-glucose cluster factors (low HDL / high TG).
  {
    suppress: 'Metabolic Syndrome',
    when: 'Prediabetes',
    unless: (m) => (m.get('HBA1C')?.value ?? 0) >= thresholdValue('HBA1C_DIABETES')
                || (m.get('HDL')?.value ?? 999) < thresholdValue('HDL_METABOLIC_M')
                || (m.get('TRIG')?.value ?? 0) >= 200,
  },
  // Anemia Cluster is a specific diagnosis; the broader Nutritional Deficiency
  // pattern double-counts FERRITIN / IRON. Keep only the specific one.
  { suppress: 'Nutritional Deficiency Cluster', when: 'Anemia Cluster' },
  // Oxidative Stress and Inflammatory Cluster share HSCRP + HOMOCYS + GGT.
  // Inflammatory is the more clinically-actionable framing (it points to
  // hidden sources: dental, gut, joint). Drop Oxidative when both fire.
  { suppress: 'Oxidative Stress', when: 'Inflammatory Cluster' },
];

// Medication input can be free-text strings ("prednisone 10mg daily") or
// the structured shape from profiles.medications ({name, dose, frequency}).
// Normalize to lowercase names so the rules below compare reliably.
export type MedicationInput = string | { name?: string | null } | null | undefined;

function normalizeMeds(meds: MedicationInput[] | null | undefined): string[] {
  if (!meds || !Array.isArray(meds)) return [];
  return meds
    .map(m => {
      if (!m) return '';
      if (typeof m === 'string') return m;
      return typeof m.name === 'string' ? m.name : '';
    })
    .map(s => s.toLowerCase())
    .filter(Boolean);
}

function hasAnyMed(names: string[], keywords: string[]): boolean {
  return names.some(n => keywords.some(k => n.includes(k)));
}

// Medication classes that materially change the meaning of a biomarker
// signature. Kept as keyword lists rather than drug IDs so the check matches
// brand names, generics, and common spelling variants without maintenance.
const CORTICOSTEROIDS = [
  'prednison',        // prednisone / prednisone(u) / prednisolone
  'dexamethason',
  'methylprednisolon', 'medrol',
  'hydrocortison',
  'budesonid',
  'cortisone',
];
const ANTIDIABETICS = [
  'metformin', 'glucophage',
  'glipizid', 'glyburid', 'glimepirid',          // sulfonylureas
  'sitagliptin', 'linagliptin', 'saxagliptin',    // DPP-4 inhibitors
  'empagliflozin', 'dapagliflozin', 'canagliflozin', 'jardiance', 'farxiga',  // SGLT2
  'semaglutid', 'liraglutid', 'dulaglutid', 'tirzepatid', 'ozempic', 'wegovy', 'mounjaro',  // GLP-1 / dual
  'pioglitazon',
  'insulin',
];

/** Medication-driven suppressions. Ordered so the most specific rule wins. */
function medicationSuppresses(
  patternName: string,
  markerMap: Map<string, BiomarkerValue>,
  medNames: string[],
): boolean {
  // Inflammatory Cluster: corticosteroids elevate WBC (neutrophilia is a known
  // side effect) and suppress HSCRP independently of real inflammation. The
  // cluster can't be trusted on a steroid-exposed lab panel.
  if (patternName === 'Inflammatory Cluster' && hasAnyMed(medNames, CORTICOSTEROIDS)) {
    return true;
  }
  // Metabolic Syndrome / Prediabetes: if the user is on an antidiabetic and
  // HbA1c is now in the optimal band (<6.0), the number reflects treatment
  // effect, not disease state. Suppress so we don't layer redundant "reverse
  // metabolic syndrome" advice on top of an already-controlled patient.
  // If HbA1c is missing we keep the pattern (absence is not evidence of control).
  const hba1c = markerMap.get('HBA1C')?.value;
  // "Controlled" = HbA1c now in sub-prediabetic band. Use the same registry
  // value the detector uses, so a future guideline revision flows through.
  if (hasAnyMed(medNames, ANTIDIABETICS) && typeof hba1c === 'number' && hba1c < thresholdValue('HBA1C_PREDIABETES_LOW') + 0.3) {
    if (patternName === 'Metabolic Syndrome' || patternName === 'Prediabetes') return true;
  }
  return false;
}

export function detectPatterns(
  biomarkers: BiomarkerValue[],
  medications: MedicationInput[] | null = null,
): DetectedPattern[] {
  const markerMap = new Map<string, BiomarkerValue>();
  for (const b of biomarkers) markerMap.set(b.code, b);
  const medNames = normalizeMeds(medications);

  const detected: DetectedPattern[] = [];
  for (const pattern of PATTERNS) {
    const result = pattern.check(markerMap);
    if (result.triggered) {
      detected.push({
        name: pattern.name,
        severity: result.severity,
        description: pattern.description,
        triggeringMarkers: result.triggeringMarkers,
        recommendations: pattern.recommendations,
      });
    }
  }

  // Apply exclusions — drop `suppress` patterns when their `when` partner
  // triggered and no `unless` escalation applies. Also apply medication-
  // driven suppressions (prednisone masks Inflammatory, metformin with
  // controlled HbA1c masks Metabolic / Prediabetes).
  const triggeredNames = new Set(detected.map(d => d.name));
  const filtered = detected.filter(d => {
    if (medicationSuppresses(d.name, markerMap, medNames)) return false;
    for (const rule of EXCLUSIONS) {
      if (rule.suppress !== d.name) continue;
      if (!triggeredNames.has(rule.when)) continue;
      if (rule.unless && rule.unless(markerMap)) continue;
      return false;  // suppressed
    }
    return true;
  });

  return filtered.sort((a, b) => {
    const order = { critical: 0, high: 1, moderate: 2, low: 3 };
    return order[a.severity] - order[b.severity];
  });
}
