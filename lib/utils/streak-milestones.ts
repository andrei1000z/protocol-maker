// Streak milestones + celebration primitive.
//
// Streak is already computed in lib/utils/streak.ts. What this file adds:
//   1. Canonical milestone list (7 / 14 / 30 / 60 / 100 / 180 / 365 days).
//   2. Per-browser "already celebrated" memory so a user who closed the
//      toast at day 7 doesn't get hit by it again on day 7 after a partial
//      reload.
//   3. Helpers that return the NEXT milestone (for progress bars) and the
//      milestone JUST crossed (for celebration triggering).
//
// Designed to be deterministic + pure — the React side reads state via
// getUncelebratedMilestone(streak, userId) and records it via
// markMilestoneCelebrated(milestone, userId) once the toast closes.

/** The milestone ladder — each entry is a "worth celebrating" streak count
 *  along with the copy we use in the toast. Kept in one place so the UI,
 *  analytics, and any future email drip all see the same definitions. */
export const STREAK_MILESTONES = [
  { days: 3,   label: '3-day start',   blurb: 'Momentum is the whole game. Keep going.' },
  { days: 7,   label: 'One-week streak', blurb: 'A full week. Research says behaviour change clicks here.' },
  { days: 14,  label: 'Two-week streak', blurb: 'Past the novelty phase — this is becoming automatic.' },
  { days: 30,  label: '30-day streak',   blurb: 'Habit-formation threshold cleared. Keep it loose, keep it long.' },
  { days: 60,  label: '60-day streak',   blurb: 'You\'ve held this longer than most people try. Notice what changed.' },
  { days: 100, label: '100 days',        blurb: 'Triple-digit streak. Your body is wearing new defaults now.' },
  { days: 180, label: 'Half-year streak',blurb: 'Six months is the point where identity catches up with action.' },
  { days: 365, label: 'One full year',   blurb: 'A year. The frame you wake up in has changed.' },
] as const;

export type StreakMilestone = (typeof STREAK_MILESTONES)[number];

/** Returns the highest milestone the user has crossed at this streak length,
 *  or null if they're below day 3. */
export function milestoneFor(streak: number): StreakMilestone | null {
  let hit: StreakMilestone | null = null;
  for (const m of STREAK_MILESTONES) {
    if (streak >= m.days) hit = m;
    else break;
  }
  return hit;
}

/** The next milestone the user is working toward. Returns null when they're
 *  already past the top of the ladder (day 365+). */
export function nextMilestone(streak: number): StreakMilestone | null {
  for (const m of STREAK_MILESTONES) {
    if (streak < m.days) return m;
  }
  return null;
}

/** Progress toward the next milestone as a 0-1 fraction. When the user has
 *  cleared the top, returns 1. */
export function progressToNext(streak: number): number {
  const next = nextMilestone(streak);
  if (!next) return 1;
  const prev = milestoneFor(streak);
  const lower = prev ? prev.days : 0;
  const upper = next.days;
  return Math.max(0, Math.min(1, (streak - lower) / (upper - lower)));
}

// ─────────────────────────────────────────────────────────────────────────────
// Celebration-tracking storage
// ─────────────────────────────────────────────────────────────────────────────
// Keyed per-user so multiple users on one browser (family shared device)
// don't cross-contaminate. Stored in localStorage as a CSV of celebrated
// milestone days. Missing entry === never celebrated.

const KEY_PREFIX = 'protocol:streak-celebrated:';

function storageKey(userId: string) {
  return `${KEY_PREFIX}${userId || 'anon'}`;
}

export function getCelebratedSet(userId: string): Set<number> {
  if (typeof localStorage === 'undefined') return new Set();
  try {
    const raw = localStorage.getItem(storageKey(userId));
    if (!raw) return new Set();
    return new Set(raw.split(',').map(s => parseInt(s, 10)).filter(Number.isFinite));
  } catch { return new Set(); }
}

export function markMilestoneCelebrated(days: number, userId: string) {
  if (typeof localStorage === 'undefined') return;
  try {
    const set = getCelebratedSet(userId);
    set.add(days);
    localStorage.setItem(storageKey(userId), [...set].join(','));
  } catch { /* quota exceeded — silently drop, celebration will re-fire later */ }
}

/** Returns the milestone to celebrate right now, or null if the user's
 *  current streak milestone has already been celebrated (or they haven't
 *  crossed one yet). */
export function getUncelebratedMilestone(streak: number, userId: string): StreakMilestone | null {
  const current = milestoneFor(streak);
  if (!current) return null;
  const seen = getCelebratedSet(userId);
  if (seen.has(current.days)) return null;
  return current;
}
