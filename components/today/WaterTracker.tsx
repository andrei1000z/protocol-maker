'use client';

import { Card } from '@/components/ui/Card';
import { Droplets } from 'lucide-react';
import clsx from 'clsx';

export function WaterTracker({ water, onSetWater }: { water: number; onSetWater: (n: number) => void }) {
  return (
    <Card>
      <div className="flex items-center gap-2 mb-3">
        <Droplets className="w-4 h-4 text-blue-400" />
        <h3 className="text-sm font-medium">Apă</h3>
        <span className="text-xs text-muted-foreground ml-auto">{water}/10 pahare</span>
      </div>
      <div className="grid grid-cols-5 gap-2">
        {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
          <button
            key={n}
            onClick={() => onSetWater(n === water ? n - 1 : n)}
            className={clsx(
              'h-10 rounded-xl text-sm font-medium transition-all active:scale-90',
              n <= water
                ? 'bg-blue-500/30 text-blue-300 border border-blue-500/50'
                : 'bg-card border border-card-border text-muted'
            )}
          >
            {n}
          </button>
        ))}
      </div>
    </Card>
  );
}
