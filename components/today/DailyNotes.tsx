'use client';

import { Card } from '@/components/ui/Card';
import { StickyNote } from 'lucide-react';

export function DailyNotes({ notes, onNotesChange }: { notes: string; onNotesChange: (v: string) => void }) {
  return (
    <Card>
      <div className="flex items-center gap-2 mb-3">
        <StickyNote className="w-4 h-4 text-amber-400" />
        <h3 className="text-sm font-medium">Notă zilnică</h3>
      </div>
      <textarea
        value={notes}
        onChange={(e) => onNotesChange(e.target.value)}
        placeholder="Cum a fost ziua ta?"
        rows={3}
        className="w-full bg-background rounded-xl border border-card-border px-4 py-3 text-sm text-foreground placeholder:text-muted outline-none focus:border-primary transition-colors resize-none"
      />
    </Card>
  );
}
