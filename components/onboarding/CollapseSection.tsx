'use client';

// Disclosure section with header + chevron toggle. Wraps children so the
// onboarding step can show/hide groups (sleep, diet, supplements, etc.)
// without losing their internal state.

import { ChevronDown, ChevronUp } from 'lucide-react';

export interface CollapseSectionProps {
  title: string;
  expanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}

export function CollapseSection({ title, expanded, onToggle, children }: CollapseSectionProps) {
  return (
    <div className="rounded-2xl bg-card border border-card-border overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-card-hover transition-colors"
      >
        <span className="text-sm font-semibold">{title}</span>
        {expanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
      </button>
      {expanded && (
        <div className="px-4 pb-4 space-y-3">
          {children}
        </div>
      )}
    </div>
  );
}
