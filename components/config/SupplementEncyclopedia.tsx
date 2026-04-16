'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { SUPPLEMENTS, SUPPLEMENT_CATEGORY_COLORS } from '@/lib/constants';
import { BookOpen, ChevronDown, ChevronUp, AlertTriangle } from 'lucide-react';
import clsx from 'clsx';

export function SupplementEncyclopedia() {
  const [expanded, setExpanded] = useState<string | null>(null);

  return (
    <Card>
      <div className="flex items-center gap-2 mb-4">
        <BookOpen className="w-4 h-4 text-emerald-400" />
        <h3 className="text-sm font-medium">Enciclopedie Suplimente</h3>
      </div>

      <div className="space-y-2">
        {SUPPLEMENTS.map((sup) => {
          const cat = SUPPLEMENT_CATEGORY_COLORS[sup.category];
          const isOpen = expanded === sup.name;
          return (
            <div key={sup.name} className="rounded-xl border border-card-border overflow-hidden">
              <button
                onClick={() => setExpanded(isOpen ? null : sup.name)}
                className="w-full flex items-center justify-between p-3 text-left active:bg-card-border/50 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{sup.name}</span>
                  <Badge className={clsx(cat.bg, cat.text)}>{cat.label}</Badge>
                </div>
                {isOpen ? <ChevronUp className="w-4 h-4 text-muted" /> : <ChevronDown className="w-4 h-4 text-muted" />}
              </button>
              {isOpen && (
                <div className="px-3 pb-3 space-y-2 text-sm">
                  <p className="text-muted-foreground">{sup.description}</p>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="bg-background rounded-lg p-2">
                      <span className="text-muted">Doză</span>
                      <p className="font-medium mt-0.5">{sup.dose}</p>
                    </div>
                    <div className="bg-background rounded-lg p-2">
                      <span className="text-muted">Timing</span>
                      <p className="font-medium mt-0.5">{sup.timing}</p>
                    </div>
                  </div>
                  {sup.ageRestriction && (
                    <div className="flex items-center gap-1.5 text-xs text-warning">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      <span>Recomandat doar peste {sup.ageRestriction} ani</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}
