'use client';

import { Card } from '@/components/ui/Card';
import { DailyLog, MacroTargets } from '@/lib/types';
import { taskCompletionPercent, sumMealMacros } from '@/lib/utils';
import { CheckCircle, Flame, Droplets } from 'lucide-react';

export function SummaryCards({ log, macroTargets }: { log: DailyLog; macroTargets: MacroTargets }) {
  const completion = taskCompletionPercent(log);
  const macros = sumMealMacros(log.meals);

  return (
    <div className="grid grid-cols-3 gap-2">
      <Card className="flex flex-col items-center gap-1 p-3">
        <CheckCircle className="w-5 h-5 text-primary" />
        <span className="text-xl font-bold">{completion}%</span>
        <span className="text-[10px] text-muted-foreground">Tasks</span>
      </Card>
      <Card className="flex flex-col items-center gap-1 p-3">
        <Flame className="w-5 h-5 text-warning" />
        <span className="text-xl font-bold">{macros.calories}</span>
        <span className="text-[10px] text-muted-foreground">/ {macroTargets.calories} kcal</span>
      </Card>
      <Card className="flex flex-col items-center gap-1 p-3">
        <Droplets className="w-5 h-5 text-blue-400" />
        <span className="text-xl font-bold">{log.water}</span>
        <span className="text-[10px] text-muted-foreground">/ 10 pahare</span>
      </Card>
    </div>
  );
}
