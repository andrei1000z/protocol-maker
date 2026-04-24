// Metric catalog — one-line metadata per daily_metrics column. Used by the
// tracking UI (SmartLogSheet) to highlight the fields that actually feed the
// longevity score + biological-age calculation, so users at 10 pm decide
// which of the 30 open inputs to fill vs skip.
//
// "Critical" here means:
//   1. The wearable-refinement engine uses it to adjust bio age / pace.
//   2. Missing values force the engine to fall back to cohort averages
//      (losing precision).
//   3. Daily coverage of this field changes the confidence tier
//      (lib/engine/wearable-refinement.ts).

/**
 * Critical metric keys — cross-bucket. Any of these, when logged regularly,
 * meaningfully improves the quality of the nightly protocol regen. Ordered
 * by descending signal value so the UI can cap at "top N".
 */
export const CRITICAL_METRIC_KEYS: readonly string[] = [
  'weight_kg',          // bio age + pace (body composition trend)
  'sleep_hours',        // single strongest daily longevity signal
  'resting_hr',         // cardiovascular fitness proxy
  'hrv_sleep_avg',      // stress load + recovery; biggest mover on the pace score
  'sleep_score',        // overnight quality composite (wearable-derived)
  'sleep_quality',      // self-reported sleep quality (fallback when no wearable)
  'steps',              // activity volume
  'stress_level',       // mental-health + cortisol proxy
] as const;

export type CriticalMetricKey = (typeof CRITICAL_METRIC_KEYS)[number];

/**
 * Per-bucket critical field lists — a subset of CRITICAL_METRIC_KEYS filtered
 * to those that are actually reachable (by time-of-day) within that bucket.
 * Returning the fields in order of importance lets the UI render them with
 * a "*" or ✨ prefix in order.
 */
export const CRITICAL_FIELDS_BY_BUCKET: Record<'morning' | 'midday' | 'evening' | 'night', readonly string[]> = {
  morning: ['weight_kg', 'sleep_hours', 'resting_hr', 'hrv_sleep_avg', 'sleep_score', 'sleep_quality'],
  midday:  ['steps', 'stress_level'],
  evening: ['steps', 'stress_level'],
  night:   ['sleep_quality', 'stress_level'],
};

export function isCriticalField(key: string): boolean {
  return (CRITICAL_METRIC_KEYS as readonly string[]).includes(key);
}
