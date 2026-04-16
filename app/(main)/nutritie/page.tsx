'use client';

import { useDailyLog } from '@/lib/hooks/useDailyLog';
import { MacroRings } from '@/components/nutrition/MacroRings';
import { QuickAddGrid } from '@/components/nutrition/QuickAddGrid';
import { ManualMealForm } from '@/components/nutrition/ManualMealForm';
import { MealLog } from '@/components/nutrition/MealLog';
import { DEFAULT_MACRO_TARGETS } from '@/lib/constants';
import { sumMealMacros } from '@/lib/utils';

export default function NutritiePage() {
  const { log, profile, hydrated, addMeal, removeMeal } = useDailyLog();

  if (!hydrated || !log) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const targets = profile?.macroTargets || DEFAULT_MACRO_TARGETS;
  const current = sumMealMacros(log.meals);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">Nutriție</h1>
      <MacroRings current={current} targets={targets} />
      <MealLog meals={log.meals} onRemove={removeMeal} />
      <QuickAddGrid onAdd={addMeal} />
      <ManualMealForm onAdd={addMeal} />
    </div>
  );
}
