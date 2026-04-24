'use client';

// Install-app banner — captures the PWA `beforeinstallprompt` event on
// Android / Chrome desktop, and surfaces a dismissable chip after the user
// has visited more than once (avoids pestering first-time visitors).
//
// iOS Safari doesn't fire beforeinstallprompt; instead it shows a native
// "Add to Home Screen" via the Share menu. For iOS we fall back to a one-
// liner hint ("Install via Share → Add to Home Screen") which users can
// dismiss forever — same localStorage key as the Chrome path.

import { useEffect, useState } from 'react';
import { Download, X, Share } from 'lucide-react';

// Chrome's BeforeInstallPromptEvent isn't in the stock DOM types yet; keep
// a narrow local interface instead of `any`.
interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
  prompt: () => Promise<void>;
}

const DISMISS_KEY = 'protocol:install-banner-dismissed:v1';
const VISIT_COUNT_KEY = 'protocol:visit-count';

export function InstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [iosHint, setIosHint] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Bump visit count. The banner only ever appears from visit #2 onwards.
    let visits = 0;
    try {
      visits = parseInt(localStorage.getItem(VISIT_COUNT_KEY) || '0', 10) + 1;
      localStorage.setItem(VISIT_COUNT_KEY, String(visits));
    } catch { /* localStorage unavailable — silently skip */ }

    // Has the user already dismissed? If yes, stay hidden forever.
    let dismissed = false;
    try { dismissed = localStorage.getItem(DISMISS_KEY) === '1'; } catch { /* ignore */ }
    if (dismissed) return;

    // Already installed? On Chromium this sets display-mode standalone; on
    // iOS navigator.standalone is set. Either way, don't pester.
    const installed = window.matchMedia?.('(display-mode: standalone)').matches
      || (navigator as Navigator & { standalone?: boolean }).standalone === true;
    if (installed) return;

    // iOS detection — userAgent is the only reliable path still.
    const ua = navigator.userAgent;
    const isIOS = /iPad|iPhone|iPod/.test(ua) && !(window as Window & { MSStream?: unknown }).MSStream;

    // Don't show on visit #1 — would annoy first-timers before they see value.
    if (visits < 2) return;

    if (isIOS) {
      setIosHint(true);
      setVisible(true);
      return;
    }

    // Android / desktop Chrome path — wait for the browser's prompt event.
    const handler = (e: Event) => {
      e.preventDefault();  // stash it; we trigger later on user tap
      setDeferred(e as BeforeInstallPromptEvent);
      setVisible(true);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const dismiss = () => {
    setVisible(false);
    try { localStorage.setItem(DISMISS_KEY, '1'); } catch { /* ignore */ }
  };

  const install = async () => {
    if (!deferred) return;
    try {
      await deferred.prompt();
      const { outcome } = await deferred.userChoice;
      if (outcome === 'accepted') dismiss();
    } catch { /* rejected — user can retry */ }
    setDeferred(null);
  };

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-labelledby="install-prompt-title"
      className="fixed bottom-4 left-4 right-4 sm:left-auto sm:max-w-sm z-40 animate-fade-in-up"
    >
      <div className="glass-card rounded-2xl p-4 shadow-lg border-accent/25 flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-accent/10 border border-accent/25 flex items-center justify-center shrink-0">
          <Download className="w-5 h-5 text-accent" />
        </div>
        <div className="flex-1 min-w-0 space-y-2">
          <p id="install-prompt-title" className="text-sm font-semibold">
            Instalează Protocol
          </p>
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            {iosHint
              ? 'Apasă Share, apoi "Adaugă pe ecran Home" ca să o instalezi ca aplicație.'
              : 'Un tap — apoi Protocol se deschide ca o aplicație nativă, chiar și offline.'}
          </p>
          <div className="flex gap-2 items-center pt-0.5">
            {iosHint ? (
              <span className="inline-flex items-center gap-1 text-xs text-accent">
                <Share className="w-3 h-3" /> Safari &gt; Share &gt; Adaugă pe ecran Home
              </span>
            ) : (
              <button
                onClick={install}
                disabled={!deferred}
                className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-3 py-1.5 rounded-lg bg-accent text-black hover:bg-accent-bright disabled:opacity-50 transition-colors"
              >
                <Download className="w-3 h-3" /> Instalează
              </button>
            )}
            <button
              onClick={dismiss}
              className="text-[11px] text-muted-foreground hover:text-foreground transition-colors px-2 py-1.5"
            >
              Mai târziu
            </button>
          </div>
        </div>
        <button
          onClick={dismiss}
          aria-label="Închide promptul de instalare"
          className="p-1 rounded-lg text-muted-foreground hover:text-foreground transition-colors shrink-0"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
