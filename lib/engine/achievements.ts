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
];

export function checkAchievements(stats: UserStats): Achievement[] {
  return ACHIEVEMENTS.filter(a => a.check(stats));
}

export function getNextAchievement(stats: UserStats): Achievement | null {
  const earned = new Set(checkAchievements(stats).map(a => a.id));
  return ACHIEVEMENTS.find(a => !earned.has(a.id)) || null;
}
