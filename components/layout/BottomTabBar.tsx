'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { CalendarCheck, Apple, Watch, BarChart3, Settings } from 'lucide-react';
import clsx from 'clsx';

const tabs = [
  { href: '/', label: 'Azi', icon: CalendarCheck },
  { href: '/nutritie', label: 'Nutriție', icon: Apple },
  { href: '/watch', label: 'Watch', icon: Watch },
  { href: '/stats', label: 'Stats', icon: BarChart3 },
  { href: '/config', label: 'Config', icon: Settings },
];

export function BottomTabBar() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-card/80 backdrop-blur-xl border-t border-card-border">
      <div className="flex items-center justify-around h-16 max-w-lg mx-auto px-2 pb-[env(safe-area-inset-bottom)]">
        {tabs.map(({ href, label, icon: Icon }) => {
          const active = href === '/' ? pathname === '/' : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={clsx(
                'flex flex-col items-center gap-0.5 px-3 py-1 rounded-xl transition-colors min-w-[56px]',
                active ? 'text-primary' : 'text-muted'
              )}
            >
              <Icon className="w-5 h-5" />
              <span className="text-[10px] font-medium">{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
