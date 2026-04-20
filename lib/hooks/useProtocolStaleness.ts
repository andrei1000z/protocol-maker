'use client';

// ─────────────────────────────────────────────────────────────────────────────
// Tracks "how many metrics has the user logged since the current protocol was
// generated" — used to decide when to surface a manual "Refresh protocol"
// suggestion. Zero API cost until the user actively clicks refresh.
//
// Why NOT auto-regen on every log?
//   - Claude / Groq input tokens cost $ per call.
//   - A user sweeping through morning-fasted logs = 10 metrics in 30 sec =
//     10 wasted regens.
//   - The existing nightly cron already handles the background refresh.
//
// Design:
//   - localStorage key: `protocol:logs-since-gen:${protocolId}` = count
//   - When a protocol is generated (id changes / created_at moves forward),
//     reset the counter to 0.
//   - Each call to `recordLog()` increments.
//   - `isStale` = true when counter >= STALE_THRESHOLD (default 3).
//   - `reset()` clears the counter (called after successful regeneration).
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useState, useCallback } from 'react';

const STALE_THRESHOLD = 3;

function storageKey(protocolId: string | null | undefined): string | null {
  if (!protocolId) return null;
  return `protocol:logs-since-gen:${protocolId}`;
}

function readCount(protocolId: string | null | undefined): number {
  const k = storageKey(protocolId);
  if (!k || typeof window === 'undefined') return 0;
  try {
    const raw = localStorage.getItem(k);
    if (!raw) return 0;
    const n = parseInt(raw, 10);
    return Number.isFinite(n) && n >= 0 ? n : 0;
  } catch { return 0; }
}

function writeCount(protocolId: string | null | undefined, count: number): void {
  const k = storageKey(protocolId);
  if (!k || typeof window === 'undefined') return;
  try { localStorage.setItem(k, String(count)); } catch { /* quota — ignore */ }
}

export function useProtocolStaleness(protocolId: string | null | undefined): {
  count: number;
  isStale: boolean;
  threshold: number;
  recordLog: () => void;
  reset: () => void;
} {
  const [count, setCount] = useState(0);

  // Rehydrate counter when the protocol id changes (new regen → fresh key).
  useEffect(() => {
    setCount(readCount(protocolId));
  }, [protocolId]);

  const recordLog = useCallback(() => {
    setCount(prev => {
      const next = prev + 1;
      writeCount(protocolId, next);
      return next;
    });
  }, [protocolId]);

  const reset = useCallback(() => {
    setCount(0);
    writeCount(protocolId, 0);
  }, [protocolId]);

  return {
    count,
    isStale: count >= STALE_THRESHOLD,
    threshold: STALE_THRESHOLD,
    recordLog,
    reset,
  };
}
