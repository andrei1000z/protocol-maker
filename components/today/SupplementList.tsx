'use client';

import { Card } from '@/components/ui/Card';
import { Toggle } from '@/components/ui/Toggle';
import { Supplement } from '@/lib/types';
import { Pill } from 'lucide-react';

export function SupplementList({
  supplements,
  onToggle,
}: {
  supplements: Supplement[];
  onToggle: (id: string) => void;
}) {
  return (
    <Card>
      <div className="flex items-center gap-2 mb-3">
        <Pill className="w-4 h-4 text-emerald-400" />
        <h3 className="text-sm font-medium">Suplimente</h3>
        <span className="text-xs text-muted-foreground ml-auto">
          {supplements.filter((s) => s.taken).length}/{supplements.length}
        </span>
      </div>
      {supplements.map((sup) => (
        <Toggle
          key={sup.id}
          checked={sup.taken}
          onChange={() => onToggle(sup.id)}
          label={sup.name}
        />
      ))}
    </Card>
  );
}
