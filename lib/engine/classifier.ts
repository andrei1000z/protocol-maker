import { BiomarkerValue, Classification } from '../types';
import { getBiomarkerRef } from './biomarkers';

export function classifyBiomarker(value: BiomarkerValue): BiomarkerValue {
  const ref = getBiomarkerRef(value.code);
  if (!ref) return { ...value, classification: 'OPTIMAL', longevityGap: 0 };

  const v = value.value;
  const { longevityOptimalLow: lo, longevityOptimalHigh: hi } = ref;

  let classification: Classification;
  let longevityGap: number;

  if (v >= lo && v <= hi) {
    classification = 'OPTIMAL';
    longevityGap = 0;
  } else if (v < lo) {
    const distFromOptimal = lo - v;
    const criticalThreshold = lo * 0.5;
    longevityGap = -distFromOptimal;
    if (v < criticalThreshold) classification = 'CRITICAL';
    else if (v < lo * 0.7) classification = 'DEFICIENT';
    else classification = 'SUBOPTIMAL_LOW';
  } else {
    const distFromOptimal = v - hi;
    const criticalThreshold = hi * 2;
    longevityGap = distFromOptimal;
    if (v > criticalThreshold) classification = 'CRITICAL';
    else if (v > hi * 1.5) classification = 'EXCESS';
    else classification = 'SUBOPTIMAL_HIGH';
  }

  return { ...value, classification, longevityGap };
}

export function classifyAll(biomarkers: BiomarkerValue[]): BiomarkerValue[] {
  return biomarkers.map(classifyBiomarker);
}

export function calculateLongevityScore(classified: BiomarkerValue[]): number {
  if (classified.length === 0) return 50;

  let score = 100;
  for (const b of classified) {
    switch (b.classification) {
      case 'OPTIMAL': break;
      case 'SUBOPTIMAL_LOW':
      case 'SUBOPTIMAL_HIGH': score -= 5; break;
      case 'DEFICIENT':
      case 'EXCESS': score -= 12; break;
      case 'CRITICAL': score -= 25; break;
    }
  }
  return Math.max(0, Math.min(100, score));
}

export function estimateBiologicalAge(chronologicalAge: number, classified: BiomarkerValue[]): number {
  const score = calculateLongevityScore(classified);
  const offset = ((50 - score) / 50) * 10;
  return Math.round(chronologicalAge + offset);
}

export function getClassificationColor(c: Classification): string {
  switch (c) {
    case 'OPTIMAL': return 'text-emerald-400';
    case 'SUBOPTIMAL_LOW':
    case 'SUBOPTIMAL_HIGH': return 'text-amber-400';
    case 'DEFICIENT':
    case 'EXCESS': return 'text-orange-400';
    case 'CRITICAL': return 'text-red-400';
  }
}

export function getClassificationBg(c: Classification): string {
  switch (c) {
    case 'OPTIMAL': return 'bg-emerald-500/20 border-emerald-500/30';
    case 'SUBOPTIMAL_LOW':
    case 'SUBOPTIMAL_HIGH': return 'bg-amber-500/20 border-amber-500/30';
    case 'DEFICIENT':
    case 'EXCESS': return 'bg-orange-500/20 border-orange-500/30';
    case 'CRITICAL': return 'bg-red-500/20 border-red-500/30';
  }
}
