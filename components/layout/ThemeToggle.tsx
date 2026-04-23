'use client';

// Compact theme toggle in the header — cycles through system → light →
// dark on each click. The full picker lives in /settings; this is the
// "I want to flip the theme right now" affordance.

import { useEffect, useState } from 'react';
import { Monitor, Moon, Sun } from 'lucide-react';
import { getThemeMode, setThemeMode, watchSystemTheme, type ThemeMode } from '@/lib/theme';

const NEXT: Record<ThemeMode, ThemeMode> = { system: 'light', light: 'dark', dark: 'system' };

export function ThemeToggle() {
  const [mounted, setMounted] = useState(false);
  const [mode, setMode] = useState<ThemeMode>('system');

  useEffect(() => {
    setMode(getThemeMode());
    setMounted(true);
    return watchSystemTheme();
  }, []);

  if (!mounted) {
    // Reserve the layout but don't render any specific icon until we know
    // the real mode — prevents flash of wrong icon on hydration.
    return <div className="w-9 h-9 rounded-lg" />;
  }

  const cycle = () => {
    const next = NEXT[mode];
    setMode(next);
    setThemeMode(next);
  };

  const Icon = mode === 'light' ? Sun : mode === 'dark' ? Moon : Monitor;
  return (
    <button
      onClick={cycle}
      aria-label={`Theme: ${mode}. Click to cycle.`}
      title={`Theme: ${mode} · click to switch`}
      className="hidden sm:inline-flex items-center justify-center w-9 h-9 rounded-lg border border-card-border bg-surface-2 text-muted-foreground hover:text-foreground hover:border-card-border-hover transition-colors"
    >
      <Icon className="w-4 h-4" />
    </button>
  );
}
