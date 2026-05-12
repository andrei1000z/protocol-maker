'use client';

import { Printer } from 'lucide-react';

export default function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="inline-flex items-center gap-2 text-xs px-3 py-1.5 rounded-lg bg-surface-2 border border-card-border text-muted-foreground hover:text-foreground hover:border-accent/30 transition-colors"
    >
      <Printer className="w-3.5 h-3.5" />
      Imprimă
    </button>
  );
}
