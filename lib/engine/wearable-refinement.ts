// ─────────────────────────────────────────────────────────────────────────────
// Refine deterministic longevity / bio-age / aging-pace using the user's
// last ~30 days of daily_metrics. The base estimators in classifier.ts work
// off the profile + bloodwork SNAPSHOT — they don't see a Samsung Watch
// streaming HRV every morning. This module reads the recent signal and
// nudges the baseline in the direction of ground truth.
//
// Signals used (only the ones we actually get in daily_metrics):
//   • resting_hr              — lower than age-expected = cardio fitness credit
//   • hrv / hrv_sleep_avg     — higher than age-expected = autonomic reserve
//   • sleep_hours             — consistent 7-9h = recovery bonus
//   • sleep_score             — wearable sleep quality (0-100)
//   • steps                   — activity proxy
//   • active_time_min         — deliberate movement minutes
//   • stress_level_avg        — self-reported day average
//   • bp_systolic_morning     — cardiovascular load
//   • body_fat_pct            — composition trend
//   • body_score              — smart-scale composite
//
// Scope rules:
//   • Only use metrics with ≥5 non-null entries in the window (reduces noise).
//   • Adjustments are small (±0.04 for pace, ±1 yr for bio age, ±4 pts for
//     longevity score) — wearable data refines but should not dominate the
//     profile+bloodwork baseline.
// ─────────────────────────────────────────────────────────────────────────────

export interface RecentMetricRow {
  resting_hr?: number | null;
  hrv?: number | null;
  hrv_sleep_avg?: number | null;
  sleep_hours?: number | null;
  sleep_score?: number | null;
  steps?: number | null;
  active_time_min?: number | null;
  stress_level?: number | null;
  stress_level_avg?: number | null;
  bp_systolic_morning?: number | null;
  body_fat_pct?: number | null;
  body_score?: number | null;
}

function avg(xs: (number | null | undefined)[]): number | null {
  const ys = xs.filter((n): n is number => typeof n === 'number' && Number.isFinite(n));
  if (ys.length < 5) return null;   // not enough signal
  return ys.reduce((s, n) => s + n, 0) / ys.length;
}

function stdev(xs: (number | null | undefined)[]): number | null {
  const ys = xs.filter((n): n is number => typeof n === 'number' && Number.isFinite(n));
  if (ys.length < 5) return null;
  const m = ys.reduce((s, n) => s + n, 0) / ys.length;
  const v = ys.reduce((s, n) => s + (n - m) ** 2, 0) / ys.length;
  return Math.sqrt(v);
}

// Expected resting HR by age+sex. Lower = more fit. Based on normative data
// from large cohort studies (Nes 2013, Shookster 2020). Trained athletes
// often sit 10+ bpm below these.
function expectedRestingHR(age: number, sex: 'male' | 'female' | string): number {
  const base = sex === 'female' ? 70 : 68;
  return base + Math.max(0, (age - 30)) * 0.08;
}

// Expected HRV (RMSSD ms) by age. Drops ~0.5–0.8 ms/yr. Female averages
// slightly lower RMSSD than male.
function expectedHRV(age: number, sex: 'male' | 'female' | string): number {
  const baseline = sex === 'female' ? 48 : 52;
  return Math.max(15, baseline - Math.max(0, age - 25) * 0.6);
}

// Build a concise recent-metrics summary with the averages that matter.
// Returned shape is cheap to inline into AI prompts and is also what the
// refinement functions below consume.
export interface RecentSignalSummary {
  days: number;                       // how many rows were looked at
  restingHR: number | null;
  hrv: number | null;                 // prefer sleep HRV when present (less noise)
  sleepHours: number | null;
  sleepHoursStdev: number | null;     // sleep consistency proxy
  sleepScore: number | null;
  steps: number | null;
  activeTimeMin: number | null;
  stress: number | null;              // avg of stress_level_avg or stress_level
  systolic: number | null;
  bodyFatPct: number | null;
  bodyScore: number | null;
  // Derived flags — true/false/null (null = insufficient data)
  restingHRBelowExpected: boolean | null;
  hrvAboveExpected: boolean | null;
  sleepIsConsistent: boolean | null;
  activityHigh: boolean | null;
  stressHigh: boolean | null;
}

export function summarizeRecentMetrics(
  metrics: RecentMetricRow[],
  profile: { age?: number | string | null; sex?: string | null }
): RecentSignalSummary {
  const age = Number(profile.age) || 35;
  const sex = String(profile.sex || 'male');

  const restingHR = avg(metrics.map(m => m.resting_hr));
  const hrvSleep = avg(metrics.map(m => m.hrv_sleep_avg));
  const hrvDay = avg(metrics.map(m => m.hrv));
  const hrv = hrvSleep ?? hrvDay;
  const sleepHours = avg(metrics.map(m => m.sleep_hours));
  const sleepHoursSD = stdev(metrics.map(m => m.sleep_hours));
  const sleepScore = avg(metrics.map(m => m.sleep_score));
  const steps = avg(metrics.map(m => m.steps));
  const activeTimeMin = avg(metrics.map(m => m.active_time_min));
  const stress = avg(metrics.map(m => m.stress_level_avg ?? m.stress_level));
  const systolic = avg(metrics.map(m => m.bp_systolic_morning));
  const bodyFatPct = avg(metrics.map(m => m.body_fat_pct));
  const bodyScore = avg(metrics.map(m => m.body_score));

  const expHR = expectedRestingHR(age, sex);
  const expHRV = expectedHRV(age, sex);

  return {
    days: metrics.length,
    restingHR,
    hrv,
    sleepHours,
    sleepHoursStdev: sleepHoursSD,
    sleepScore,
    steps,
    activeTimeMin,
    stress,
    systolic,
    bodyFatPct,
    bodyScore,
    restingHRBelowExpected: restingHR === null ? null : restingHR < expHR - 3,
    hrvAboveExpected:       hrv === null       ? null : hrv > expHRV + 5,
    sleepIsConsistent:      sleepHoursSD === null ? null : sleepHoursSD < 0.9,
    activityHigh:           steps === null     ? null : steps >= 9000,
    stressHigh:             stress === null    ? null : stress >= 7,
  };
}

// ─── refinement helpers ─────────────────────────────────────────────────────

// Confidence tiers. A user with 25 elite days of data contains far more
// signal than one with 5 OK days — the previous fixed ±0.03 pace cap used
// the same ceiling for both, underusing the stronger signal.
//
// Returns the scaling factor applied to every individual adjustment below:
//   days ≥ 25 → 1.6×  (allows ~±0.08 pace total after summing nudges)
//   days ≥ 12 → 1.1×  (allows ~±0.05)
//   days <  5 → 0     (not enough signal — suppress refinement entirely)
//   else        0.6×  (current ~±0.03 ceiling)
function confidenceScale(days: number): number {
  if (days >= 25) return 1.6;
  if (days >= 12) return 1.1;
  if (days <   5) return 0;
  return 0.6;
}

// Tier also caps the TOTAL drift allowed from the base value so a handful of
// adjustments summing in the same direction can't push pace past a plausible
// band. Tuple: [maxPaceDrift, maxBioAgeYears, maxScorePoints].
function confidenceCaps(days: number): [number, number, number] {
  if (days >= 25) return [0.08, 2.5, 6];
  if (days >= 12) return [0.05, 1.5, 4];
  if (days <   5) return [0,    0,   0];
  return [0.03, 1,   2];
}

export function refineAgingPace(basePace: number, s: RecentSignalSummary): number {
  const scale = confidenceScale(s.days);
  if (scale === 0) return Math.round(basePace * 100) / 100;
  let delta = 0;

  if (s.restingHRBelowExpected === true) delta -= 0.03;
  else if (s.restingHR !== null && s.restingHR >= 80)   delta += 0.03;

  if (s.hrvAboveExpected === true) delta -= 0.03;
  else if (s.hrv !== null && s.hrv < 25)                delta += 0.03;

  if (s.sleepHours !== null) {
    if (s.sleepHours < 6) delta += 0.04;
    else if (s.sleepHours >= 7.5 && s.sleepHours <= 9) delta -= 0.02;
  }
  if (s.sleepIsConsistent === true) delta -= 0.01;
  if (s.sleepScore !== null && s.sleepScore < 65) delta += 0.02;

  if (s.activityHigh === true) delta -= 0.02;
  else if (s.steps !== null && s.steps < 4500) delta += 0.02;

  if (s.stressHigh === true) delta += 0.02;

  if (s.systolic !== null) {
    if (s.systolic >= 140) delta += 0.04;
    else if (s.systolic <= 115) delta -= 0.01;
  }

  const [maxPaceDrift] = confidenceCaps(s.days);
  const scaledDelta = Math.max(-maxPaceDrift, Math.min(maxPaceDrift, delta * scale));
  return Math.max(0.6, Math.min(1.55, Math.round((basePace + scaledDelta) * 100) / 100));
}

export function refineBiologicalAge(baseBioAge: number, chronoAge: number, s: RecentSignalSummary): number {
  const scale = confidenceScale(s.days);
  if (scale === 0) return Math.round(baseBioAge * 10) / 10;
  let delta = 0;

  if (s.restingHRBelowExpected === true) delta -= 0.7;
  else if (s.restingHR !== null && s.restingHR >= 80) delta += 0.8;

  if (s.hrvAboveExpected === true) delta -= 0.6;
  else if (s.hrv !== null && s.hrv < 25) delta += 0.7;

  if (s.sleepHours !== null && s.sleepHours < 6) delta += 0.6;
  if (s.sleepIsConsistent === true) delta -= 0.2;

  if (s.activityHigh === true) delta -= 0.4;
  else if (s.steps !== null && s.steps < 4500) delta += 0.5;

  if (s.systolic !== null && s.systolic >= 140) delta += 0.7;
  if (s.stressHigh === true) delta += 0.3;

  const [, maxBioAgeDrift] = confidenceCaps(s.days);
  const scaledDelta = Math.max(-maxBioAgeDrift, Math.min(maxBioAgeDrift, delta * scale));
  return Math.max(5, Math.min(chronoAge + 25, Math.round((baseBioAge + scaledDelta) * 10) / 10));
}

export function refineLongevityScore(baseScore: number, s: RecentSignalSummary): number {
  const scale = confidenceScale(s.days);
  if (scale === 0) return Math.round(baseScore);
  let delta = 0;

  if (s.restingHRBelowExpected === true) delta += 2;
  else if (s.restingHR !== null && s.restingHR >= 80) delta -= 2;

  if (s.hrvAboveExpected === true) delta += 2;
  else if (s.hrv !== null && s.hrv < 25) delta -= 2;

  if (s.sleepHours !== null) {
    if (s.sleepHours >= 7.5 && s.sleepHours <= 9) delta += 2;
    else if (s.sleepHours < 6) delta -= 3;
  }
  if (s.sleepIsConsistent === true) delta += 1;

  if (s.activityHigh === true) delta += 2;
  else if (s.steps !== null && s.steps < 4500) delta -= 2;

  if (s.stressHigh === true) delta -= 2;

  if (s.systolic !== null && s.systolic >= 140) delta -= 3;

  const [, , maxScoreDrift] = confidenceCaps(s.days);
  const scaledDelta = Math.max(-maxScoreDrift, Math.min(maxScoreDrift, delta * scale));
  return Math.max(0, Math.min(100, Math.round(baseScore + scaledDelta)));
}

// Human-readable one-paragraph summary of what wearables say about the user.
// Goes into the AI system prompt so Claude can reason about actual data.
export function describeRecentSignals(s: RecentSignalSummary): string {
  if (s.days === 0) return 'No wearable/daily-log data available for the last 30 days.';
  const bits: string[] = [];
  if (s.restingHR !== null) bits.push(`resting HR avg ${Math.round(s.restingHR)} bpm (${s.restingHRBelowExpected ? 'below' : 'above'} age-expected)`);
  if (s.hrv !== null) bits.push(`HRV avg ${Math.round(s.hrv)} ms (${s.hrvAboveExpected ? 'above' : 'around/below'} age-expected)`);
  if (s.sleepHours !== null) {
    const cons = s.sleepIsConsistent ? 'consistent' : 'inconsistent';
    bits.push(`sleep avg ${s.sleepHours.toFixed(1)}h (${cons} — σ=${(s.sleepHoursStdev ?? 0).toFixed(1)}h)`);
  }
  if (s.sleepScore !== null) bits.push(`sleep score avg ${Math.round(s.sleepScore)}/100`);
  if (s.steps !== null) bits.push(`steps avg ${Math.round(s.steps)}/day`);
  if (s.activeTimeMin !== null) bits.push(`active time avg ${Math.round(s.activeTimeMin)} min/day`);
  if (s.stress !== null) bits.push(`stress self-report avg ${s.stress.toFixed(1)}/10`);
  if (s.systolic !== null) bits.push(`morning systolic BP avg ${Math.round(s.systolic)} mmHg`);
  if (s.bodyFatPct !== null) bits.push(`body fat avg ${s.bodyFatPct.toFixed(1)}%`);
  if (s.bodyScore !== null) bits.push(`body-score avg ${Math.round(s.bodyScore)}/100`);
  return `Last ${s.days} days of wearable/log data: ${bits.join('; ')}.`;
}
