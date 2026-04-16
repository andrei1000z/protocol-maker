'use client';

import { useEffect, useState } from 'react';

export function AnimatedNumber({ value, duration = 1500, decimals = 0, className }: {
  value: number;
  duration?: number;
  decimals?: number;
  className?: string;
}) {
  const [displayed, setDisplayed] = useState(0);

  useEffect(() => {
    const start = Date.now();
    const from = 0;
    const to = value;

    const tick = () => {
      const elapsed = Date.now() - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3); // easeOutCubic
      setDisplayed(from + (to - from) * eased);
      if (progress < 1) requestAnimationFrame(tick);
    };

    requestAnimationFrame(tick);
  }, [value, duration]);

  return <span className={className}>{displayed.toFixed(decimals)}</span>;
}
