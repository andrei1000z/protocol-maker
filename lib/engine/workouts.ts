// Exercise library + quick-pick workouts.
//
// Used by the dashboard WorkoutPlanner — renders a small set of preset
// sessions the user can one-tap log without writing each exercise out.
//
// Library is intentionally small (15 sessions) — covers the 80/20 of what
// people actually do at home or a basic gym, and each one maps cleanly to
// a workout_minutes + workout_intensity write on daily_metrics.

export type WorkoutCategory = 'strength' | 'cardio' | 'mobility' | 'mixed' | 'walk';
export type WorkoutIntensity = 'light' | 'moderate' | 'hard' | 'max';

export interface WorkoutPreset {
  id: string;
  title: string;
  category: WorkoutCategory;
  intensity: WorkoutIntensity;
  /** Minutes the average user spends on a session of this preset. */
  durationMin: number;
  /** Plain-English description shown beneath the title. */
  description: string;
  /** Tags surfaced as tiny chips — useful for filtering later. */
  tags: string[];
  /** Optional list of suggested exercises — populates the "what's in this
   *  session" expand. Not authoritative, just a starting point. */
  exercises?: string[];
}

export const WORKOUT_PRESETS: WorkoutPreset[] = [
  {
    id: 'walk-30',
    title: 'Brisk walk',
    category: 'walk',
    intensity: 'light',
    durationMin: 30,
    description: '30 minutes outside, conversational pace. Cheapest longevity intervention there is.',
    tags: ['outdoor', 'zone-1'],
  },
  {
    id: 'zone2-45',
    title: 'Zone 2 cardio',
    category: 'cardio',
    intensity: 'moderate',
    durationMin: 45,
    description: 'Steady aerobic work — bike, jog, rower. Heart rate at the top of nose-only breathing.',
    tags: ['mitochondria', 'aerobic'],
  },
  {
    id: 'zone2-60',
    title: 'Long zone 2',
    category: 'cardio',
    intensity: 'moderate',
    durationMin: 60,
    description: 'Hour at conversational pace — the Attia favorite. Drives mitochondrial density.',
    tags: ['endurance', 'aerobic'],
  },
  {
    id: 'hiit-20',
    title: 'HIIT — 20 min',
    category: 'cardio',
    intensity: 'hard',
    durationMin: 20,
    description: '8 rounds of 20s all-out / 10s rest, repeat 2-3 sets. Sweaty.',
    tags: ['vo2max', 'short'],
    exercises: ['Burpees', 'Mountain climbers', 'Jumping squats', 'Bike sprints'],
  },
  {
    id: 'vo2-norwegian',
    title: 'Norwegian 4×4',
    category: 'cardio',
    intensity: 'max',
    durationMin: 40,
    description: '10min warm-up · 4×4min @ 90-95% max HR (3min recovery) · cool-down. Best VO2 max protocol.',
    tags: ['vo2max', 'cardio-elite'],
  },
  {
    id: 'push-day',
    title: 'Push day',
    category: 'strength',
    intensity: 'hard',
    durationMin: 50,
    description: 'Chest + shoulders + triceps. 5 working sets per major muscle, 6-12 reps.',
    tags: ['hypertrophy', 'gym'],
    exercises: ['Bench press', 'Overhead press', 'Incline DB press', 'Triceps pushdown', 'Lateral raise'],
  },
  {
    id: 'pull-day',
    title: 'Pull day',
    category: 'strength',
    intensity: 'hard',
    durationMin: 50,
    description: 'Back + biceps. Pull-ups, rows, hinges. Builds the posterior chain that desks ruin.',
    tags: ['hypertrophy', 'gym'],
    exercises: ['Pull-ups', 'Barbell row', 'Lat pulldown', 'Face pulls', 'Hammer curl'],
  },
  {
    id: 'leg-day',
    title: 'Leg day',
    category: 'strength',
    intensity: 'hard',
    durationMin: 60,
    description: 'Squat + hinge + accessory. Heaviest day; hardest to skip; biggest longevity payoff.',
    tags: ['hypertrophy', 'gym'],
    exercises: ['Back squat', 'Romanian deadlift', 'Leg press', 'Leg curl', 'Calf raise'],
  },
  {
    id: 'full-body-home',
    title: 'Full-body bodyweight',
    category: 'strength',
    intensity: 'moderate',
    durationMin: 30,
    description: 'No-equipment home circuit. 3 rounds of push-ups + squats + rows + plank.',
    tags: ['home', 'no-gym'],
    exercises: ['Push-ups', 'Bodyweight squats', 'Inverted rows', 'Plank 60s', 'Lunges'],
  },
  {
    id: 'kettlebell-30',
    title: 'Kettlebell complex',
    category: 'mixed',
    intensity: 'hard',
    durationMin: 30,
    description: 'Single kettlebell, 5 rounds: swings + goblet squat + clean + press + row.',
    tags: ['home', 'metabolic'],
    exercises: ['KB swings', 'Goblet squats', 'Clean + press', 'Bent-over row', 'Halos'],
  },
  {
    id: 'mobility-15',
    title: 'Mobility flow',
    category: 'mobility',
    intensity: 'light',
    durationMin: 15,
    description: 'Hip openers + thoracic rotations + ankle dorsiflexion. Counters the desk.',
    tags: ['recovery', 'morning'],
    exercises: ['Couch stretch', '90/90 hip', 'Cat-cow', 'World\'s greatest stretch', 'Ankle rocks'],
  },
  {
    id: 'yoga-flow',
    title: 'Yoga flow',
    category: 'mobility',
    intensity: 'light',
    durationMin: 30,
    description: 'Vinyasa-style flow. Breathing + mobility + nervous-system reset.',
    tags: ['recovery', 'evening'],
  },
  {
    id: 'sprint-intervals',
    title: 'Sprint intervals',
    category: 'cardio',
    intensity: 'max',
    durationMin: 25,
    description: '6×30-second sprints with 90s walk recovery. Quick, brutal, effective.',
    tags: ['vo2max', 'outdoor'],
  },
  {
    id: 'recovery-walk',
    title: 'Recovery walk',
    category: 'walk',
    intensity: 'light',
    durationMin: 20,
    description: 'After-meal walk — drops post-prandial glucose 20-30% on average.',
    tags: ['glucose', 'post-meal'],
  },
  {
    id: 'bike-commute',
    title: 'Bike commute',
    category: 'cardio',
    intensity: 'moderate',
    durationMin: 40,
    description: 'Real-world cardio — replace a car trip with a bike one when you can.',
    tags: ['outdoor', 'commute'],
  },
];

/** Pick a preset by id. Returns undefined when missing — callers handle. */
export function getWorkoutPreset(id: string): WorkoutPreset | undefined {
  return WORKOUT_PRESETS.find(w => w.id === id);
}

/** Suggest 3-6 presets the user is likely to log next, given their
 *  protocol's exercise plan. Heuristic, not magic — biases toward the
 *  category the user has the most weekly volume in. */
export function suggestWorkouts(opts: {
  strengthSessionsPerWeek?: number;
  cardioMinutesPerWeek?: number;
  hasGym?: boolean;
}): WorkoutPreset[] {
  const wantsStrength = (opts.strengthSessionsPerWeek ?? 0) >= 2;
  const wantsCardio = (opts.cardioMinutesPerWeek ?? 0) >= 60;
  const hasGym = opts.hasGym ?? false;

  const out: WorkoutPreset[] = [];
  // Always-present quick wins.
  out.push(getWorkoutPreset('walk-30')!);
  out.push(getWorkoutPreset('mobility-15')!);

  if (wantsStrength) {
    if (hasGym) {
      out.push(getWorkoutPreset('push-day')!);
      out.push(getWorkoutPreset('pull-day')!);
      out.push(getWorkoutPreset('leg-day')!);
    } else {
      out.push(getWorkoutPreset('full-body-home')!);
      out.push(getWorkoutPreset('kettlebell-30')!);
    }
  }
  if (wantsCardio) {
    out.push(getWorkoutPreset('zone2-45')!);
    out.push(getWorkoutPreset('hiit-20')!);
  }
  // Cap at 6 to keep the picker scannable.
  return out.slice(0, 6);
}

/** Convert intensity string to the Borg-like RPE band shown to the user. */
export function intensityRpe(intensity: WorkoutIntensity): string {
  return ({
    light:    'RPE 3-4 (easy)',
    moderate: 'RPE 5-6 (working)',
    hard:     'RPE 7-8 (tough)',
    max:      'RPE 9-10 (max effort)',
  })[intensity];
}
