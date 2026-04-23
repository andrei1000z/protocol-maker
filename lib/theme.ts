// Theme — three-mode picker (system / light / dark) with the resolved
// active mode persisted as a `data-theme` attribute on <html>.
//
// Why three modes:
//   - system: follow the OS preference (default — most users want this)
//   - light:  hard pin
//   - dark:   hard pin
//
// All theming is CSS variables in globals.css; this module just decides
// which preset is active and writes the attribute. The boot script in
// app/layout.tsx applies the saved choice synchronously before paint so
// there's no flash of wrong theme.

export type ThemeMode = 'system' | 'light' | 'dark';
export type ResolvedTheme = 'light' | 'dark';

const STORAGE_KEY = 'protocol:theme';

/** Read the saved choice. Defaults to system when nothing's stored or
 *  localStorage is unavailable (SSR). */
export function getThemeMode(): ThemeMode {
  if (typeof localStorage === 'undefined') return 'system';
  const v = localStorage.getItem(STORAGE_KEY);
  return v === 'light' || v === 'dark' ? v : 'system';
}

/** Resolve `system` to the actual OS preference. On the server (no
 *  matchMedia), defaults to dark — matches the historical app default. */
export function resolveTheme(mode: ThemeMode): ResolvedTheme {
  if (mode === 'light' || mode === 'dark') return mode;
  if (typeof window === 'undefined' || !window.matchMedia) return 'dark';
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

/** Apply the resolved theme + persist the user's mode choice. */
export function setThemeMode(mode: ThemeMode) {
  if (typeof document === 'undefined') return;
  const resolved = resolveTheme(mode);
  document.documentElement.setAttribute('data-theme', resolved);
  document.documentElement.style.colorScheme = resolved;
  try {
    if (mode === 'system') localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, mode);
  } catch { /* quota / private mode — ignore, attribute still applied */ }
}

/** Boot script string — inlined in <head> as a regular <script> so it
 *  runs before React hydrates. Prevents the dark→light flash that an
 *  effect-based applier would cause on first paint. */
export const THEME_BOOT_SCRIPT = `
(function(){try{var v=localStorage.getItem('protocol:theme');var m=(v==='light'||v==='dark')?v:(window.matchMedia&&window.matchMedia('(prefers-color-scheme: light)').matches?'light':'dark');document.documentElement.setAttribute('data-theme',m);document.documentElement.style.colorScheme=m;}catch(e){document.documentElement.setAttribute('data-theme','dark');document.documentElement.style.colorScheme='dark';}})();
`.trim();

/** Subscribe to OS color-scheme changes. Re-applies the theme when the
 *  user is on `system` mode and switches their OS appearance. Returns
 *  the unsubscribe function. */
export function watchSystemTheme(): () => void {
  if (typeof window === 'undefined' || !window.matchMedia) return () => {};
  const mq = window.matchMedia('(prefers-color-scheme: light)');
  const onChange = () => {
    if (getThemeMode() === 'system') setThemeMode('system');
  };
  mq.addEventListener('change', onChange);
  return () => mq.removeEventListener('change', onChange);
}
