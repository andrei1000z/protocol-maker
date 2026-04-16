'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, CheckSquare, Settings, History } from 'lucide-react';
import clsx from 'clsx';

const NAV = [
  { href: '/dashboard', label: 'Protocol', icon: LayoutDashboard },
  { href: '/tracking', label: 'Track', icon: CheckSquare },
  { href: '/history', label: 'History', icon: History },
  { href: '/settings', label: 'Settings', icon: Settings },
];

export function NavBar() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-black/90 backdrop-blur-xl border-t border-card-border">
      <div className="flex items-center justify-around h-16 max-w-lg mx-auto px-4 pb-[env(safe-area-inset-bottom)]">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + '/');
          return (
            <Link key={href} href={href}
              className={clsx('flex flex-col items-center gap-0.5 px-4 py-1 rounded-xl transition-colors min-w-[60px]',
                active ? 'text-accent' : 'text-muted')}>
              <Icon className="w-5 h-5" />
              <span className="text-[10px] font-medium">{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
