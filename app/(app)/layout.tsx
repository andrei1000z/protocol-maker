import { Header } from '@/components/layout/Header';
import { CommandPalette } from '@/components/layout/CommandPalette';
import { MobileBottomNav } from '@/components/layout/MobileBottomNav';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Header />
      {/* Bottom-nav sits in fixed positioning, so leave room at the
          bottom of the scroll area on mobile only — desktop has no nav
          there. The pb-20 + safe-area inset together keep content above
          the nav strip on iPhones with home-indicator. */}
      <div className="pb-6 sm:pb-6 pb-20" style={{ paddingBottom: 'calc(5rem + env(safe-area-inset-bottom, 0px))' }}>
        {children}
      </div>
      {/* Cmd+K / Ctrl+K from anywhere in the app — self-mounts with a global
          keydown listener and renders nothing until the user opens it. */}
      <CommandPalette />
      {/* Sticky bottom nav — only renders on <sm via Tailwind class. */}
      <MobileBottomNav />
    </>
  );
}
