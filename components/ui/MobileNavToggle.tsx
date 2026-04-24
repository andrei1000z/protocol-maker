'use client';

// Hamburger + dropdown for the marketing nav on sub-640px screens.
//
// The landing page is a server component; we only need an interactive island
// for the open/close state. Keeps the Nav server-rendered and fast.
//
// Behavior:
//   - Visible only below the sm breakpoint (≥ sm shows the inline links).
//   - Click-outside + Escape close the menu.
//   - Clicking a link inside closes the menu so the anchor scroll works
//     cleanly on the same-page sections (#how, #demo).

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Menu, X } from 'lucide-react';

export function MobileNavToggle() {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  // Outside-click + Escape close. Registered only while open to avoid a
  // persistent mousedown listener for every visitor.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative sm:hidden">
      <button
        onClick={() => setOpen(o => !o)}
        aria-label={open ? 'Închide meniul' : 'Deschide meniul'}
        aria-expanded={open}
        className="w-9 h-9 rounded-lg border border-card-border bg-surface-2 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
      >
        {open ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full mt-2 w-52 rounded-xl bg-surface-1 border border-card-border shadow-xl p-2 z-50 animate-fade-in-up"
        >
          <a href="#how" onClick={() => setOpen(false)} className="block px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-surface-2 rounded-lg transition-colors">Cum funcționează</a>
          <a href="#demo" onClick={() => setOpen(false)} className="block px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-surface-2 rounded-lg transition-colors">Demo</a>
          <Link href="/changelog" onClick={() => setOpen(false)} className="block px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-surface-2 rounded-lg transition-colors">Noutăți</Link>
          <Link href="/biomarkers" onClick={() => setOpen(false)} className="block px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-surface-2 rounded-lg transition-colors">Biomarkeri</Link>
          <Link href="/patterns" onClick={() => setOpen(false)} className="block px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-surface-2 rounded-lg transition-colors">Tipare</Link>
        </div>
      )}
    </div>
  );
}
