// ============================================================================
// TRACKING INSIGHTS — smart derivations shown on /tracking "Today" tab
// ============================================================================
// Pure functions over the user's recent daily_metrics + compliance history.
// Produces human-readable "callouts" the user actually wants to read:
//   "Your HRV dropped 12ms the past 3 nights — likely the 3am bedtime."
//   "5-day workout streak — keep it going."
//   "You've skipped Magnesium 4/7 evenings."
// ============================================================================

import type { DailyMetrics } from '@/lib/hooks/useDailyMetrics';

export type Tone = 'positive' | 'negative' | 'neutral' | 'attention';

export interface Insight {
  icon: string;          // emoji
  title: string;         // short headline (<60 chars)
  detail?: string;       // optional 1-sentence elaboration
  tone: Tone;
  score: number;         // priority 0-100 — higher = more important
}

interface ComplianceLog {
  item_type: string;
  item_name: string;
  completed: boolean;
  date: string;
}

// ─────────────────────────────────────────────────────────────────────────────

function avg(values: (number | null | undefined)[]): number | null {
  const nums = values.filter((v): v is number => typeof v === 'number' && Number.isFinite(v));
  if (nums.length === 0) return null;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

function num(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

// ─────────────────────────────────────────────────────────────────────────────

export function buildInsights(
  metrics: DailyMetrics[],     // oldest → newest
  compliance: ComplianceLog[], // last 7-14 days
  protocolMeta?: { longevityScore?: number | null; agingPace?: number | null; biologicalAge?: number | null }
): Insight[] {
  const insights: Insight[] = [];

  const last7 = metrics.slice(-7);
  const prev7 = metrics.slice(-14, -7);
  const last3 = metrics.slice(-3);
  const prev3 = metrics.slice(-6, -3);

  // ── Sleep streak / debt ────────────────────────────────────────────────────
  const sleep7 = avg(last7.map(m => m.sleep_hours));
  const sleep14 = avg(metrics.slice(-14).map(m => m.sleep_hours));
  if (sleep7 !== null) {
    if (sleep7 < 6) {
      insights.push({
        icon: '😴', tone: 'attention', score: 85,
        title: `Averaging ${sleep7.toFixed(1)}h sleep last 7 days`,
        detail: '<6h doubles mortality risk long-term. Aim 7-9h this week.',
      });
    } else if (sleep7 >= 7 && sleep7 <= 9) {
      insights.push({
        icon: '✅', tone: 'positive', score: 40,
        title: `${sleep7.toFixed(1)}h sleep — in the optimal band`,
      });
    }
  }
  if (sleep7 !== null && sleep14 !== null && Math.abs(sleep7 - sleep14) >= 1) {
    insights.push({
      icon: sleep7 < sleep14 ? '⬇️' : '⬆️',
      tone: sleep7 < sleep14 ? 'attention' : 'positive',
      score: 65,
      title: `Sleep ${sleep7 < sleep14 ? 'dropped' : 'rose'} to ${sleep7.toFixed(1)}h (was ${sleep14.toFixed(1)}h)`,
    });
  }

  // ── HRV drop / gain ────────────────────────────────────────────────────────
  const hrv3 = avg(last3.map(m => m.hrv_sleep_avg ?? m.hrv));
  const hrvPrev = avg(prev3.map(m => m.hrv_sleep_avg ?? m.hrv));
  if (hrv3 !== null && hrvPrev !== null) {
    const delta = hrv3 - hrvPrev;
    if (delta <= -8) {
      insights.push({
        icon: '🫀', tone: 'attention', score: 80,
        title: `HRV down ${Math.abs(delta).toFixed(0)}ms (${hrvPrev.toFixed(0)} → ${hrv3.toFixed(0)})`,
        detail: 'Suggests stress, sleep debt, or overtraining. Prioritize recovery today.',
      });
    } else if (delta >= 6) {
      insights.push({
        icon: '📈', tone: 'positive', score: 55,
        title: `HRV up ${delta.toFixed(0)}ms — recovery trending well`,
      });
    }
  }

  // ── Resting HR creep ───────────────────────────────────────────────────────
  const rhr3 = avg(last3.map(m => m.resting_hr));
  const rhrPrev = avg(prev3.map(m => m.resting_hr));
  if (rhr3 !== null && rhrPrev !== null && rhr3 - rhrPrev >= 4) {
    insights.push({
      icon: '❤️', tone: 'attention', score: 60,
      title: `Resting HR up ${(rhr3 - rhrPrev).toFixed(0)} bpm over 3 days`,
      detail: 'Usually sleep debt, alcohol, or an incoming bug. Watch it.',
    });
  }

  // ── Steps momentum ─────────────────────────────────────────────────────────
  const steps7 = avg(last7.map(m => m.steps));
  if (steps7 !== null) {
    if (steps7 >= 10000) {
      insights.push({
        icon: '🚶', tone: 'positive', score: 45,
        title: `${Math.round(steps7).toLocaleString()} avg steps/day — crushing it`,
      });
    } else if (steps7 < 3000 && last7.length >= 3) {
      insights.push({
        icon: '🚶', tone: 'attention', score: 55,
        title: `Only ${Math.round(steps7).toLocaleString()} avg steps/day`,
        detail: 'Movement is free medicine. Target 8-10k/day.',
      });
    }
  }

  // ── Mood / energy trend ────────────────────────────────────────────────────
  const mood7 = avg(last7.map(m => m.mood));
  const energy7 = avg(last7.map(m => m.energy));
  const stress7 = avg(last7.map(m => m.stress_level));
  if (mood7 !== null && mood7 <= 4) {
    insights.push({
      icon: '💭', tone: 'attention', score: 70,
      title: `Mood averaging ${mood7.toFixed(1)}/10 this week`,
      detail: 'If sustained, consider talking to someone — and prioritize sunlight + movement.',
    });
  }
  if (energy7 !== null && stress7 !== null && stress7 > 7 && energy7 < 5) {
    insights.push({
      icon: '⚡', tone: 'attention', score: 65,
      title: 'High stress + low energy combo',
      detail: 'Classic burnout signature. Non-negotiables this week: sleep window + 10min outdoor light.',
    });
  }

  // ── Blood pressure flags ───────────────────────────────────────────────────
  const bpSys = avg(last7.map(m => m.bp_systolic_morning));
  if (bpSys !== null) {
    if (bpSys >= 140) {
      insights.push({
        icon: '🩺', tone: 'negative', score: 95,
        title: `Morning BP ${Math.round(bpSys)} mmHg avg — doctor territory`,
        detail: 'Sustained ≥140 systolic warrants medical follow-up.',
      });
    } else if (bpSys >= 130) {
      insights.push({
        icon: '🩺', tone: 'attention', score: 70,
        title: `Morning BP ${Math.round(bpSys)} mmHg avg — borderline`,
        detail: 'Target <120/80. Sodium, alcohol, sleep, stress are top levers.',
      });
    }
  }

  // ── Sleep apnea signal (low blood O2) ──────────────────────────────────────
  const o2 = avg(last7.map(m => m.blood_oxygen_avg_sleep));
  if (o2 !== null && o2 < 93) {
    insights.push({
      icon: '🫁', tone: 'negative', score: 90,
      title: `Blood O₂ during sleep ${o2.toFixed(1)}%`,
      detail: '<93% sustained suggests sleep-disordered breathing. Worth a sleep study.',
    });
  }

  // ── Weight trend ───────────────────────────────────────────────────────────
  const weight3 = avg(last3.map(m => m.weight_kg));
  const weight14 = avg(metrics.slice(-14, -3).map(m => m.weight_kg));
  if (weight3 !== null && weight14 !== null) {
    const delta = weight3 - weight14;
    if (Math.abs(delta) >= 1) {
      insights.push({
        icon: '⚖️',
        tone: 'neutral', score: 30,
        title: `Weight ${delta > 0 ? '+' : ''}${delta.toFixed(1)}kg over 2 weeks`,
      });
    }
  }

  // ── Compliance adherence ───────────────────────────────────────────────────
  if (compliance.length > 0) {
    const total = compliance.length;
    const done = compliance.filter(c => c.completed).length;
    const rate = Math.round((done / total) * 100);
    if (rate >= 85) {
      insights.push({
        icon: '🎯', tone: 'positive', score: 50,
        title: `${rate}% adherence this week — top tier`,
      });
    } else if (rate < 50 && total >= 5) {
      insights.push({
        icon: '🎯', tone: 'attention', score: 70,
        title: `${rate}% adherence this week`,
        detail: 'Pick 1-2 highest-leverage items to nail this week, ignore the rest.',
      });
    }

    // Most missed items
    const missed: Record<string, number> = {};
    compliance.filter(c => !c.completed).forEach(c => {
      const key = `${c.item_type}:${c.item_name}`;
      missed[key] = (missed[key] || 0) + 1;
    });
    const top = Object.entries(missed).sort((a, b) => b[1] - a[1])[0];
    if (top && top[1] >= 3) {
      const [key, count] = top;
      const [, name] = key.split(':');
      insights.push({
        icon: '🔁', tone: 'attention', score: 55,
        title: `Skipped ${name} ${count}× in the last week`,
        detail: 'Habit stacking tip: tie it to something you already do daily.',
      });
    }
  }

  // ── Workout streak ─────────────────────────────────────────────────────────
  let workoutStreak = 0;
  for (let i = metrics.length - 1; i >= 0; i--) {
    if (metrics[i].workout_done) workoutStreak++;
    else break;
  }
  if (workoutStreak >= 3) {
    insights.push({
      icon: '💪', tone: 'positive', score: 55,
      title: `${workoutStreak}-day workout streak`,
    });
  }

  // ── Aging pace commentary ──────────────────────────────────────────────────
  if (protocolMeta?.agingPace !== null && protocolMeta?.agingPace !== undefined) {
    const pace = protocolMeta.agingPace;
    if (pace <= 0.85) {
      insights.push({
        icon: '🧬', tone: 'positive', score: 45,
        title: `Aging pace ${pace.toFixed(2)}× — slower than the clock`,
      });
    } else if (pace >= 1.15) {
      insights.push({
        icon: '🧬', tone: 'attention', score: 70,
        title: `Aging pace ${pace.toFixed(2)}× — accelerated`,
        detail: 'Reversible. Focus: sleep consistency, cardio volume, inflammation.',
      });
    }
  }

  // Sort by priority, cap at 6
  insights.sort((a, b) => b.score - a.score);
  return insights.slice(0, 6);
}

// Calculate workout streak separately for display
export function currentWorkoutStreak(metrics: DailyMetrics[]): number {
  let streak = 0;
  for (let i = metrics.length - 1; i >= 0; i--) {
    if (metrics[i].workout_done) streak++;
    else break;
  }
  return streak;
}

export function loggedDaysInLastN(metrics: DailyMetrics[], n: number): number {
  const cutoff = Date.now() - n * 864e5;
  return metrics.filter(m => new Date(m.date).getTime() >= cutoff).length;
}
