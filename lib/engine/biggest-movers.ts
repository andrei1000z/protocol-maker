// "Biggest movers" engine — given a time series per metric + direction
// semantics, surface the top N with the largest signed change vs the prior
// window. The Statistics page uses this to put a punchy narrative at the
// top ("your sleep jumped 18% over 2 weeks; your resting HR dropped 4 bpm")
// instead of forcing users to hunt through every chart.
//
// Pure function, no DOM / React / DB — trivially testable.

export type Direction = 'up' | 'down' | 'target';

export interface MoverInput {
  key: string;
  label: string;
  unit?: string;
  direction: Direction;
  target?: number;
  decimals?: number;
  // Array of { date, value } sorted ascending by date. At least 4 points
  // are required to compute a meaningful recent-vs-prior delta.
  series: Array<{ date: string; value: number }>;
}

export interface Mover {
  key: string;
  label: string;
  unit?: string;
  direction: Direction;
  priorAvg: number;
  recentAvg: number;
  delta: number;        // signed raw (recent − prior)
  pctChange: number;    // signed % change; 0 when priorAvg === 0
  improved: boolean | null;   // null = flat / not enough points
  improvementPct: number;     // always positive when improved; negative when declined
  sampleCount: number;        // total points used
}

/**
 * Split a series roughly in half by date: the older half is the "prior
 * window", the newer half is the "recent window". This is more robust than
 * "last 7 days vs previous 7" because the user might log sporadically —
 * we want to compare relative periods of activity, not fixed time spans.
 *
 * The function returns null if the series has fewer than 4 points (we need
 * at least 2 per half for an average to carry signal).
 */
export function computeMover(input: MoverInput): Mover | null {
  const { series, direction, target } = input;
  if (series.length < 4) return null;

  // Sort-stable split — keeps deterministic ordering when two points share
  // the same date.
  const sorted = [...series].sort((a, b) => a.date.localeCompare(b.date));
  const half = Math.floor(sorted.length / 2);
  const prior = sorted.slice(0, half);
  const recent = sorted.slice(half);
  if (prior.length === 0 || recent.length === 0) return null;

  const avg = (arr: typeof sorted) => arr.reduce((s, p) => s + p.value, 0) / arr.length;
  const priorAvg = avg(prior);
  const recentAvg = avg(recent);
  const delta = recentAvg - priorAvg;
  const pctChange = priorAvg === 0 ? 0 : (delta / Math.abs(priorAvg)) * 100;

  let improved: boolean | null;
  let improvementPct: number;
  if (direction === 'up') {
    improved = delta > 0 ? true : delta < 0 ? false : null;
    improvementPct = pctChange;
  } else if (direction === 'down') {
    improved = delta < 0 ? true : delta > 0 ? false : null;
    improvementPct = -pctChange;
  } else {
    // target: closer to target = better
    const t = target ?? 0;
    const priorDist = Math.abs(priorAvg - t);
    const recentDist = Math.abs(recentAvg - t);
    if (priorDist === recentDist) {
      improved = null;
      improvementPct = 0;
    } else {
      improved = recentDist < priorDist;
      improvementPct = priorDist === 0 ? 0 : ((priorDist - recentDist) / priorDist) * 100;
    }
  }

  return {
    key: input.key,
    label: input.label,
    unit: input.unit,
    direction,
    priorAvg,
    recentAvg,
    delta,
    pctChange,
    improved,
    improvementPct,
    sampleCount: sorted.length,
  };
}

/**
 * Rank + return the top N biggest movers. Sort key is absolute value of
 * improvementPct — biggest "moves" surface whether improvement or decline.
 * Ties broken by sample count (more data = more trustworthy).
 */
export function pickBiggestMovers(inputs: MoverInput[], limit = 3): Mover[] {
  const computed: Mover[] = [];
  for (const i of inputs) {
    const m = computeMover(i);
    if (m) computed.push(m);
  }
  computed.sort((a, b) => {
    const absDiff = Math.abs(b.improvementPct) - Math.abs(a.improvementPct);
    if (Math.abs(absDiff) > 0.01) return absDiff;
    return b.sampleCount - a.sampleCount;
  });
  return computed.slice(0, limit);
}
