import { BottomTabBar } from '@/components/layout/BottomTabBar';

export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <main className="pb-20 max-w-lg mx-auto w-full px-4 pt-6">
        {children}
      </main>
      <BottomTabBar />
    </>
  );
}
