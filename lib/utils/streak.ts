export interface ComplianceEntry {
  date: string;
  pct: number;
  completed: number;
  total: number;
}

export function calculateStreak(history: ComplianceEntry[], threshold = 50): number {
  if (history.length === 0) return 0;

  const byDate = new Map(history.map(h => [h.date, h]));
  const today = new Date();
  let streak = 0;

  const todayStr = today.toISOString().split('T')[0];
  if (!byDate.has(todayStr)) {
    today.setDate(today.getDate() - 1);
  }

  for (let i = 0; i < 365; i++) {
    const dateStr = today.toISOString().split('T')[0];
    const entry = byDate.get(dateStr);
    if (!entry || entry.pct < threshold) break;
    streak++;
    today.setDate(today.getDate() - 1);
  }

  return streak;
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
