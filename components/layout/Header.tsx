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
    <header className="hidden md:flex items-center justify-between px-6 py-3 border-b border-card-border bg-black/50 backdrop-blur-xl sticky top-0 z-40">
      <Link href="/dashboard" className="text-accent font-bold text-lg">Protocol</Link>
      <nav className="flex items-center gap-1">
        {LINKS.map(({ href, label }) => {
          const active = pathname === href;
          return (
            <Link key={href} href={href}
              className={clsx('px-4 py-1.5 rounded-lg text-sm transition-colors', active ? 'bg-accent/10 text-accent' : 'text-muted-foreground hover:text-foreground')}>
              {label}
            </Link>
          );
        })}
      </nav>
      <div className="w-20" />
    </header>
  );
}
