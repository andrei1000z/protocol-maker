export interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string;
  tier: 'bronze' | 'silver' | 'gold' | 'legendary';
  check: (stats: UserStats) => boolean;
}

export interface UserStats {
  totalDaysTracked: number;
  currentStreak: number;
  longestStreak: number;
  perfectDays: number;
  bloodTestsUploaded: number;
  protocolsGenerated: number;
  supplementStreak: number;
  weeklyCompliance: number;
  monthlyAvgCompliance: number;
  // New signals — meal logging, workouts, wearable connections, biomarker
  // movement, and plain longevity. All optional so old call sites still work.
  mealsLogged?: number;
  workoutsLogged?: number;
  wearablesConnected?: number;
  biologicalAgeImproved?: boolean;   // bio age dropped vs first protocol
  longevityScoreImproved?: boolean;  // score went up vs first protocol
  daysSinceSignup?: number;
  patternsResolved?: number;         // count of patterns that disappeared since first protocol
  mealsLoggedDays?: number;          // distinct days with at least one meal logged
}

export const ACHIEVEMENTS: Achievement[] = [
  // Streaks
  { id: 'streak_3', name: 'Starting Strong', description: '3 day streak', icon: '🔥', tier: 'bronze', check: s => s.currentStreak >= 3 },
  { id: 'streak_7', name: 'Week Warrior', description: '7 day streak', icon: '🔥', tier: 'silver', check: s => s.currentStreak >= 7 },
  { id: 'streak_30', name: 'Lifestyle Lock', description: '30 day streak', icon: '🏆', tier: 'gold', check: s => s.currentStreak >= 30 },
  { id: 'streak_100', name: 'Centurion', description: '100 day streak', icon: '👑', tier: 'legendary', check: s => s.currentStreak >= 100 },

  // Compliance
  { id: 'perfect_day', name: 'Perfect Day', description: '100% compliance in 1 day', icon: '✨', tier: 'bronze', check: s => s.perfectDays >= 1 },
  { id: 'perfect_week', name: 'Perfect Week', description: '100% compliance for 7 days', icon: '⭐', tier: 'gold', check: s => s.perfectDays >= 7 },
  { id: 'perfect_month', name: 'Optimizer', description: '90%+ monthly compliance', icon: '💎', tier: 'gold', check: s => s.monthlyAvgCompliance >= 90 },

  // Blood Tests
  { id: 'first_panel', name: 'First Steps', description: 'First blood panel uploaded', icon: '🩸', tier: 'bronze', check: s => s.bloodTestsUploaded >= 1 },
  { id: 'lab_rat', name: 'Lab Rat', description: '3+ blood panels tracked', icon: '🧪', tier: 'silver', check: s => s.bloodTestsUploaded >= 3 },
  { id: 'quantified', name: 'Quantified Self', description: '5+ blood panels tracked', icon: '📊', tier: 'gold', check: s => s.bloodTestsUploaded >= 5 },

  // Protocols
  { id: 'first_protocol', name: 'Protocol Pioneer', description: 'First protocol generated', icon: '🧬', tier: 'bronze', check: s => s.protocolsGenerated >= 1 },
  { id: 'iterator', name: 'Iterator', description: '3+ protocols generated', icon: '🔄', tier: 'silver', check: s => s.protocolsGenerated >= 3 },

  // Supplement consistency
  { id: 'sup_streak_7', name: 'Supplement Squad', description: 'All supplements 7 days', icon: '💊', tier: 'silver', check: s => s.supplementStreak >= 7 },
  { id: 'sup_streak_30', name: 'Stack Master', description: 'All supplements 30 days', icon: '💊', tier: 'gold', check: s => s.supplementStreak >= 30 },

  // Meal logging — surfaces the "you actually fed your AI" milestone
  { id: 'first_meal',     name: 'First Bite',       description: 'Logged your first meal',           icon: '🍽',  tier: 'bronze',    check: s => (s.mealsLogged ?? 0) >= 1 },
  { id: 'meal_week',      name: 'Week of Meals',    description: 'Logged meals 7 distinct days',      icon: '🥗',  tier: 'silver',    check: s => (s.mealsLoggedDays ?? 0) >= 7 },
  { id: 'meal_month',     name: 'Plate Planner',    description: 'Logged meals 30 distinct days',     icon: '🍱',  tier: 'gold',      check: s => (s.mealsLoggedDays ?? 0) >= 30 },

  // Workouts — pairs with the new WorkoutLogger preset library
  { id: 'first_workout',  name: 'In Motion',        description: 'Logged your first workout',         icon: '🏋️', tier: 'bronze',    check: s => (s.workoutsLogged ?? 0) >= 1 },
  { id: 'workout_10',     name: 'Ten Sessions',     description: '10 workouts logged',                icon: '💪',  tier: 'silver',    check: s => (s.workoutsLogged ?? 0) >= 10 },
  { id: 'workout_50',     name: 'Iron Discipline',  description: '50 workouts logged',                icon: '🏆',  tier: 'gold',      check: s => (s.workoutsLogged ?? 0) >= 50 },

  // Wearables — celebrate the moment a user goes from manual logging to passive sync
  { id: 'wearable_one',   name: 'Wired In',         description: 'Connected your first wearable',     icon: '⌚', tier: 'bronze',    check: s => (s.wearablesConnected ?? 0) >= 1 },
  { id: 'wearable_two',   name: 'Quantified Stack', description: 'Two wearables syncing',             icon: '📡', tier: 'silver',    check: s => (s.wearablesConnected ?? 0) >= 2 },

  // Outcomes — the "this actually worked" badges. Hidden until earned.
  { id: 'bio_age_drop',   name: 'Reverse Aging',    description: 'Bio age dropped since your first protocol', icon: '⏪', tier: 'gold',     check: s => !!s.biologicalAgeImproved },
  { id: 'score_up',       name: 'Trend Up',         description: 'Longevity score above your first generation', icon: '📈', tier: 'silver',  check: s => !!s.longevityScoreImproved },
  { id: 'pattern_clear',  name: 'Cluster Cleared',  description: 'Resolved a clinical pattern since first lab', icon: '✅', tier: 'gold',     check: s => (s.patternsResolved ?? 0) >= 1 },

  // Tenure — purely time-based, but worth marking
  { id: 'thirty_days',    name: 'First Month',      description: '30 days on the platform',           icon: '🗓',  tier: 'bronze',    check: s => (s.daysSinceSignup ?? 0) >= 30 },
  { id: 'six_months',     name: 'Half Year In',     description: '180 days on the platform',          icon: '📆',  tier: 'silver',    check: s => (s.daysSinceSignup ?? 0) >= 180 },
  { id: 'one_year',       name: 'Anniversary',      description: 'A full year of practice',           icon: '🎂',  tier: 'legendary', check: s => (s.daysSinceSignup ?? 0) >= 365 },
];

export function checkAchievements(stats: UserStats): Achievement[] {
  return ACHIEVEMENTS.filter(a => a.check(stats));
}

export function getNextAchievement(stats: UserStats): Achievement | null {
  const earned = new Set(checkAchievements(stats).map(a => a.id));
  return ACHIEVEMENTS.find(a => !earned.has(a.id)) || null;
}
