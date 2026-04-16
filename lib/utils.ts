import { DailyLog, MacroTargets, Meal } from './types';

export function calculateBMI(weight: number, heightCm: number): number {
  const heightM = heightCm / 100;
  return Math.round((weight / (heightM * heightM)) * 10) / 10;
}

export function getBMICategory(bmi: number): string {
  if (bmi < 18.5) return 'Subponderal';
  if (bmi < 25) return 'Normal';
  if (bmi < 30) return 'Supraponderal';
  return 'Obez';
}

export function getTodayKey(): string {
  return new Date().toISOString().split('T')[0];
}

export function getDateKey(date: Date): string {
  return date.toISOString().split('T')[0];
}

export function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('ro-RO', { weekday: 'short', day: 'numeric', month: 'short' });
}

export function getDaysAgo(days: number): string[] {
  const dates: string[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    dates.push(getDateKey(d));
  }
  return dates;
}

export function sumMealMacros(meals: Meal[]): MacroTargets {
  return meals.reduce(
    (acc, m) => ({
      calories: acc.calories + m.cal,
      protein: acc.protein + m.protein,
      carbs: acc.carbs + m.carbs,
      fat: acc.fat + m.fat,
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 }
  );
}

export function taskCompletionPercent(log: DailyLog): number {
  const total = log.tasks.length + log.supplements.length;
  if (total === 0) return 0;
  const done = log.tasks.filter((t) => t.done).length + log.supplements.filter((s) => s.taken).length;
  return Math.round((done / total) * 100);
}

export function generateId(): string {
  return crypto.randomUUID();
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function getMetricColor(value: number, target: number, isLowerBetter = false): string {
  const ratio = isLowerBetter ? target / value : value / target;
  if (ratio >= 0.9) return 'text-emerald-400';
  if (ratio >= 0.7) return 'text-amber-400';
  return 'text-red-400';
}

export function getMetricStatus(value: number, target: number, isLowerBetter = false): string {
  const ratio = isLowerBetter ? target / value : value / target;
  if (ratio >= 0.9) return 'Excelent';
  if (ratio >= 0.7) return 'OK';
  return 'Sub target';
}
