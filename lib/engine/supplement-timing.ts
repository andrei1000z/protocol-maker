// Group supplements by time-of-day bucket.
//
// Used on the dashboard + tracking to render a "Take now" surface that
// only shows items whose timing matches the user's current window.
//
// Heuristic: AI-generated supplements carry a free-form `timing` string
// ("morning with food", "2g TID", "30 min before bed"). We parse that into
// four canonical buckets so the UI can group them. Ambiguous entries land
// in 'anytime' so users still see them somewhere.

export type SupplementBucket = 'morning' | 'midday' | 'evening' | 'bedtime' | 'anytime';

export interface SupplementLike {
  name?: string;
  dose?: string;
  timing?: string;
  priority?: string;
}

export interface BucketedSupplement extends SupplementLike {
  bucket: SupplementBucket;
}

/** Normalize a free-form timing string to one of five buckets. */
export function classifySupplementTiming(timing: string | undefined | null): SupplementBucket {
  if (!timing) return 'anytime';
  const t = timing.toLowerCase();

  // Explicit hour patterns win first. "at 07:00", "7am", "around 22:00".
  const hourMatch = t.match(/\b(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/);
  if (hourMatch) {
    let h = parseInt(hourMatch[1], 10);
    const ampm = hourMatch[3];
    if (ampm === 'pm' && h < 12) h += 12;
    if (ampm === 'am' && h === 12) h = 0;
    if (h >= 4 && h < 11) return 'morning';
    if (h >= 11 && h < 15) return 'midday';
    if (h >= 15 && h < 21) return 'evening';
    return 'bedtime';
  }

  // Explicit keywords.
  if (/\b(bed ?time|before bed|night|sleep|nocturn|before sleep)\b/.test(t)) return 'bedtime';
  if (/\b(morning|am|wake|breakfast|sunrise|first thing|upon waking)\b/.test(t)) return 'morning';
  if (/\b(lunch|noon|midday|pre.workout|pre.training|with lunch)\b/.test(t)) return 'midday';
  if (/\b(evening|dinner|pm|post.workout|afternoon|after work)\b/.test(t)) return 'evening';

  // Frequency patterns without anchor (e.g. "2x daily"). Spread BID/TID into
  // morning/evening-ish; leave QID/ac sed to "anytime" since the specific
  // slots aren't inferable from timing alone.
  if (/\b(bid|twice daily|2x.?daily|2x.?a.?day)\b/.test(t)) return 'morning'; // split handled by caller
  if (/\b(daily|once daily|qd|every day)\b/.test(t)) return 'morning';

  return 'anytime';
}

/** Group supplements by bucket. Keeps input order stable within each bucket
 *  so the protocol's priority ordering (MUST → STRONG → OPTIONAL) survives. */
export function bucketSupplements<T extends SupplementLike>(
  supplements: readonly T[] | null | undefined,
): Record<SupplementBucket, (T & { bucket: SupplementBucket })[]> {
  const out: Record<SupplementBucket, (T & { bucket: SupplementBucket })[]> = {
    morning: [], midday: [], evening: [], bedtime: [], anytime: [],
  };
  if (!supplements) return out;
  for (const s of supplements) {
    const bucket = classifySupplementTiming(s.timing);
    out[bucket].push({ ...s, bucket });
  }
  return out;
}

/** Name the bucket that matches the current hour. Used to pre-select the
 *  "relevant now" tab on the dashboard supplements section. */
export function currentSupplementBucket(hour: number): SupplementBucket {
  if (hour >= 4 && hour < 11) return 'morning';
  if (hour >= 11 && hour < 15) return 'midday';
  if (hour >= 15 && hour < 21) return 'evening';
  return 'bedtime';
}

export const BUCKET_LABELS: Record<SupplementBucket, { title: string; emoji: string; hint: string }> = {
  morning: { title: 'Morning',  emoji: '🌅', hint: 'On waking · with breakfast' },
  midday:  { title: 'Midday',   emoji: '🌞', hint: 'Lunch · pre-workout' },
  evening: { title: 'Evening',  emoji: '🌇', hint: 'Dinner · post-workout' },
  bedtime: { title: 'Bedtime',  emoji: '🌙', hint: 'Before sleep' },
  anytime: { title: 'Any time', emoji: '⏱',  hint: 'No specific timing' },
};
