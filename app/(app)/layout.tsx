import { NavBar } from '@/components/layout/NavBar';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <div className="pb-20">{children}</div>
      <NavBar />
    </>
  );
}
