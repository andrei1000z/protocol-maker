/**
 * Global loading state — shown automatically by Next during route transitions.
 * Thin emerald progress bar at the top for "something is happening" feel
 * without layout-shift.
 */
export default function Loading() {
  return (
    <div className="fixed top-0 left-0 right-0 z-[100] h-0.5 overflow-hidden pointer-events-none">
      <div className="h-full bg-accent animate-[loading_1.2s_ease-in-out_infinite] origin-left" />
      <style>{`
        @keyframes loading {
          0%   { transform: translateX(-100%) scaleX(0.2); }
          50%  { transform: translateX(0%) scaleX(0.6); }
          100% { transform: translateX(100%) scaleX(0.2); }
        }
      `}</style>
    </div>
  );
}
