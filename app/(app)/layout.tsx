import { NavBar } from '@/components/layout/NavBar';
import { Header } from '@/components/layout/Header';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Header />
      <div className="pb-20 md:pb-4">{children}</div>
      <NavBar />
    </>
  );
}
