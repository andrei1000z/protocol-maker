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
 *  analytics, and any future email drip all see the same definitions.
 *  Copy is intentionally non-shaming and process-focused (not outcome-
 *  focused), aligned with the F12 brief — no guilt, no pressure. */
export const STREAK_MILESTONES = [
  { days: 3,   label: 'Început de 3 zile',  blurb: 'Bravo. Primele trei zile sunt cele mai grele — restul vine mai ușor.' },
  { days: 7,   label: 'O săptămână întreagă', blurb: 'Șapte zile. Cercetările arată că aici începe schimbarea reală.' },
  { days: 14,  label: 'Două săptămâni',     blurb: 'Ai trecut de etapa de noutate — acum e ceva natural.' },
  { days: 30,  label: '30 de zile',          blurb: 'Pragul formării obiceiului. Continuă ușor, nu te grăbi.' },
  { days: 60,  label: '60 de zile',          blurb: 'Ai dus-o mai departe decât majoritatea. Observă ce s-a schimbat.' },
  { days: 100, label: '100 de zile',         blurb: 'Trei cifre. Corpul tău are deja noi obiceiuri de bază.' },
  { days: 180, label: 'Jumătate de an',      blurb: 'Șase luni — momentul în care identitatea prinde din urmă acțiunea.' },
  { days: 365, label: 'Un an întreg',        blurb: 'Un an. Lumea în care te trezești dimineața s-a schimbat.' },
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
