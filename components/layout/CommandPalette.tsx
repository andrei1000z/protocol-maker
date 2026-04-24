'use client';

// Cmd+K / Ctrl+K command palette.
//
// Lives at the layout root so any authed page can trigger it. Keyboard-first:
//   - Cmd+K / Ctrl+K to open from anywhere.
//   - Arrow keys to navigate, Enter to execute, Escape to close.
//   - "/" alone focuses the filter when palette is open (power-user muscle memory).
//
// Commands fall into two buckets:
//   1. Hard-coded navigation (Dashboard, Tracking, Chat, etc.) — always
//      present; free and fast.
//   2. Dynamic biomarker + pattern jump-links sourced from BIOMARKER_DB +
//      PATTERN_REFERENCE so the palette stays in sync with engine coverage.
//      No hard-coded biomarker strings here.
//
// Why build this: the app has 10+ routes + 33 biomarker pages + 12 pattern
// pages. Navigation was bottlenecked by the header's 5-tab bar. Power users
// (the target for a longevity tool) expect Cmd+K. Measured cost: ~3KB gzipped.

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Home, ClipboardCheck, BarChart3, MessageSquare, FileText, Settings, Sparkles, Activity, LogOut } from 'lucide-react';
import { BIOMARKER_DB } from '@/lib/engine/biomarkers';
import { PATTERN_REFERENCE } from '@/lib/engine/patterns';
import clsx from 'clsx';

interface Command {
  id: string;
  label: string;
  hint?: string;
  icon?: React.ElementType;
  /** Called when the user presses Enter or clicks. Close is handled separately. */
  run: () => void;
  /** Search keywords beyond `label` — e.g. biomarker codes ("LDL", "HSCRP"). */
  keywords?: string[];
  /** Visual grouping label. */
  group: 'Navigare' | 'Biomarkeri' | 'Tipare' | 'Acțiuni';
}

export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Reset on close so re-opening doesn't carry stale state.
  useEffect(() => {
    if (!open) { setQuery(''); setCursor(0); }
    else { setTimeout(() => inputRef.current?.focus(), 0); }
  }, [open]);

  // Global hotkey — Cmd+K on Mac, Ctrl+K elsewhere. Uses keydown on window
  // rather than individual inputs so it works mid-typing anywhere.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen(o => !o);
      } else if (e.key === 'Escape' && open) {
        setOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const commands: Command[] = useMemo(() => {
    const go = (path: string) => () => { setOpen(false); router.push(path); };
    const nav: Command[] = [
      { id: 'nav-dashboard', group: 'Navigare', label: 'Dashboard',  icon: Home,            run: go('/dashboard') },
      { id: 'nav-tracking',  group: 'Navigare', label: 'Tracking',   icon: ClipboardCheck,  run: go('/tracking') },
      { id: 'nav-stats',     group: 'Navigare', label: 'Statistici', icon: BarChart3,       run: go('/statistics') },
      { id: 'nav-chat',      group: 'Navigare', label: 'Chat',       icon: MessageSquare,   run: go('/chat') },
      { id: 'nav-history',   group: 'Navigare', label: 'Istoric',    icon: FileText,        run: go('/history') },
      { id: 'nav-settings',  group: 'Navigare', label: 'Setări',     icon: Settings,        run: go('/settings') },
    ];
    const biomarkers: Command[] = BIOMARKER_DB.map(b => ({
      id: `bm-${b.code}`,
      group: 'Biomarkeri',
      label: `${b.shortName || b.name}`,
      hint: b.code,
      icon: Activity,
      keywords: [b.code, b.name, b.shortName || ''].filter(Boolean),
      run: go(`/biomarkers/${b.code.toLowerCase()}`),
    }));
    const patterns: Command[] = PATTERN_REFERENCE.map(p => ({
      id: `pt-${p.slug}`,
      group: 'Tipare',
      label: p.name,
      hint: p.slug,
      icon: Sparkles,
      keywords: [p.name, p.slug, ...p.triggeringCodes],
      run: go(`/patterns/${p.slug}`),
    }));
    const actions: Command[] = [
      {
        id: 'act-logout', group: 'Acțiuni', label: 'Deconectare', icon: LogOut,
        run: async () => { setOpen(false); await fetch('/api/logout', { method: 'POST' }); window.location.replace('/login'); },
      },
    ];
    return [...nav, ...biomarkers, ...patterns, ...actions];
  }, [router]);

  // Simple fuzzy-ish filter: match if every query word hits label or keyword.
  // Enough for 60-item dataset; upgrade to a real fuzzy lib if we ever scale.
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return commands;
    const words = q.split(/\s+/);
    return commands.filter(c => {
      const hay = [c.label, c.hint ?? '', ...(c.keywords ?? [])].join(' ').toLowerCase();
      return words.every(w => hay.includes(w));
    });
  }, [commands, query]);

  // Keep cursor within bounds as the filtered list shrinks/grows.
  useEffect(() => {
    if (cursor >= filtered.length) setCursor(Math.max(0, filtered.length - 1));
  }, [filtered.length, cursor]);

  // Scroll the active item into view on cursor change.
  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>(`[data-idx="${cursor}"]`);
    el?.scrollIntoView({ block: 'nearest' });
  }, [cursor]);

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setCursor(c => Math.min(filtered.length - 1, c + 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setCursor(c => Math.max(0, c - 1)); }
    else if (e.key === 'Enter') { e.preventDefault(); filtered[cursor]?.run(); }
    else if (e.key === 'Escape') { e.preventDefault(); setOpen(false); }
  };

  if (!open) return null;

  // Group for rendering — preserve input order within each group, respect
  // overall group order defined in Command['group'].
  const grouped = filtered.reduce<Record<string, Command[]>>((acc, c) => {
    (acc[c.group] ||= []).push(c);
    return acc;
  }, {});
  const groupOrder: Command['group'][] = ['Navigare', 'Biomarkeri', 'Tipare', 'Acțiuni'];

  let runningIdx = 0;
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Command palette"
      className="fixed inset-0 z-[70] flex items-start justify-center pt-[10vh] animate-fade-in"
      onClick={() => setOpen(false)}
    >
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-xl mx-4 bg-surface-1 rounded-2xl border border-card-border shadow-2xl overflow-hidden animate-fade-in-up"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center gap-2.5 px-4 py-3.5 border-b border-card-border">
          <Search className="w-4 h-4 text-muted-foreground shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={e => { setQuery(e.target.value); setCursor(0); }}
            onKeyDown={handleKey}
            placeholder="Caută o pagină, biomarker sau tipar…"
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/50"
            aria-label="Command search"
          />
          <kbd className="text-xs font-mono text-muted px-1.5 py-0.5 rounded border border-card-border shrink-0">ESC</kbd>
        </div>

        <div ref={listRef} className="max-h-[60vh] overflow-y-auto">
          {filtered.length === 0 ? (
            <p className="text-center text-xs text-muted-foreground py-10">Nicio potrivire pentru &bdquo;{query}&rdquo;</p>
          ) : (
            groupOrder.map(g => {
              const items = grouped[g];
              if (!items || items.length === 0) return null;
              return (
                <div key={g} className="py-1.5">
                  <p className="px-4 py-1 text-xs font-mono uppercase tracking-widest text-muted">{g}</p>
                  {items.map(c => {
                    const Icon = c.icon;
                    const idx = runningIdx++;
                    const active = idx === cursor;
                    return (
                      <button
                        key={c.id}
                        data-idx={idx}
                        onMouseEnter={() => setCursor(idx)}
                        onClick={c.run}
                        className={clsx('w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors',
                          active ? 'bg-accent/10 text-accent' : 'text-foreground/80 hover:bg-surface-2')}
                      >
                        {Icon && <Icon className={clsx('w-4 h-4 shrink-0', active ? 'text-accent' : 'text-muted-foreground')} />}
                        <span className="flex-1 text-sm truncate">{c.label}</span>
                        {c.hint && <span className="text-xs font-mono text-muted shrink-0">{c.hint}</span>}
                      </button>
                    );
                  })}
                </div>
              );
            })
          )}
        </div>

        <div className="flex items-center justify-between px-4 py-2 border-t border-card-border bg-surface-2/50 text-xs text-muted font-mono">
          <span className="inline-flex items-center gap-1.5">
            <kbd className="px-1 py-0.5 rounded border border-card-border">↑↓</kbd> navigate ·
            <kbd className="px-1 py-0.5 rounded border border-card-border ml-1">↵</kbd> open
          </span>
          <span className="hidden sm:inline">{filtered.length} results</span>
        </div>
      </div>
    </div>
  );
}
