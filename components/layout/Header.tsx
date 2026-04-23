'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import clsx from 'clsx';
import { LogOut, Settings, User } from 'lucide-react';
import { useMyData, invalidate } from '@/lib/hooks/useApiData';
import { ThemeToggle } from './ThemeToggle';
import { Avatar } from '@/components/ui/Avatar';

const LINKS = [
  { href: '/dashboard', label: 'Protocol' },
  { href: '/tracking', label: 'Tracking' },
  { href: '/statistics', label: 'Stats' },
  { href: '/chat', label: 'Chat' },
  { href: '/history', label: 'History' },
] as const;

// User menu — avatar dropdown with name + settings + logout
function UserMenu() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const { data: myData } = useMyData();

  useEffect(() => {
    const close = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const od = (myData?.profile?.onboarding_data || {}) as Record<string, unknown>;
  const name = (typeof od.name === 'string' && od.name.trim()) ? od.name.trim() : null;
  // Stable per-user seed for the gradient avatar — uses the profile id
  // so the same user gets the same colours across sessions and devices.
  const avatarSeed = myData?.profile?.id || name || 'anon';

  const handleLogout = async () => {
    await fetch('/api/logout', { method: 'POST' });
    invalidate.all();
    window.location.replace('/login');
  };

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="rounded-xl hover:opacity-80 transition-opacity focus:outline-none focus:ring-2 focus:ring-accent/40"
        aria-label="Account menu"
      >
        <Avatar seed={avatarSeed} name={name} size={36} className="rounded-xl" />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-2 w-56 rounded-xl bg-surface-1 border border-card-border shadow-xl p-1.5 z-50 animate-fade-in-up">
          <div className="px-3 py-2.5 border-b border-card-border mb-1">
            <p className="text-[10px] uppercase tracking-widest text-muted">Signed in</p>
            <p className="text-sm font-medium truncate mt-0.5">{name || 'Your account'}</p>
          </div>
          <Link
            href="/settings"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-surface-2 text-sm transition-colors"
          >
            <Settings className="w-4 h-4 text-muted-foreground" />
            Settings
          </Link>
          <Link
            href="/history"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-surface-2 text-sm transition-colors"
          >
            <User className="w-4 h-4 text-muted-foreground" />
            Protocol history
          </Link>
          <button
            onClick={() => { router.refresh(); setOpen(false); }}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-surface-2 text-sm text-left transition-colors"
          >
            <span className="w-4 h-4 text-muted-foreground flex items-center justify-center text-[10px]">↻</span>
            Refresh data
          </button>
          <div className="my-1 border-t border-card-border" />
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-red-500/10 text-sm text-danger text-left transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Log out
          </button>
        </div>
      )}
    </div>
  );
}

export function Header() {
  const pathname = usePathname();

  return (
    <header
      // --header-h exposes this element's rendered height to any sticky child
      // (dashboard phase labels, tab bars) so `top: var(--header-h)` stays in
      // sync if we ever change padding / notification-bar height / touch targets.
      ref={(el) => {
        if (!el) return;
        const applyHeight = () => document.documentElement.style.setProperty('--header-h', `${el.offsetHeight}px`);
        applyHeight();
        const ro = new ResizeObserver(applyHeight);
        ro.observe(el);
      }}
      className="grid grid-cols-[auto_1fr_auto] items-center gap-2 px-4 sm:px-6 py-2.5 sm:py-3 border-b border-card-border bg-background/70 backdrop-blur-xl sticky top-0 z-40">
      <Link href="/dashboard" className="text-accent font-bold text-base sm:text-lg shrink-0">Protocol</Link>
      <nav className="flex items-center justify-center gap-0.5 sm:gap-1 overflow-x-auto scrollbar-none -mx-1 px-1">
        {LINKS.map(({ href, label }) => {
          const active = pathname === href || pathname.startsWith(href + '/');
          return (
            <Link key={href} href={href}
              className={clsx('px-2.5 sm:px-4 py-1.5 rounded-lg text-[12px] sm:text-sm whitespace-nowrap transition-colors',
                active ? 'bg-accent/10 text-accent' : 'text-muted-foreground hover:text-foreground')}>
              {label}
            </Link>
          );
        })}
      </nav>
      <div className="flex items-center gap-2">
        <ThemeToggle />
        {/* Cmd+K hint — desktop only. Pressing dispatches a fake hotkey event
            so users without keyboards can still trigger the palette. */}
        <button
          onClick={() => {
            window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true }));
            window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true }));
          }}
          aria-label="Open command palette"
          className="hidden md:inline-flex items-center gap-1.5 px-2 py-1 rounded-lg border border-card-border bg-surface-2 text-[10px] font-mono text-muted-foreground hover:text-foreground hover:border-accent/30 transition-colors"
          title="Command palette"
        >
          <kbd>⌘K</kbd>
        </button>
        <UserMenu />
      </div>
    </header>
  );
}
