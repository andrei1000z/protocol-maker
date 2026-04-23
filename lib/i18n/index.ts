'use client';

// i18n runtime — locale persistence + a tiny `useTranslation` hook.
//
// Same pattern as the theme module: localStorage stores the user's
// choice; lib/i18n/boot.ts holds the synchronous boot script that the
// (server) layout inlines to avoid mid-render locale flips.

import { useEffect, useState } from 'react';
import { lookup, LOCALES, type Locale } from './dictionaries';

export type { Locale };
export { LOCALES, lookup };

const STORAGE_KEY = 'protocol:locale';

export function getLocale(): Locale {
  if (typeof localStorage === 'undefined') return 'en';
  const v = localStorage.getItem(STORAGE_KEY);
  return v === 'ro' || v === 'en' ? v : 'en';
}

export function setLocale(next: Locale) {
  if (typeof localStorage === 'undefined') return;
  try { localStorage.setItem(STORAGE_KEY, next); } catch { /* quota — ignore */ }
  if (typeof document !== 'undefined') document.documentElement.setAttribute('lang', next);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('protocol:locale-change', { detail: next }));
  }
}

/** Reactive translation hook. Components re-render when the user changes
 *  locale via the picker — the change event fired by `setLocale` triggers
 *  the rerender. Falls back to English on the server. */
export function useTranslation() {
  const [locale, setLocaleState] = useState<Locale>('en');

  useEffect(() => {
    setLocaleState(getLocale());
    const onChange = (e: Event) => {
      const next = (e as CustomEvent<Locale>).detail;
      if (next === 'en' || next === 'ro') setLocaleState(next);
    };
    window.addEventListener('protocol:locale-change', onChange);
    return () => window.removeEventListener('protocol:locale-change', onChange);
  }, []);

  const t = (key: string) => lookup(locale, key);
  return { t, locale, setLocale };
}

// I18N_BOOT_SCRIPT lives in ./boot so the server layout can import it
// without dragging the client hooks above into a server build path.
