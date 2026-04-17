// PhenoAge biological age algorithm
// Source: Levine et al., "An epigenetic biomarker of aging for lifespan and healthspan"
// Uses 9 blood biomarkers to predict biological age

import { BiomarkerValue } from '../types';

interface PhenoAgeInputs {
  albumin?: number;        // g/dL
  creatinine?: number;     // mg/dL
  glucose?: number;        // mg/dL
  crp?: number;            // mg/L
  lymphocytePercent?: number; // %
  mcv?: number;            // fL (mean cell volume)
  rdw?: number;            // % (red cell distribution width)
  alp?: number;            // U/L (alkaline phosphatase)
  wbc?: number;            // 10^3/µL
}

export function calculatePhenoAge(inputs: PhenoAgeInputs, chronologicalAge: number): number | null {
  // Requires at minimum: creatinine, glucose, CRP, WBC
  const required = [inputs.creatinine, inputs.glucose, inputs.crp, inputs.wbc];
  if (required.some(v => v === undefined)) return null;

  // Default values for missing inputs (population averages)
  const albumin = inputs.albumin ?? 4.5;
  const creatinine = inputs.creatinine!;
  const glucose = inputs.glucose!;
  const crp = inputs.crp!;
  const lymphocytePercent = inputs.lymphocytePercent ?? 30;
  const mcv = inputs.mcv ?? 90;
  const rdw = inputs.rdw ?? 13;
  const alp = inputs.alp ?? 70;
  const wbc = inputs.wbc!;

  // Convert units: creatinine mg/dL → umol/L (×88.4), glucose mg/dL → mmol/L (÷18)
  const creat_umol = creatinine * 88.4;
  const glucose_mmol = glucose / 18;

  // Log-transform CRP, handle zero
  const lnCRP = Math.log(Math.max(crp, 0.01));

  // Weighted linear combination (Levine 2018 coefficients)
  const xb =
    -19.907 +
    -0.0336 * albumin * 10 +
    0.0095 * creat_umol +
    0.1953 * glucose_mmol +
    0.0954 * lnCRP +
    -0.0120 * lymphocytePercent +
    0.0268 * mcv +
    0.3306 * rdw +
    0.00188 * alp +
    0.0554 * wbc +
    0.0804 * chronologicalAge;

  // Mortality score
  const gamma = 0.0076927;
  const mortalityScore = 1 - Math.exp(-Math.exp(xb) * (Math.exp(gamma * 120) - 1) / gamma);

  // Convert to PhenoAge
  const phenoAge = 141.50225 + Math.log(-0.00553 * Math.log(1 - mortalityScore)) / 0.09165;

  return Math.round(phenoAge * 10) / 10;
}

export function extractPhenoAgeInputs(biomarkers: BiomarkerValue[]): PhenoAgeInputs {
  const map = new Map(biomarkers.map(b => [b.code, b.value]));
  return {
    creatinine: map.get('CREAT'),
    glucose: map.get('GLUC'),
    crp: map.get('HSCRP'),
    wbc: map.get('WBC'),
    // Optional (not always measured):
    // albumin, lymphocytePercent, mcv, rdw, alp
  };
}
