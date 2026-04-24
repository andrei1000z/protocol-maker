'use client';

// Tiny chip that says "Protocol actualizat acum Xh" with a subtle Regenerează
// button. Renders above the hero so the user knows the protocol isn't a
// black box of "idk when this was last updated". Hidden if timestamp missing.
//
// Intentionally compact (one line, icon + text + CTA) — not a banner that
// dominates the scroll; just a quiet trust signal.

import { useState } from 'react';
import { RefreshCw, Clock } from 'lucide-react';
import { invalidate } from '@/lib/hooks/useApiData';
import { toast } from '@/lib/toast';

function relativeFromNow(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(ms / 60_000);
  if (minutes < 1) return 'chiar acum';
  if (minutes < 60) return `${minutes}m în urmă`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h în urmă`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'ieri';
  if (days < 7) return `${days} zile în urmă`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `${weeks} săpt. în urmă`;
  return new Date(iso).toLocaleDateString('ro-RO', { day: 'numeric', month: 'short' });
}

export function LastRefreshedChip({ createdAt }: { createdAt: string | null | undefined }) {
  const [busy, setBusy] = useState(false);
  if (!createdAt) return null;

  const handleRegen = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const res = await fetch('/api/generate-protocol', { method: 'POST' });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        if (res.status === 429) {
          throw new Error(j.error || 'Ai atins limita zilnică.');
        }
        throw new Error(j.error || `Regenerare eșuată (${res.status})`);
      }
      invalidate.myData();
      invalidate.liveScores();
      invalidate.protocolHistory();
      toast({ tone: 'success', title: 'Protocol regenerat' });
    } catch (e) {
      toast({ tone: 'error', title: 'Regenerare eșuată', description: e instanceof Error ? e.message : undefined });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
      <span className="inline-flex items-center gap-1.5">
        <Clock className="w-3.5 h-3.5" aria-hidden="true" />
        Protocol actualizat <span className="font-mono text-foreground/85">{relativeFromNow(createdAt)}</span>
      </span>
      <button
        type="button"
        onClick={handleRegen}
        disabled={busy}
        className="inline-flex items-center gap-1 text-accent hover:text-accent-bright disabled:opacity-50 transition-colors"
      >
        {busy ? (
          <>
            <span className="w-3 h-3 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
            Regenerez…
          </>
        ) : (
          <>
            <RefreshCw className="w-3 h-3" />
            Regenerează
          </>
        )}
      </button>
    </div>
  );
}
