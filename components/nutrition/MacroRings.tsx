'use client';

import { CircularProgress } from '@/components/ui/CircularProgress';
import { MacroTargets } from '@/lib/types';

export function MacroRings({ current, targets }: { current: MacroTargets; targets: MacroTargets }) {
  return (
    <div className="flex justify-around py-2">
      <CircularProgress
        value={current.calories}
        max={targets.calories}
        label="Calorii"
        unit="kcal"
        color="text-warning"
      />
      <CircularProgress
        value={current.protein}
        max={targets.protein}
        label="Proteine"
        unit="g"
        color="text-red-400"
      />
      <CircularProgress
        value={current.carbs}
        max={targets.carbs}
        label="Carbs"
        unit="g"
        color="text-blue-400"
      />
      <CircularProgress
        value={current.fat}
        max={targets.fat}
        label="Grăsimi"
        unit="g"
        color="text-amber-400"
      />
    </div>
  );
}
