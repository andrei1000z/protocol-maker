// Today's Agenda — single timeline of everything the user has scheduled
// or pending today: supplements (by time bucket), workouts, sleep targets,
// meal logging windows, retest reminders.
//
// Pure function — takes already-loaded protocol JSON + meals + compliance
// + retest list. The dashboard widget that consumes it just renders the
// returned items.

import { bucketSupplements, currentSupplementBucket, type SupplementLike, type SupplementBucket } from './supplement-timing';

export type AgendaCategory = 'supplement' | 'workout' | 'sleep' | 'meal' | 'retest' | 'mindset';
export type AgendaStatus = 'overdue' | 'now' | 'upcoming' | 'done';

export interface AgendaItem {
  id: string;
  category: AgendaCategory;
  title: string;
  detail?: string;
  /** Time-of-day bucket — drives chronological ordering. */
  bucket: SupplementBucket;
  /** Display hint used by the UI to show "due now" / "in 2h" / "earlier today". */
  status: AgendaStatus;
  /** Optional link target — e.g. /tracking#sleep or /dashboard#supplements. */
  href?: string;
  /** True when this is something the user has already done today. */
  done?: boolean;
}

interface AgendaInput {
  protocolJson: Record<string, unknown> | null | undefined;
  /** Today's meals — used to dim the "log meal" hints once the user logged for that bucket. */
  todayMealCount?: { morning: number; midday: number; evening: number };
  /** Workout already done today (from daily_metrics.workout_done). */
  workoutDoneToday?: boolean;
  /** Sleep logged for last night (from daily_metrics.sleep_hours for today's row). */
  sleepLoggedToday?: boolean;
  /** Top retest-due markers from biomarker-trends.computeRetestDue. */
  retestDue?: Array<{ shortName: string; weeksOverdue: number }>;
  /** Override "now" for tests. */
  nowHour?: number;
}

const BUCKET_ORDER: SupplementBucket[] = ['morning', 'midday', 'evening', 'bedtime', 'anytime'];

/** Build a flat, time-ordered list of agenda items for "today". */
export function buildAgenda(input: AgendaInput): AgendaItem[] {
  const items: AgendaItem[] = [];
  const nowHour = input.nowHour ?? new Date().getHours();
  const currentBucket = currentSupplementBucket(nowHour);

  // ── Supplements grouped by time bucket. Skip 'anytime' from the agenda
  //    timeline (those don't have a slot — they live in the supplements
  //    section as a fallback bucket).
  const protocol = (input.protocolJson ?? {}) as { supplements?: SupplementLike[] };
  const grouped = bucketSupplements(protocol.supplements);
  for (const bucket of BUCKET_ORDER) {
    if (bucket === 'anytime') continue;
    const sups = grouped[bucket];
    if (!sups || sups.length === 0) continue;
    items.push({
      id: `sup-${bucket}`,
      category: 'supplement',
      title: `${sups.length} supplement${sups.length === 1 ? '' : 's'}`,
      detail: sups.slice(0, 4).map(s => s.name).filter(Boolean).join(' · '),
      bucket,
      status: statusForBucket(bucket, currentBucket),
      href: '/dashboard#supplements',
    });
  }

  // ── Sleep target (if the protocol has one). Render as a "tonight" item
  //    in the bedtime bucket. Marks as done when sleep was logged today.
  const sleep = (protocol as Record<string, unknown>).sleep as { targetBedtime?: string; targetHours?: number } | undefined;
  if (sleep?.targetBedtime || sleep?.targetHours) {
    items.push({
      id: 'sleep-target',
      category: 'sleep',
      title: 'Wind down',
      detail: [
        sleep.targetBedtime ? `Bedtime ${sleep.targetBedtime}` : null,
        sleep.targetHours ? `${sleep.targetHours}h target` : null,
      ].filter(Boolean).join(' · '),
      bucket: 'bedtime',
      status: input.sleepLoggedToday ? 'done' : statusForBucket('bedtime', currentBucket),
      href: '/tracking',
      done: !!input.sleepLoggedToday,
    });
  }

  // ── Workout — render once for the day, in the midday bucket as a
  //    universal "do it sometime" reminder. The detail names what kind
  //    of session is on the calendar.
  const exercise = (protocol as Record<string, unknown>).exercise as { strengthSessionsPerWeek?: number; cardioMinutesPerWeek?: number } | undefined;
  if (exercise && (exercise.strengthSessionsPerWeek || exercise.cardioMinutesPerWeek)) {
    const parts: string[] = [];
    if (exercise.strengthSessionsPerWeek) parts.push(`${exercise.strengthSessionsPerWeek}× strength/wk`);
    if (exercise.cardioMinutesPerWeek)    parts.push(`${exercise.cardioMinutesPerWeek}min cardio/wk`);
    items.push({
      id: 'workout',
      category: 'workout',
      title: input.workoutDoneToday ? 'Workout logged ✓' : 'Move today',
      detail: parts.join(' · '),
      bucket: 'midday',
      status: input.workoutDoneToday ? 'done' : statusForBucket('midday', currentBucket),
      href: '/tracking',
      done: !!input.workoutDoneToday,
    });
  }

  // ── Meal logging hints — only surface a hint for buckets the user
  //    HASN'T logged a meal in yet. No nag if they've already eaten.
  const meals = input.todayMealCount;
  if (meals) {
    if (meals.morning === 0 && (currentBucket === 'morning' || currentBucket === 'midday' || currentBucket === 'evening' || currentBucket === 'bedtime')) {
      items.push({
        id: 'meal-morning',
        category: 'meal',
        title: 'Log breakfast',
        detail: 'Snap a photo so today\'s macros count.',
        bucket: 'morning',
        status: statusForBucket('morning', currentBucket),
        href: '/dashboard',
      });
    }
    if (meals.midday === 0 && (currentBucket === 'midday' || currentBucket === 'evening' || currentBucket === 'bedtime')) {
      items.push({
        id: 'meal-midday',
        category: 'meal',
        title: 'Log lunch',
        detail: 'Two clicks. Feeds your next regen.',
        bucket: 'midday',
        status: statusForBucket('midday', currentBucket),
        href: '/dashboard',
      });
    }
    if (meals.evening === 0 && (currentBucket === 'evening' || currentBucket === 'bedtime')) {
      items.push({
        id: 'meal-evening',
        category: 'meal',
        title: 'Log dinner',
        detail: 'Last meal of the day.',
        bucket: 'evening',
        status: statusForBucket('evening', currentBucket),
        href: '/dashboard',
      });
    }
  }

  // ── Retest reminders — render at most ONE in the morning bucket so
  //    we don't pile retest cards on top of the timeline.
  if (input.retestDue && input.retestDue.length > 0) {
    const top = input.retestDue[0];
    items.push({
      id: 'retest-' + top.shortName,
      category: 'retest',
      title: `Order ${top.shortName} retest`,
      detail: `${top.weeksOverdue}w overdue. Book a lab.`,
      bucket: 'morning',
      status: 'overdue',
      href: '/dashboard#biomarkers',
    });
  }

  // Sort: overdue first, then by bucket order, then by category for stability.
  return items.sort((a, b) => {
    if (a.status === 'overdue' && b.status !== 'overdue') return -1;
    if (b.status === 'overdue' && a.status !== 'overdue') return 1;
    const ai = BUCKET_ORDER.indexOf(a.bucket);
    const bi = BUCKET_ORDER.indexOf(b.bucket);
    if (ai !== bi) return ai - bi;
    return a.category.localeCompare(b.category);
  });
}

function statusForBucket(bucket: SupplementBucket, currentBucket: SupplementBucket): AgendaStatus {
  const order = BUCKET_ORDER.indexOf(bucket);
  const cur = BUCKET_ORDER.indexOf(currentBucket);
  if (order < cur) return 'overdue';
  if (order === cur) return 'now';
  return 'upcoming';
}

/** Fast summary for the dashboard widget header — counts of pending vs done items. */
export function summarizeAgenda(items: AgendaItem[]): { pending: number; done: number; overdue: number } {
  return items.reduce(
    (acc, it) => {
      if (it.done) acc.done++;
      else if (it.status === 'overdue') acc.overdue++;
      else acc.pending++;
      return acc;
    },
    { pending: 0, done: 0, overdue: 0 },
  );
}
