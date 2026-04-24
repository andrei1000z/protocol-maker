'use client';

// Mobile bottom navigation — sticky 5-icon strip below 640px.
//
// Native-app feel for the most common routes. Pairs with the existing
// header (which keeps the brand mark + ⌘K + theme toggle + user menu);
// on small screens the header tabs collapse to give the bottom nav
// primary navigation duties.
//
// Sized for thumb reach on a one-handed grip + iOS safe-area inset for
// bottom-edge pixels.

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import clsx from 'clsx';
import { Home, ClipboardCheck, BarChart3, MessageSquare, Settings } from 'lucide-react';

const TABS = [
  { href: '/dashboard',  icon: Home,            label: 'Home' },
  { href: '/tracking',   icon: ClipboardCheck,  label: 'Track' },
  { href: '/statistics', icon: BarChart3,       label: 'Stats' },
  { href: '/chat',       icon: MessageSquare,   label: 'Chat' },
  { href: '/settings',   icon: Settings,        label: 'You' },
];

export function MobileBottomNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Primary"
      className="sm:hidden fixed bottom-0 inset-x-0 z-40 bg-background/95 backdrop-blur-xl border-t border-card-border"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      <ul className="grid grid-cols-5">
        {TABS.map(({ href, icon: Icon, label }) => {
          const active = pathname === href || pathname.startsWith(href + '/');
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? 'page' : undefined}
                className={clsx(
                  'flex flex-col items-center gap-0.5 py-2.5 transition-colors',
                  active ? 'text-accent' : 'text-muted-foreground active:text-foreground',
                )}
              >
                <Icon className="w-5 h-5" />
                <span className="text-xs font-medium leading-none">{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
