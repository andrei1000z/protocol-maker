'use client';

import { Card } from '@/components/ui/Card';
import { QUICK_MEALS } from '@/lib/constants';
import { Meal } from '@/lib/types';
import { Zap } from 'lucide-react';

export function QuickAddGrid({ onAdd }: { onAdd: (meal: Omit<Meal, 'id'>) => void }) {
  return (
    <Card>
      <div className="flex items-center gap-2 mb-3">
        <Zap className="w-4 h-4 text-warning" />
        <h3 className="text-sm font-medium">Quick Add</h3>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {QUICK_MEALS.map((meal) => (
          <button
            key={meal.name}
            onClick={() => onAdd(meal)}
            className="p-2.5 rounded-xl bg-background border border-card-border text-left active:scale-95 transition-transform"
          >
            <p className="text-xs font-medium truncate">{meal.name}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              {meal.cal}cal &middot; {meal.protein}P &middot; {meal.carbs}C &middot; {meal.fat}F
            </p>
          </button>
        ))}
      </div>
    </Card>
  );
}
