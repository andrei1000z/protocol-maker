export interface DailyHabit {
  id: string;
  name: string;
  icon: string;
  category: string;
  description: string;
}

export const DAILY_HABITS: DailyHabit[] = [
  { id: 'steps', name: '8,000+ steps', icon: '🚶', category: 'Movement', description: 'Strongest single predictor of mortality' },
  { id: 'sunlight', name: 'Morning sunlight 10+ min', icon: '☀️', category: 'Circadian', description: 'Anchors circadian rhythm, boosts alertness' },
  { id: 'hydration', name: '2L+ water', icon: '💧', category: 'Nutrition', description: 'Dehydration impairs cognition and raises cortisol' },
  { id: 'strength', name: 'Strength training', icon: '🏋️', category: 'Movement', description: 'Prevents sarcopenia — 20% mortality reduction' },
  { id: 'zone2', name: 'Zone 2 cardio 30+ min', icon: '🚴', category: 'Movement', description: 'Builds mitochondrial health' },
  { id: 'no_alcohol', name: 'No alcohol today', icon: '🚫', category: 'Substances', description: 'No safe dose for longevity' },
  { id: 'meditation', name: 'Meditation / breathwork', icon: '🧘', category: 'Mindset', description: '10 min lowers cortisol 25%' },
  { id: 'stretch', name: 'Mobility / stretching', icon: '🤸', category: 'Movement', description: 'Reduces injury risk, improves recovery' },
  { id: 'floss', name: 'Floss', icon: '🦷', category: 'Hygiene', description: 'Gum disease → CV disease & Alzheimers' },
  { id: 'cold_shower', name: 'Cold shower / exposure', icon: '🧊', category: 'Recovery', description: 'Raises norepinephrine 2-3x, builds resilience' },
  { id: 'read', name: 'Read 20+ min', icon: '📖', category: 'Mindset', description: 'Reduces stress, maintains cognition' },
  { id: 'journal', name: 'Journal / gratitude', icon: '📝', category: 'Mindset', description: 'Proven to reduce anxiety and improve sleep' },
  { id: 'no_screens_bed', name: 'No screens 1h before bed', icon: '📵', category: 'Sleep', description: 'Blue light delays melatonin by 90 min' },
  { id: 'fasted_16h', name: '16h fast', icon: '⏰', category: 'Nutrition', description: 'Triggers autophagy, improves insulin sensitivity' },
];

export function getHabitsByCategory(): Record<string, DailyHabit[]> {
  return DAILY_HABITS.reduce<Record<string, DailyHabit[]>>((acc, h) => {
    (acc[h.category] = acc[h.category] || []).push(h);
    return acc;
  }, {});
}
