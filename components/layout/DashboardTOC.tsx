'use client';

import { useEffect, useState } from 'react';
import clsx from 'clsx';

interface TOCItem { id: string; label: string; icon: string; }

export function DashboardTOC({ items }: { items: TOCItem[] }) {
  const [active, setActive] = useState('');
  const [visibleItems, setVisibleItems] = useState<TOCItem[]>([]);

  // On mount, filter items to only those whose target sections exist in DOM
  useEffect(() => {
    // Wait for dashboard sections to render
    const timer = setTimeout(() => {
      const present = items.filter(item => document.getElementById(item.id) !== null);
      setVisibleItems(present);
      if (present.length > 0) setActive(present[0].id);
    }, 100);
    return () => clearTimeout(timer);
  }, [items]);

  // Re-check periodically in case sections render after data loads
  useEffect(() => {
    const interval = setInterval(() => {
      const present = items.filter(item => document.getElementById(item.id) !== null);
      if (present.length !== visibleItems.length) {
        setVisibleItems(present);
      }
    }, 500);
    return () => clearInterval(interval);
  }, [items, visibleItems.length]);

  // Scroll tracking
  useEffect(() => {
    if (visibleItems.length === 0) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter(e => e.isIntersecting);
        if (visible.length > 0) {
          const topmost = visible.reduce((prev, curr) => prev.intersectionRatio > curr.intersectionRatio ? prev : curr);
          setActive(topmost.target.id);
        }
      },
      { rootMargin: '-20% 0px -60% 0px', threshold: [0.1, 0.5, 1] }
    );

    visibleItems.forEach(item => {
      const el = document.getElementById(item.id);
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, [visibleItems]);

  const scrollTo = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      const y = el.getBoundingClientRect().top + window.scrollY - 80;
      window.scrollTo({ top: y, behavior: 'smooth' });
    }
  };

  if (visibleItems.length === 0) return null;

  return (
    <aside className="hidden lg:block sticky top-20 h-[calc(100dvh-6rem)] w-56 shrink-0 no-print">
      <div className="rounded-2xl bg-card border border-card-border p-3 space-y-0.5 max-h-full overflow-y-auto">
        <p className="text-[10px] text-muted uppercase tracking-wider px-3 py-2">On this page</p>
        {visibleItems.map((item) => (
          <button key={item.id} onClick={() => scrollTo(item.id)}
            className={clsx('w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-left transition-all',
              active === item.id ? 'bg-accent/10 text-accent font-medium' : 'text-muted-foreground hover:bg-card-hover hover:text-foreground')}>
            <span>{item.icon}</span>
            <span className="truncate">{item.label}</span>
          </button>
        ))}
      </div>
    </aside>
  );
}
