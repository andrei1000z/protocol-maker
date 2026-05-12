'use client';

// F1 — Web Push subscription card. Lets the user enable browser
// notifications for protocol regen alerts, retest reminders, streak
// milestones. Permission gating + subscription happen entirely client-side;
// the server only stores the resulting PushSubscription via /api/push/subscribe.
//
// VAPID public key is read from NEXT_PUBLIC_VAPID_PUBLIC_KEY (deploy-time
// env var the owner sets once in Vercel after generating a VAPID pair).
// Card renders a "Not configured" state when the key is absent so the
// feature degrades gracefully in dev / before VAPID is wired.

import { useEffect, useState } from 'react';
import { Bell, BellOff, AlertCircle } from 'lucide-react';

type Status =
  | 'loading'
  | 'unsupported'
  | 'not_configured'
  | 'denied'
  | 'subscribed'
  | 'available';

// URL-safe base64 → Uint8Array per the Web Push standard. PushManager.subscribe
// wants `applicationServerKey` as a Uint8Array, not a string.
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; ++i) out[i] = raw.charCodeAt(i);
  return out;
}

export function PushNotificationsCard() {
  const [status, setStatus] = useState<Status>('loading');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '';

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
      setStatus('unsupported');
      return;
    }
    if (!vapidKey) {
      setStatus('not_configured');
      return;
    }
    if (Notification.permission === 'denied') {
      setStatus('denied');
      return;
    }
    navigator.serviceWorker.ready
      .then(reg => reg.pushManager.getSubscription())
      .then(sub => setStatus(sub ? 'subscribed' : 'available'))
      .catch(() => setStatus('available'));
  }, [vapidKey]);

  const subscribe = async () => {
    setBusy(true);
    setError(null);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        setStatus(permission === 'denied' ? 'denied' : 'available');
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      // applicationServerKey accepts BufferSource. The Uint8Array generic on
      // recent TS lib.d.ts is Uint8Array<ArrayBufferLike>, which doesn't
      // unify with ArrayBuffer. Pass the underlying .buffer (sliced to
      // ArrayBuffer) so the type narrows cleanly.
      const keyBytes = urlBase64ToUint8Array(vapidKey);
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: keyBytes.buffer.slice(keyBytes.byteOffset, keyBytes.byteOffset + keyBytes.byteLength) as ArrayBuffer,
      });
      const json = sub.toJSON() as { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
      const res = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          endpoint: json.endpoint,
          keys: { p256dh: json.keys?.p256dh, auth: json.keys?.auth },
          ua: navigator.userAgent,
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        // Roll back the browser-side subscription if the server didn't accept it.
        await sub.unsubscribe().catch(() => undefined);
        throw new Error(j.error || `Salvarea pe server a eșuat (${res.status})`);
      }
      setStatus('subscribed');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Activarea a eșuat');
    } finally {
      setBusy(false);
    }
  };

  const unsubscribe = async () => {
    setBusy(true);
    setError(null);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await fetch('/api/push/subscribe', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        }).catch(() => undefined);
        await sub.unsubscribe();
      }
      setStatus('available');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Dezactivarea a eșuat');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="glass-card rounded-2xl p-5 space-y-3.5 animate-fade-in-up">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-accent/10 border border-accent/25 flex items-center justify-center shrink-0">
          {status === 'subscribed' ? <Bell className="w-5 h-5 text-accent" /> : <BellOff className="w-5 h-5 text-muted-foreground" />}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold">Notificări push</p>
          <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
            {status === 'loading' && 'Se verifică suportul…'}
            {status === 'unsupported' && 'Browserul tău nu suportă notificări web push (sau ești în Safari iOS fără PWA instalat).'}
            {status === 'not_configured' && 'Notificările push sunt configurate de administrator. Vor apărea aici când e gata.'}
            {status === 'denied' && 'Ai blocat notificările. Reactivează-le din setările siteului în browser.'}
            {status === 'subscribed' && 'Activate pe acest dispozitiv. Primești alerte pentru regenerarea protocolului, reminders de retest și praguri de streak.'}
            {status === 'available' && 'Primește alerte despre regenerarea protocolului, retest-uri scadente și praguri de streak. Le poți opri oricând.'}
          </p>
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-2 text-xs text-danger bg-red-500/10 border border-red-500/25 rounded-lg p-2.5">
          <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {status === 'available' && (
          <button
            onClick={subscribe}
            disabled={busy}
            className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-accent text-black font-semibold hover:bg-accent-bright disabled:opacity-50 transition-colors"
          >
            <Bell className="w-3.5 h-3.5" />
            {busy ? 'Se activează…' : 'Activează notificările'}
          </button>
        )}
        {status === 'subscribed' && (
          <button
            onClick={unsubscribe}
            disabled={busy}
            className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-surface-2 border border-card-border text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
          >
            <BellOff className="w-3.5 h-3.5" />
            {busy ? 'Se dezactivează…' : 'Dezactivează'}
          </button>
        )}
      </div>
    </div>
  );
}
