import { BiomarkerValue, Classification } from '../types';
import { getBiomarkerRef } from './biomarkers';

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

export function calculateLongevityScore(classified: BiomarkerValue[]): number {
  if (classified.length === 0) return 50;

  const weights: Record<string, number> = {
    HSCRP: 3, HBA1C: 3, INSULIN: 2.5, GLUC: 2, LDL: 2, HDL: 2, TRIG: 2,
    VITD: 2, OMEGA3: 2.5, HOMOCYS: 2, APOB: 2.5, TSH: 1.5,
    FERRITIN: 1.5, B12: 1.5, TESTO: 1.5, ALT: 1, CREAT: 1.5,
  };

  let totalWeight = 0;
  let weightedScore = 0;

  for (const b of classified) {
    const w = weights[b.code] || 1;
    totalWeight += w;

    switch (b.classification) {
      case 'OPTIMAL': weightedScore += w * 100; break;
      case 'SUBOPTIMAL_LOW':
      case 'SUBOPTIMAL_HIGH': weightedScore += w * 65; break;
      case 'DEFICIENT':
      case 'EXCESS': weightedScore += w * 35; break;
      case 'CRITICAL': weightedScore += w * 10; break;
    }
  }

  const rawScore = totalWeight > 0 ? weightedScore / totalWeight : 50;

  // Bonus for having more markers tested (more data = more confidence)
  const dataBonusFactor = Math.min(1, classified.length / 15);
  const adjustedScore = rawScore * (0.85 + 0.15 * dataBonusFactor);

  return Math.max(0, Math.min(100, Math.round(adjustedScore)));
}

export function estimateBiologicalAge(chronologicalAge: number, classified: BiomarkerValue[]): number {
  if (classified.length === 0) return chronologicalAge;

  const score = calculateLongevityScore(classified);

  // Score 100 = 5 years younger, Score 0 = 10 years older
  // Score 50 = chronological age
  const offset = ((50 - score) / 50) * 7.5;

  // Critical markers have extra aging impact
  const criticalCount = classified.filter(b => b.classification === 'CRITICAL').length;
  const criticalPenalty = criticalCount * 1.5;

  return Math.max(18, Math.round(chronologicalAge + offset + criticalPenalty));
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
