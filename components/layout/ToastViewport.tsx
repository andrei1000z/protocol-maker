'use client';

// Toast viewport — listens for `protocol:toast` events from lib/toast.ts
// and renders the queue in the bottom-right (or bottom-center on mobile).
//
// Mounted once in the root layout; never re-mounted.

import { useEffect, useState } from 'react';
import { CheckCircle2, AlertTriangle, XCircle, X, Info } from 'lucide-react';
import clsx from 'clsx';
import { subscribeToasts, type ToastEvent } from '@/lib/toast';

const ICONS = {
  default: Info,
  success: CheckCircle2,
  warning: AlertTriangle,
  error:   XCircle,
};

const TONES = {
  default: 'bg-surface-1 border-card-border text-foreground',
  success: 'bg-accent/[0.08] border-accent/30 text-accent',
  warning: 'bg-amber-500/[0.08] border-amber-500/30 text-amber-400',
  error:   'bg-red-500/[0.08] border-red-500/30 text-danger',
};

export function ToastViewport() {
  const [queue, setQueue] = useState<ToastEvent[]>([]);

  useEffect(() => {
    return subscribeToasts(evt => {
      setQueue(prev => [...prev, evt]);
      // Auto-dismiss after the configured duration; 0 means sticky.
      if (evt.duration && evt.duration > 0) {
        setTimeout(() => {
          setQueue(prev => prev.filter(t => t.id !== evt.id));
        }, evt.duration);
      }
    });
  }, []);

  const dismiss = (id: string) => setQueue(prev => prev.filter(t => t.id !== id));

  if (queue.length === 0) return null;

  return (
    <div
      role="region"
      aria-label="Notifications"
      aria-live="polite"
      className="fixed z-[80] inset-x-0 sm:inset-x-auto bottom-24 sm:bottom-6 sm:right-6 px-4 sm:px-0 flex flex-col items-center sm:items-end gap-2 pointer-events-none"
    >
      {queue.map(t => {
        const Icon = ICONS[t.tone ?? 'default'];
        const tone = TONES[t.tone ?? 'default'];
        return (
          <div
            key={t.id}
            role="status"
            className={clsx(
              'pointer-events-auto w-full sm:w-[min(86vw,360px)] rounded-2xl border shadow-lg backdrop-blur-md p-3.5 flex items-start gap-3 animate-fade-in-up',
              tone,
            )}
          >
            <Icon className="w-4 h-4 mt-0.5 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-foreground">{t.title}</p>
              {t.description && (
                <p className="text-[12px] text-muted-foreground leading-relaxed mt-0.5">{t.description}</p>
              )}
              {t.action && (
                <button
                  onClick={() => { t.action?.onAction(); dismiss(t.id); }}
                  className="text-[11px] font-semibold text-accent hover:underline mt-1.5"
                >
                  {t.action.label}
                </button>
              )}
            </div>
            <button
              onClick={() => dismiss(t.id)}
              aria-label="Dismiss"
              className="p-1 -m-1 rounded-lg text-muted-foreground hover:text-foreground transition-colors shrink-0"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
