'use client';

import { useEffect, useState } from 'react';
import clsx from 'clsx';
import { List, X } from 'lucide-react';

interface TOCItem { id: string; label: string; icon: string; }

// Scroll-spy hook shared between desktop sidebar and mobile sheet — ensures
// the "active" highlight stays in sync whether the user scrolled organically
// or tapped an entry in the mobile sheet.
function useScrollSpy(items: TOCItem[]): string {
  const [active, setActive] = useState(items[0]?.id || '');

  useEffect(() => {
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
    items.forEach(item => {
      const el = document.getElementById(item.id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, [items]);

  return active;
}

function scrollTo(id: string) {
  const el = document.getElementById(id);
  if (el) {
    const y = el.getBoundingClientRect().top + window.scrollY - 80;
    window.scrollTo({ top: y, behavior: 'smooth' });
  }
}

export function DashboardTOC({ items }: { items: TOCItem[] }) {
  const active = useScrollSpy(items);
  const [mobileOpen, setMobileOpen] = useState(false);

  // Close the mobile sheet on escape + when route changes (history pop)
  useEffect(() => {
    if (!mobileOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setMobileOpen(false); };
    document.addEventListener('keydown', onKey);
    // Lock body scroll while sheet is open so swipes don't fight
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [mobileOpen]);

  const handlePick = (id: string) => {
    scrollTo(id);
    setMobileOpen(false);
  };

  return (
    <>
      {/* Desktop sidebar — unchanged behavior, sticky left column */}
      <aside className="hidden lg:block sticky top-20 h-[calc(100dvh-6rem)] w-56 shrink-0 no-print">
        <div className="rounded-2xl bg-card border border-card-border p-3 space-y-0.5 max-h-full overflow-y-auto">
          <p className="text-[10px] text-muted uppercase tracking-wider px-3 py-2">On this page</p>
          {items.map((item) => (
            <button key={item.id} onClick={() => scrollTo(item.id)}
              className={clsx('w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-left transition-all',
                active === item.id ? 'bg-accent/10 text-accent font-medium' : 'text-muted-foreground hover:bg-card-hover hover:text-foreground')}>
              <span>{item.icon}</span>
              <span className="truncate">{item.label}</span>
            </button>
          ))}
        </div>
      </aside>

      {/* Mobile: floating action button — always accessible on long pages */}
      <button
        onClick={() => setMobileOpen(true)}
        aria-label="Jump to section"
        className="lg:hidden fixed bottom-5 right-5 z-40 w-12 h-12 rounded-full bg-accent text-black shadow-xl flex items-center justify-center hover:bg-accent-bright active:scale-95 transition-all no-print"
      >
        <List className="w-5 h-5" strokeWidth={2.5} />
      </button>

      {/* Mobile slide-up sheet — max 70vh, scroll inside, tap outside to close */}
      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 z-50 flex items-end justify-center animate-fade-in no-print"
          onClick={() => setMobileOpen(false)}
        >
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
          <div
            className="relative w-full max-h-[70vh] bg-surface-1 border-t border-card-border rounded-t-3xl overflow-hidden flex flex-col animate-fade-in-up"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 border-b border-card-border shrink-0">
              <p className="text-sm font-semibold">Jump to section</p>
              <button
                onClick={() => setMobileOpen(false)}
                aria-label="Close"
                className="p-1.5 rounded-lg hover:bg-surface-3 text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="overflow-y-auto flex-1 p-2 space-y-0.5">
              {items.map((item) => (
                <button
                  key={item.id}
                  onClick={() => handlePick(item.id)}
                  className={clsx('w-full flex items-center gap-3 px-3 py-3 rounded-xl text-sm text-left transition-colors',
                    active === item.id ? 'bg-accent/10 text-accent font-medium' : 'text-foreground/85 hover:bg-surface-2')}
                >
                  <span className="text-lg shrink-0">{item.icon}</span>
                  <span className="flex-1 truncate">{item.label}</span>
                  {active === item.id && <span className="text-[10px] text-accent">current</span>}
                </button>
              ))}
            </div>
            {/* Safe-area padding for iPhone home indicator */}
            <div className="shrink-0 h-[env(safe-area-inset-bottom)]" />
          </div>
        </div>
      )}
    </>
  );
}
