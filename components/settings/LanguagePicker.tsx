'use client';

// Language picker — flag buttons, persists via lib/i18n.setLocale.
//
// Currently EN + RO. Adding more locales is one entry in
// lib/i18n/dictionaries.ts + one row in LOCALES[]; this component
// auto-renders the new option.

import { useEffect, useState } from 'react';
import clsx from 'clsx';
import { Globe } from 'lucide-react';
import { LOCALES, getLocale, setLocale, useTranslation, type Locale } from '@/lib/i18n';

export function LanguagePicker() {
  const { t } = useTranslation();
  const [mounted, setMounted] = useState(false);
  const [active, setActive] = useState<Locale>('en');

  useEffect(() => {
    setActive(getLocale());
    setMounted(true);
  }, []);

  return (
    <div className="glass-card rounded-2xl p-5 space-y-3 animate-fade-in-up">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-accent/10 border border-accent/25 flex items-center justify-center">
          <Globe className="w-4 h-4 text-accent" />
        </div>
        <div>
          <p className="text-sm font-semibold">{t('settings.language')}</p>
          <p className="text-[11px] text-muted-foreground leading-relaxed">{t('settings.language.desc')}</p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {LOCALES.map(loc => {
          const isActive = mounted && active === loc.id;
          return (
            <button
              key={loc.id}
              onClick={() => { setActive(loc.id); setLocale(loc.id); }}
              aria-pressed={isActive}
              className={clsx(
                'flex items-center gap-2.5 p-3 rounded-xl border transition-colors text-left',
                isActive
                  ? 'bg-accent/10 border-accent/40 text-accent'
                  : 'bg-surface-2 border-card-border text-muted-foreground hover:text-foreground hover:border-card-border-hover',
              )}
            >
              <span className="text-xl" aria-hidden>{loc.flag}</span>
              <span className="text-sm font-semibold">{loc.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
