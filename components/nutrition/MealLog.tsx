'use client';

import { Card } from '@/components/ui/Card';
import { Meal } from '@/lib/types';
import { Trash2, UtensilsCrossed } from 'lucide-react';

export function MealLog({ meals, onRemove }: { meals: Meal[]; onRemove: (id: string) => void }) {
  if (meals.length === 0) {
    return (
      <Card className="flex flex-col items-center py-6 text-muted-foreground">
        <UtensilsCrossed className="w-8 h-8 mb-2 opacity-50" />
        <p className="text-sm">Nicio masă adăugată</p>
      </Card>
    );
  }

  return (
    <Card>
      <h3 className="text-sm font-medium mb-3">Mese azi</h3>
      <div className="space-y-2">
        {meals.map((meal) => (
          <div key={meal.id} className="flex items-center justify-between py-2 border-b border-card-border last:border-0">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium truncate">{meal.name}</p>
              <p className="text-xs text-muted-foreground">
                {meal.cal}cal &middot; {meal.protein}P &middot; {meal.carbs}C &middot; {meal.fat}F
              </p>
            </div>
            <button
              onClick={() => onRemove(meal.id)}
              className="p-2 text-muted hover:text-danger transition-colors active:scale-90"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>
    </Card>
  );
}
