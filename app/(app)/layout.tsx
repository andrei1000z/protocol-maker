import { Header } from '@/components/layout/Header';
import { CommandPalette } from '@/components/layout/CommandPalette';
import { MobileBottomNav } from '@/components/layout/MobileBottomNav';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {/* Skip-to-content link — first keyboard-tab target on every app
          page. Hidden until focused, then reveals at the top-left with
          strong accent styling so keyboard users can jump past the sticky
          header (which has its own tab-order nav) straight into <main>. */}
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[100] focus:px-4 focus:py-2 focus:rounded-lg focus:bg-accent focus:text-black focus:font-semibold focus:text-sm focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-background"
      >
        Skip to content
      </a>
      <Header />
      {/* Bottom-nav sits in fixed positioning, so leave room at the
          bottom of the scroll area on mobile only — desktop has no nav
          there. The pb-20 + safe-area inset together keep content above
          the nav strip on iPhones with home-indicator. */}
      <main id="main" className="pb-6 sm:pb-6 pb-20" style={{ paddingBottom: 'calc(5rem + env(safe-area-inset-bottom, 0px))' }}>
        {children}
      </main>
      {/* Cmd+K / Ctrl+K from anywhere in the app — self-mounts with a global
          keydown listener and renders nothing until the user opens it. */}
      <CommandPalette />
      {/* Sticky bottom nav — only renders on <sm via Tailwind class. */}
      <MobileBottomNav />
    </>
  );
}
