// Biomarker trend computation — compare latest test against the previous one.
//
// Used on the dashboard biomarker readout (↑/↓ chip next to each value) so
// users see movement at a glance instead of having to open /history and
// eyeball two tests.
//
// Design:
//   - Comparison requires ≥ 2 blood tests. First-test users get no arrows.
//   - Direction of "better" is per-biomarker. LDL going DOWN is good,
//     VitD going UP is good. `LOWER_IS_BETTER` maintained alongside the
//     existing history-page set (kept in sync by intent — same codes).
//   - Absolute deltas smaller than a per-biomarker noise floor are classified
//     as "steady" rather than up/down, so assay noise doesn't flip arrows.

import { BIOMARKER_DB } from './biomarkers';

export interface BloodTestLite {
  taken_at: string;
  biomarkers: Array<{ code: string; value: number; unit?: string }>;
}

/** Codes where a LOWER value is healthier. Matches the set used in /history. */
const LOWER_IS_BETTER = new Set([
  'LDL', 'TRIG', 'HSCRP', 'HOMOCYS', 'HBA1C', 'GLUC', 'INSULIN',
  'ALT', 'AST', 'GGT', 'CREAT', 'URIC_ACID', 'WBC', 'CORTISOL', 'APOB',
  'ALP', 'FERRITIN', 'LPA',
]);

/** Noise floor per code (absolute units). Deltas smaller than this are
 *  treated as "steady". Derived from assay-level CV, not statistically —
 *  the point is not to declare a "trend" off lab-to-lab noise. */
const NOISE_FLOOR: Record<string, number> = {
  LDL: 3, HDL: 2, TRIG: 10, APOB: 3, LPA: 5,
  HBA1C: 0.1, GLUC: 3, INSULIN: 1,
  HSCRP: 0.3, HOMOCYS: 0.5,
  ALT: 3, AST: 3, GGT: 3, ALP: 5, ALBUMIN: 0.1,
  CREAT: 0.05, URIC_ACID: 0.2,
  WBC: 0.2, HGB: 0.3, RBC: 0.1, MCV: 1, RDW: 0.2, LYMPH_PCT: 2,
  VITD: 2, B12: 30, FOLAT: 0.5, FERRITIN: 10, MAGNE: 0.1, IRON: 5,
  TSH: 0.2, FT4: 0.05, ANTI_TPO: 2,
  TESTO: 20, ESTRADIOL: 5, CORTISOL: 1, DHEAS: 10,
  OMEGA3: 0.3,
};

export type TrendDirection = 'up' | 'down' | 'steady';

export interface BiomarkerTrend {
  code: string;
  /** Signed delta (latest - previous). Positive = went up. */
  delta: number;
  /** Absolute percentage change vs previous. Useful for human copy. */
  pctChange: number;
  /** Raw directional change, ignoring the "better" axis. */
  direction: TrendDirection;
  /** Whether the direction is moving toward the healthier pole. */
  improved: boolean | null;
  /** Latest + previous values kept around for tooltips. */
  latestValue: number;
  previousValue: number;
  daysBetween: number;
}

/** Compute per-biomarker trend for the user's latest two tests.
 *
 *  Returns a map keyed by code so the dashboard can do O(1) lookups while
 *  rendering the biomarker readout. Missing codes simply aren't in the map.
 */
export function computeBiomarkerTrends(tests: BloodTestLite[]): Map<string, BiomarkerTrend> {
  const trends = new Map<string, BiomarkerTrend>();
  if (!Array.isArray(tests) || tests.length < 2) return trends;

  // Sort chronologically so "previous" is unambiguous regardless of caller order.
  const sorted = [...tests].sort((a, b) => new Date(a.taken_at).getTime() - new Date(b.taken_at).getTime());
  const latest = sorted[sorted.length - 1];
  const previous = sorted[sorted.length - 2];
  const daysBetween = Math.max(1, Math.round(
    (new Date(latest.taken_at).getTime() - new Date(previous.taken_at).getTime()) / 864e5
  ));

  const prevByCode = new Map(previous.biomarkers.map(b => [b.code.toUpperCase(), b.value]));
  for (const b of latest.biomarkers) {
    const code = b.code.toUpperCase();
    const prev = prevByCode.get(code);
    if (typeof prev !== 'number' || typeof b.value !== 'number') continue;
    const delta = b.value - prev;
    const pctChange = prev !== 0 ? (delta / prev) * 100 : 0;
    const floor = NOISE_FLOOR[code] ?? 0;
    const direction: TrendDirection = Math.abs(delta) < floor
      ? 'steady'
      : delta > 0 ? 'up' : 'down';
    let improved: boolean | null = null;
    if (direction !== 'steady') {
      const lowerBetter = LOWER_IS_BETTER.has(code);
      improved = lowerBetter ? direction === 'down' : direction === 'up';
    }
    trends.set(code, {
      code,
      delta,
      pctChange,
      direction,
      improved,
      latestValue: b.value,
      previousValue: prev,
      daysBetween,
    });
  }
  return trends;
}

/** Returns codes where the user has at least one value outside the optimal
 *  range AND the most recent retest is older than `retestIntervalWeeks`. */
export function computeRetestDue(
  latestTest: BloodTestLite | null | undefined,
): Array<{ code: string; shortName: string; weeksSinceTest: number; weeksOverdue: number }> {
  if (!latestTest) return [];
  const takenMs = new Date(latestTest.taken_at).getTime();
  const weeksSince = Math.max(0, Math.round((Date.now() - takenMs) / (7 * 864e5)));
  const out: Array<{ code: string; shortName: string; weeksSinceTest: number; weeksOverdue: number }> = [];
  for (const b of latestTest.biomarkers) {
    const ref = BIOMARKER_DB.find(r => r.code === b.code.toUpperCase());
    if (!ref || !ref.retestIntervalWeeks || ref.retestIntervalWeeks <= 0) continue;
    const isOutOfRange =
      typeof b.value === 'number' &&
      (b.value < ref.longevityOptimalLow || b.value > ref.longevityOptimalHigh);
    if (!isOutOfRange) continue;
    if (weeksSince >= ref.retestIntervalWeeks) {
      out.push({
        code: b.code.toUpperCase(),
        shortName: ref.shortName || ref.name,
        weeksSinceTest: weeksSince,
        weeksOverdue: weeksSince - ref.retestIntervalWeeks,
      });
    }
  }
  // Most overdue first — user's eye lands on what's been slipping longest.
  return out.sort((a, b) => b.weeksOverdue - a.weeksOverdue);
}
