'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import clsx from 'clsx';

const LINKS = [
  { href: '/dashboard', label: 'Protocol' },
  { href: '/tracking', label: 'Tracking' },
  { href: '/chat', label: 'Chat' },
  { href: '/history', label: 'History' },
  { href: '/settings', label: 'Settings' },
];

export function Header() {
  const pathname = usePathname();

  return (
    <header className="flex items-center justify-between gap-2 px-4 sm:px-6 py-2.5 sm:py-3 border-b border-card-border bg-background/70 backdrop-blur-xl sticky top-0 z-40">
      <Link href="/dashboard" className="text-accent font-bold text-base sm:text-lg shrink-0">Protocol</Link>
      <nav className="flex items-center gap-0.5 sm:gap-1 overflow-x-auto scrollbar-none -mx-1 px-1">
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
      <div className="hidden md:block w-20" />
    </header>
  );
}
