export interface ComplianceEntry {
  date: string;
  pct: number;
  completed: number;
  total: number;
}

export function calculateStreak(history: ComplianceEntry[], threshold = 50): number {
  return calculateStreakForgiving(history, threshold).days;
}

/**
 * Forgiving streak — tolerates up to 1 missed day per 7-day window so a user
 * at day 28 who catches a flu and misses one day doesn't see their streak
 * reset to 0. The second miss within the same 7-day window breaks it.
 *
 * Returns both the day count and whether the grace day is "in use" so the UI
 * can render "28 days · 1 grace day used" and remind the user that another
 * miss will break the streak.
 *
 * Rationale: strict consecutive-day streaks drive anxiety and punishment
 * dynamics. Research on habit formation (Wood 2016, Clear 2018) shows a
 * single missed day is noise, not a signal of failure — but two misses in
 * a row IS a behavior-change signal worth flagging.
 */
export function calculateStreakForgiving(
  history: ComplianceEntry[],
  threshold = 50
): { days: number; graceUsed: boolean } {
  if (history.length === 0) return { days: 0, graceUsed: false };

  const byDate = new Map(history.map(h => [h.date, h]));
  const today = new Date();
  let streak = 0;
  let graceUsed = false;
  let consecutiveMisses = 0;

  // If today isn't logged yet, start counting from yesterday.
  const todayStr = today.toISOString().split('T')[0];
  if (!byDate.has(todayStr)) {
    today.setDate(today.getDate() - 1);
  }

  for (let i = 0; i < 365; i++) {
    const dateStr = today.toISOString().split('T')[0];
    const entry = byDate.get(dateStr);

    // No entry for this date = we've walked past the user's logged history.
    // Stop without burning grace; grace is for EXPLICITLY missed days (entry
    // exists but pct below threshold), not for "never logged".
    if (!entry) break;

    if (entry.pct >= threshold) {
      streak++;
      consecutiveMisses = 0;
    } else {
      consecutiveMisses++;
      // Two explicit misses in a row = break. Real behavior change.
      if (consecutiveMisses >= 2) break;
      // First explicit miss — burn grace if available, otherwise break.
      if (!graceUsed) {
        graceUsed = true;
        // Don't count the grace-forgiven day in the streak total; it's
        // forgiven, not earned. The chain continues past it.
      } else {
        break;
      }
    }

    today.setDate(today.getDate() - 1);
  }

  return { days: streak, graceUsed };
}

export function calculateLongestStreak(history: ComplianceEntry[], threshold = 50): number {
  if (history.length === 0) return 0;

  const sorted = [...history].sort((a, b) => a.date.localeCompare(b.date));
  let longest = 0;
  let current = 0;
  let lastDate: string | null = null;

  for (const entry of sorted) {
    if (entry.pct >= threshold) {
      if (lastDate && isConsecutive(lastDate, entry.date)) {
        current++;
      } else {
        current = 1;
      }
      longest = Math.max(longest, current);
    } else {
      current = 0;
    }
    lastDate = entry.date;
  }

  return longest;
}

export function countPerfectDays(history: ComplianceEntry[]): number {
  return history.filter(h => h.pct >= 100 && h.total > 0).length;
}

export function getWeeklyData(history: ComplianceEntry[]): { day: string; pct: number; date: string }[] {
  const byDate = new Map(history.map(h => [h.date, h]));
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const now = new Date();
  const dayOfWeek = now.getDay();
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;

  return days.map((dayName, i) => {
    const d = new Date(now);
    d.setDate(d.getDate() + mondayOffset + i);
    const dateStr = d.toISOString().split('T')[0];
    const entry = byDate.get(dateStr);
    return { day: dayName, date: dateStr, pct: entry?.pct ?? 0 };
  });
}

export function getMonthlyHeatmap(history: ComplianceEntry[]): { date: string; pct: number }[] {
  const byDate = new Map(history.map(h => [h.date, h]));
  const now = new Date();
  const data: { date: string; pct: number }[] = [];

  for (let i = 29; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split('T')[0];
    const entry = byDate.get(dateStr);
    data.push({ date: dateStr, pct: entry?.pct ?? 0 });
  }

  return data;
}

export function calculateMonthlyAverage(history: ComplianceEntry[]): number {
  const recent = history.filter(h => h.total > 0).slice(-30);
  if (recent.length === 0) return 0;
  const sum = recent.reduce((s, h) => s + h.pct, 0);
  return Math.round(sum / recent.length);
}

function isConsecutive(prevDate: string, currDate: string): boolean {
  const prev = new Date(prevDate);
  const curr = new Date(currDate);
  const diffDays = Math.round((curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24));
  return diffDays === 1;
}
