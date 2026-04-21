import { Header } from '@/components/layout/Header';
import { CommandPalette } from '@/components/layout/CommandPalette';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Header />
      <div className="pb-6">{children}</div>
      {/* Cmd+K / Ctrl+K from anywhere in the app — self-mounts with a global
          keydown listener and renders nothing until the user opens it. */}
      <CommandPalette />
    </>
  );
}
