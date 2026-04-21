// Central registry for clinical thresholds used by the engine.
//
// Previously these lived as magic numbers embedded in patterns.ts and
// classifier.ts ("if HbA1c > 6.5", "if HSCRP > 1.0"). That's fine as long as
// guidelines never change — but guidelines do change, and a cross-cutting
// threshold update meant grepping for numbers and hoping you caught them all.
//
// Every threshold has a `version` and `source` so:
//   1. Future A/B testing can swap ACTIVE → a mutation-tested alternate.
//   2. Audit trail survives reviewer questions ("why 1.0 not 3.0 for hsCRP?").
//   3. Unit tests pin behavior; changing a constant here surfaces as a test
//      diff, not a silent production drift.
//
// This file is a READ-ONLY map. Mutation must go through a code change +
// tests. There is intentionally no runtime "set threshold" API.

export interface ClinicalThreshold {
  value: number;
  unit: string;
  /** Human-readable anchor for the value. */
  source: string;
  /** Bumped on intentional threshold revisions. Useful for A/B tracking. */
  version: number;
}

/** Guideline-driven cutoffs used across pattern detection + classifier. */
export const CLINICAL_THRESHOLDS = {
  // ── Glucose / diabetes axis ────────────────────────────────────────────────
  HBA1C_PREDIABETES_LOW:   { value: 5.7,  unit: '%',     source: 'ADA 2025 Standards of Care', version: 1 },
  HBA1C_PREDIABETES_HIGH:  { value: 6.4,  unit: '%',     source: 'ADA 2025 Standards of Care', version: 1 },
  HBA1C_DIABETES:          { value: 6.5,  unit: '%',     source: 'ADA 2025 Standards of Care', version: 1 },
  HBA1C_METABOLIC_CLUSTER: { value: 5.6,  unit: '%',     source: 'NCEP ATP III metabolic syndrome', version: 1 },
  GLUC_PREDIABETES_LOW:    { value: 100,  unit: 'mg/dL', source: 'ADA IFG cutoff',                version: 1 },
  GLUC_DIABETES:           { value: 126,  unit: 'mg/dL', source: 'ADA fasting diabetes cutoff',   version: 1 },
  INSULIN_METABOLIC:       { value: 10,   unit: 'µIU/mL', source: 'HOMA-IR derivative',           version: 1 },
  INSULIN_PREDIABETES:     { value: 7,    unit: 'µIU/mL', source: 'internal — early resistance',  version: 1 },

  // ── Lipids ─────────────────────────────────────────────────────────────────
  LDL_CARDIO_RISK:         { value: 130,  unit: 'mg/dL', source: 'ACC/AHA borderline high',       version: 1 },
  APOB_CARDIO_RISK:        { value: 90,   unit: 'mg/dL', source: 'ACC/AHA secondary target',      version: 1 },
  TRIG_METABOLIC:          { value: 150,  unit: 'mg/dL', source: 'NCEP ATP III triglycerides',    version: 1 },
  TRIG_SEVERE:             { value: 500,  unit: 'mg/dL', source: 'pancreatitis-risk threshold',   version: 1 },
  HDL_METABOLIC_M:         { value: 40,   unit: 'mg/dL', source: 'NCEP ATP III — men',             version: 1 },
  HDL_CARDIO_RISK:         { value: 45,   unit: 'mg/dL', source: 'Framingham risk',                version: 1 },
  LPA_HIGH:                { value: 75,   unit: 'nmol/L', source: 'EAS 2022 Lp(a) consensus',     version: 1 },

  // ── Inflammation ───────────────────────────────────────────────────────────
  HSCRP_ELEVATED:          { value: 1.0,  unit: 'mg/L',  source: 'AHA/CDC — moderate cardio risk', version: 1 },
  HSCRP_HIGH:              { value: 1.5,  unit: 'mg/L',  source: 'elevated inflammatory bucket',   version: 1 },
  HOMOCYS_ELEVATED:        { value: 10,   unit: 'µmol/L', source: 'vascular-risk threshold',       version: 1 },
  HOMOCYS_HIGH:            { value: 12,   unit: 'µmol/L', source: 'aggressive longevity target',   version: 1 },
  WBC_ELEVATED:            { value: 7.0,  unit: '10^3/µL', source: 'internal — inflammatory band', version: 1 },

  // ── Thyroid ────────────────────────────────────────────────────────────────
  TSH_SUBCLINICAL:         { value: 2.5,  unit: 'µIU/mL', source: 'AACE recommended upper limit', version: 1 },
  TSH_OVERT:               { value: 4.0,  unit: 'µIU/mL', source: 'classical lab upper limit',    version: 1 },
  FT4_LOW:                 { value: 0.9,  unit: 'ng/dL',  source: 'bottom of lab reference',       version: 1 },
  ANTI_TPO_POSITIVE:       { value: 34,   unit: 'IU/mL',  source: 'assay positivity cutoff',       version: 1 },

  // ── Vitamins / minerals ────────────────────────────────────────────────────
  VITD_INSUFFICIENT:       { value: 30,   unit: 'ng/mL', source: 'Endocrine Society',              version: 1 },
  B12_LOW:                 { value: 400,  unit: 'pg/mL', source: 'cognitive-risk threshold',       version: 1 },
  FERRITIN_LOW:            { value: 30,   unit: 'ng/mL', source: 'WHO iron-deficiency cutoff',     version: 1 },
  FERRITIN_HIGH:           { value: 200,  unit: 'ng/mL', source: 'hemochromatosis screening',      version: 1 },
  FERRITIN_IRON_OVERLOAD:  { value: 400,  unit: 'ng/mL', source: 'aggressive iron-overload',       version: 1 },
  FOLAT_LOW:               { value: 10,   unit: 'ng/mL', source: 'cognitive-support threshold',    version: 1 },
  MAGNE_LOW:               { value: 1.8,  unit: 'mg/dL', source: 'bottom of reference',            version: 1 },
  IRON_LOW:                { value: 50,   unit: 'µg/dL', source: 'iron-deficiency screen',         version: 1 },
  IRON_HIGH:               { value: 150,  unit: 'µg/dL', source: 'iron-overload screen',           version: 1 },
  OMEGA3_INDEX_LOW:        { value: 6,    unit: '%',     source: 'Harris 2008 cardio-protective',  version: 1 },

  // ── Hematology ─────────────────────────────────────────────────────────────
  HGB_LOW:                 { value: 12.5, unit: 'g/dL',  source: 'anemia screen',                  version: 1 },
  RBC_LOW:                 { value: 4.2,  unit: '10^6/µL', source: 'lower lab reference',          version: 1 },

  // ── Hormones ───────────────────────────────────────────────────────────────
  TESTO_LOW:               { value: 400,  unit: 'ng/dL', source: 'midlife optimal floor — male',  version: 1 },
  CORTISOL_HIGH:           { value: 20,   unit: 'µg/dL', source: 'morning upper reference',        version: 1 },
  DHEAS_LOW:               { value: 150,  unit: 'µg/dL', source: 'adrenal support threshold',      version: 1 },
  ESTRADIOL_HIGH_M:        { value: 50,   unit: 'pg/mL', source: 'aromatization risk — men',       version: 1 },

  // ── Liver / kidney ─────────────────────────────────────────────────────────
  ALT_ELEVATED:            { value: 40,   unit: 'U/L',   source: 'NAFLD-screening',                version: 1 },
  AST_ELEVATED:            { value: 40,   unit: 'U/L',   source: 'standard lab upper',              version: 1 },
  GGT_ELEVATED:            { value: 40,   unit: 'U/L',   source: 'oxidative-stress marker',         version: 1 },
  GGT_ELEVATED_HIGH:       { value: 50,   unit: 'U/L',   source: 'inflammatory upper band',         version: 1 },
  CREAT_HIGH:              { value: 1.3,  unit: 'mg/dL', source: 'CKD-screening male',              version: 1 },
  CREAT_SEVERE:            { value: 1.5,  unit: 'mg/dL', source: 'nephrology-referral trigger',     version: 1 },
  URIC_HIGH:               { value: 7.0,  unit: 'mg/dL', source: 'gout-risk threshold',             version: 1 },
} as const;

export type ThresholdKey = keyof typeof CLINICAL_THRESHOLDS;

/** Read one threshold value. Thin wrapper so call sites can grep for
 *  `thresholdValue(` and discover the registry instead of freestanding 1.5s. */
export function thresholdValue(key: ThresholdKey): number {
  return CLINICAL_THRESHOLDS[key].value;
}
