export interface MacroTargets {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

export interface UserProfile {
  name: string;
  age: number;
  sex: 'M' | 'F';
  height: number;
  weight: number;
  goals: string[];
  fitnessLevel: 'beginner' | 'intermediate' | 'advanced';
  macroTargets: MacroTargets;
  onboardingCompleted: boolean;
}

export interface Task {
  id: string;
  name: string;
  category: string;
  done: boolean;
}

export interface Supplement {
  id: string;
  name: string;
  taken: boolean;
}

export interface Meal {
  id: string;
  name: string;
  cal: number;
  protein: number;
  carbs: number;
  fat: number;
}

export interface DailyLog {
  date: string;
  tasks: Task[];
  supplements: Supplement[];
  meals: Meal[];
  water: number;
  mood: number;
  energy: number;
  focus: number;
  notes: string;
  watchMetrics: Record<string, number>;
  weight?: number;
}

export interface GeneratedProtocol {
  macroTargets: MacroTargets;
  dailyTasks: { name: string; category: string }[];
  supplements: { name: string; dose: string; timing: string }[];
  tips: string[];
  warnings: string[];
  summary: string;
}

export interface QuickMeal {
  name: string;
  cal: number;
  protein: number;
  carbs: number;
  fat: number;
}

export type SupplementCategory = 'essential' | 'recommended' | 'optional' | 'advanced';

export interface SupplementInfo {
  name: string;
  description: string;
  dose: string;
  timing: string;
  category: SupplementCategory;
  ageRestriction?: number;
}

export interface WatchMetric {
  id: string;
  name: string;
  unit: string;
  target: number;
  min: number;
  max: number;
  group: 'sleep' | 'cardio' | 'activity' | 'wellness';
}
