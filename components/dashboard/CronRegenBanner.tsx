'use client';

// Banner that appears the morning after the cron auto-regenerates a user's
// protocol, so the changed numbers don't feel arbitrary. Dismissal is
// keyed per protocol id in localStorage — the banner won't return until
// the NEXT cron regen produces a new id.

import { useEffect, useState } from 'react';

export function CronRegenBanner({ createdAt, protocolId }: { createdAt: string; protocolId: string }) {
  const [dismissed, setDismissed] = useState<boolean | null>(null);

  useEffect(() => {
    try {
      const seen = localStorage.getItem(`protocol:cron-banner-seen:${protocolId}`);
      setDismissed(seen === '1');
    } catch { setDismissed(false); }
  }, [protocolId]);

  // Cap the banner age at 48h — older cron runs don't surprise anyone any more.
  const hoursOld = (Date.now() - new Date(createdAt).getTime()) / 3_600_000;
  if (dismissed !== false || hoursOld > 48) return null;

  const dismiss = () => {
    try { localStorage.setItem(`protocol:cron-banner-seen:${protocolId}`, '1'); } catch { /* ignore */ }
    setDismissed(true);
  };

  const when = hoursOld < 12 ? 'azi-noapte' : hoursOld < 24 ? 'mai devreme azi' : 'ieri';
  return (
    <div className="rounded-2xl bg-gradient-to-r from-blue-500/8 to-accent/5 border border-blue-500/25 p-4 flex items-center gap-3 animate-fade-in-up">
      <div className="w-10 h-10 rounded-xl bg-blue-500/15 border border-blue-500/30 flex items-center justify-center shrink-0">
        <span className="text-base">🌙</span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-blue-400">Protocolul tău s-a actualizat {when}</p>
        <p className="text-xs text-muted-foreground mt-0.5">Analiză proaspătă pe baza datelor tale recente. Derulează mai jos să vezi ce s-a schimbat față de versiunea precedentă.</p>
      </div>
      <button
        onClick={dismiss}
        className="shrink-0 px-3 py-1.5 rounded-lg bg-surface-2 border border-card-border text-xs font-medium text-muted-foreground hover:text-foreground hover:border-accent/30 transition-colors"
      >
        Închide
      </button>
    </div>
  );
}
