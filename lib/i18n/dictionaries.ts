// Translation dictionaries — flat key/value, one per locale.
//
// Keys use dotted paths so the file stays scannable (`nav.home` /
// `dashboard.greeting_morning`). Missing keys fall back to English; if a
// key is missing in English too, the renderer returns the key itself so
// the bug is visible during development instead of silently rendering "".
//
// Strategy: opt-in adoption. New strings flow through `t()`; legacy
// hard-coded strings get migrated as we touch them. We don't gate the
// shipping of new features on translating every existing string.

export type Locale = 'en' | 'ro';

export const LOCALES: Array<{ id: Locale; label: string; flag: string }> = [
  { id: 'en', label: 'English',  flag: '🇬🇧' },
  { id: 'ro', label: 'Română',   flag: '🇷🇴' },
];

type Dict = Record<string, string>;

export const EN: Dict = {
  // Nav
  'nav.home':         'Home',
  'nav.tracking':     'Track',
  'nav.statistics':   'Stats',
  'nav.chat':         'Chat',
  'nav.history':      'History',
  'nav.settings':     'Settings',

  // Common verbs
  'action.save':      'Save',
  'action.cancel':    'Cancel',
  'action.delete':    'Delete',
  'action.continue':  'Continue',
  'action.close':     'Close',
  'action.signin':    'Sign in',
  'action.signout':   'Sign out',
  'action.signup':    'Get started',

  // Greetings
  'greeting.morning':   'Good morning',
  'greeting.afternoon': 'Good afternoon',
  'greeting.evening':   'Good evening',
  'greeting.night':     'Late night',

  // Dashboard
  'dashboard.title':              'Your diagnostic',
  'dashboard.regenerate':         'Regenerate protocol',
  'dashboard.todays_agenda':      "Today's agenda",
  'dashboard.meal_log':           'Meal log',
  'dashboard.workout':            'Workout',
  'dashboard.log_meal':           'Log meal',
  'dashboard.log_workout':        'Log workout',

  // Settings
  'settings.theme':               'Theme',
  'settings.theme.system':        'System',
  'settings.theme.light':         'Light',
  'settings.theme.dark':          'Dark',
  'settings.notifications':       'Notifications',
  'settings.language':            'Language',
  'settings.language.desc':       'Affects in-app copy. New translations are added as we ship features.',

  // Errors
  'error.generic':       'Something went wrong. Try again.',
  'error.unauthorized':  'You need to sign in.',
  'error.rate_limit':    'Too many requests. Wait a moment.',

  // Disclaimer
  'disclaimer.short':    'Not medical advice. Always consult a doctor.',
};

export const RO: Dict = {
  'nav.home':         'Acasă',
  'nav.tracking':     'Tracking',
  'nav.statistics':   'Statistici',
  'nav.chat':         'Chat',
  'nav.history':      'Istoric',
  'nav.settings':     'Setări',

  'action.save':      'Salvează',
  'action.cancel':    'Anulează',
  'action.delete':    'Șterge',
  'action.continue':  'Continuă',
  'action.close':     'Închide',
  'action.signin':    'Conectare',
  'action.signout':   'Deconectare',
  'action.signup':    'Începe',

  'greeting.morning':   'Bună dimineața',
  'greeting.afternoon': 'O după-amiază bună',
  'greeting.evening':   'O seară bună',
  'greeting.night':     'Noapte bună',

  'dashboard.title':              'Diagnosticul tău',
  'dashboard.regenerate':         'Regenerează protocolul',
  'dashboard.todays_agenda':      'Agenda de azi',
  'dashboard.meal_log':           'Jurnal de masă',
  'dashboard.workout':            'Antrenament',
  'dashboard.log_meal':           'Adaugă masă',
  'dashboard.log_workout':        'Adaugă antrenament',

  'settings.theme':               'Temă',
  'settings.theme.system':        'Sistem',
  'settings.theme.light':         'Luminos',
  'settings.theme.dark':          'Întunecat',
  'settings.notifications':       'Notificări',
  'settings.language':            'Limbă',
  'settings.language.desc':       'Afectează textul din aplicație. Adăugăm traduceri pe măsură ce livrăm features.',

  'error.generic':       'Ceva nu a mers. Încearcă din nou.',
  'error.unauthorized':  'Trebuie să fii conectat.',
  'error.rate_limit':    'Prea multe cereri. Așteaptă un moment.',

  'disclaimer.short':    'Nu este sfat medical. Consultă întotdeauna un medic.',
};

const DICTIONARIES: Record<Locale, Dict> = { en: EN, ro: RO };

/** Pure lookup: locale + key → string. Falls through to English when the
 *  key is missing in the requested locale; returns the key itself when it's
 *  missing in English too (so missing-translation bugs are visible). */
export function lookup(locale: Locale, key: string): string {
  const primary = DICTIONARIES[locale]?.[key];
  if (primary !== undefined) return primary;
  const fallback = EN[key];
  if (fallback !== undefined) return fallback;
  return key;
}
