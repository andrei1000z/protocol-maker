'use client';

import clsx from 'clsx';

interface Tab { id: string; label: string; icon: string; }

export function TabNav({ tabs, active, onChange }: { tabs: Tab[]; active: string; onChange: (id: string) => void }) {
  return (
    <div className="flex gap-1 p-1 rounded-xl bg-card border border-card-border overflow-x-auto">
      {tabs.map(t => (
        <button key={t.id} onClick={() => onChange(t.id)}
          className={clsx('flex-1 whitespace-nowrap py-2 px-3 rounded-lg text-xs font-medium transition-all flex items-center justify-center gap-1.5',
            active === t.id ? 'bg-accent text-black' : 'text-muted-foreground hover:text-foreground')}>
          <span>{t.icon}</span><span>{t.label}</span>
        </button>
      ))}
    </div>
  );
}
