'use client';

// Three-button theme picker — system / light / dark.
//
// Reads/writes via lib/theme.ts so the storage key + boot logic stay in
// one place. Subscribes to OS color-scheme changes so a user on `system`
// who flips their OS at night sees the app follow without a refresh.

import { useEffect, useState } from 'react';
import { Monitor, Moon, Sun } from 'lucide-react';
import clsx from 'clsx';
import { getThemeMode, setThemeMode, watchSystemTheme, type ThemeMode } from '@/lib/theme';

const OPTIONS: Array<{ id: ThemeMode; label: string; hint: string; icon: React.ElementType }> = [
  { id: 'system', label: 'System',     hint: 'Match my OS preference', icon: Monitor },
  { id: 'light',  label: 'Light',      hint: 'Bright surfaces',         icon: Sun },
  { id: 'dark',   label: 'Dark',       hint: 'Default — easy on eyes',  icon: Moon },
];

export function ThemePicker() {
  // mounted gate — without it the first render uses the SSR default
  // ('system') which can briefly diverge from the boot script's choice
  // and flash the wrong active state. Reading getThemeMode() in an effect
  // syncs us to the real value once we're in the browser.
  const [mounted, setMounted] = useState(false);
  const [mode, setMode] = useState<ThemeMode>('system');

  useEffect(() => {
    setMode(getThemeMode());
    setMounted(true);
    return watchSystemTheme();
  }, []);

  const pick = (next: ThemeMode) => {
    setMode(next);
    setThemeMode(next);
  };

  return (
    <div className="glass-card rounded-2xl p-5 space-y-3 animate-fade-in-up">
      <div>
        <p className="text-sm font-semibold">Theme</p>
        <p className="text-[11px] text-muted-foreground leading-relaxed mt-0.5">
          Default is dark. System follows your OS appearance setting.
        </p>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {OPTIONS.map(opt => {
          const Icon = opt.icon;
          const active = mounted && opt.id === mode;
          return (
            <button
              key={opt.id}
              onClick={() => pick(opt.id)}
              aria-pressed={active}
              className={clsx(
                'flex flex-col items-center gap-1.5 p-3 rounded-xl border transition-all text-center',
                active
                  ? 'bg-accent/10 border-accent/40 text-accent'
                  : 'bg-surface-2 border-card-border text-muted-foreground hover:text-foreground hover:border-card-border-hover',
              )}
            >
              <Icon className="w-5 h-5" />
              <span className="text-xs font-semibold">{opt.label}</span>
              <span className="text-[10px] text-muted leading-tight">{opt.hint}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
