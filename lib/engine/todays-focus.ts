// Picks the single highest-leverage action for the current moment from a
// user's protocol. The dashboard surfaces this at the top so returning
// users see a clear "do this one thing now" instead of scrolling through
// the whole daily schedule.
//
// Logic: fetch all dailySchedule entries, filter to the current time
// window + a small buffer, then rank by priority (MUST > STRONG > normal
// category > others). Keep top 2 to avoid decision fatigue.

// Matches the live ProtocolOutput.dailySchedule row shape. All fields are
// optional-ish because user-uploaded / legacy protocols may be missing some.
export interface ScheduleEntry {
  time: string;                    // "HH:MM" or "HH:MM - HH:MM" block
  activity?: string;               // canonical field ("Take Vitamin D")
  category?: string;
  duration?: string;
  notes?: string;
  isBlock?: boolean;
  anchorRef?: string;              // supplement name this links back to
  priority?: string;               // 'MUST' | 'STRONG' | 'CONSIDER' | 'OPTIONAL'
  // Legacy / alternative field names from older AI outputs.
  label?: string;
  mechanism?: string;
  title?: string;
  description?: string;
}

export interface FocusPick {
  time: string;
  title: string;
  category?: string;
  mechanism?: string;
  urgency: 'now' | 'soon' | 'upcoming';   // visual lane
  minutesUntil: number;                    // negative if already past
}

function parseHM(hm: string): number | null {
  const m = (hm || '').match(/^(\d{1,2}):(\d{2})/);
  if (!m) return null;
  const hh = parseInt(m[1], 10);
  const mm = parseInt(m[2], 10);
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return null;
  return hh * 60 + mm;
}

const PRIORITY_RANK: Record<string, number> = {
  MUST: 0,
  STRONG: 1,
  CONSIDER: 2,
  OPTIONAL: 3,
};
// Categories we consider "high leverage" regardless of explicit priority —
// work anchors, supplements, workouts. Hydration / snacks fall below.
const CATEGORY_PRIORITY: Record<string, number> = {
  supplements: 0,
  exercise: 1,
  meal: 2,
  sleep: 0,         // wind-down at night is the #1 lever
  'wind-down': 0,
  mindset: 1,
  'movement-break': 3,
  hydration: 3,
  snack: 3,
};

/**
 * Pick top-N focus entries for `nowHHMM` (default: current wall time).
 * Returns [] if no protocol schedule supplied. Side-effect-free.
 */
export function pickTodaysFocus(
  schedule: ScheduleEntry[] | null | undefined,
  nowHHMM: string = new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
  limit: number = 2,
): FocusPick[] {
  if (!Array.isArray(schedule) || schedule.length === 0) return [];
  const nowMin = parseHM(nowHHMM);
  if (nowMin === null) return [];

  const enriched = schedule
    .map(e => {
      const timeMin = parseHM(e.time);
      if (timeMin === null) return null;
      const delta = timeMin - nowMin;          // positive = future, negative = past
      return { e, timeMin, delta };
    })
    .filter((x): x is { e: ScheduleEntry; timeMin: number; delta: number } => x !== null);

  // Candidate window: within 2h past (you probably still want it) or 3h future.
  const inWindow = enriched.filter(x => x.delta >= -120 && x.delta <= 180);
  // Fallback — if nothing in window (user opened at 3 AM), surface the next
  // upcoming few entries so the block isn't empty.
  const candidates = inWindow.length > 0
    ? inWindow
    : enriched.filter(x => x.delta > 0).sort((a, b) => a.delta - b.delta).slice(0, 4);

  const ranked = [...candidates].sort((a, b) => {
    const aPrio = PRIORITY_RANK[a.e.priority?.toUpperCase() || ''] ?? 4;
    const bPrio = PRIORITY_RANK[b.e.priority?.toUpperCase() || ''] ?? 4;
    if (aPrio !== bPrio) return aPrio - bPrio;
    const aCat = CATEGORY_PRIORITY[a.e.category || ''] ?? 5;
    const bCat = CATEGORY_PRIORITY[b.e.category || ''] ?? 5;
    if (aCat !== bCat) return aCat - bCat;
    // Tiebreak: soonest first.
    return Math.abs(a.delta) - Math.abs(b.delta);
  });

  return ranked.slice(0, limit).map(x => {
    const urgency: FocusPick['urgency'] =
      x.delta <= 0 ? 'now' :
      x.delta <= 30 ? 'soon' :
      'upcoming';
    return {
      time: x.e.time,
      title: x.e.activity || x.e.title || x.e.label || x.e.mechanism || 'Protocol action',
      category: x.e.category,
      mechanism: x.e.mechanism || x.e.notes,
      urgency,
      minutesUntil: x.delta,
    };
  });
}
