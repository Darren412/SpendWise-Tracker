// Theme preference resolution — pure except guarded localStorage/DOM access.

export type ThemePreference = 'light' | 'dark' | 'system';
export const THEME_STORAGE_KEY = 'spendwise_theme';

export function getStoredTheme(): ThemePreference {
  if (typeof window === 'undefined') return 'system';
  try {
    const v = localStorage.getItem(THEME_STORAGE_KEY);
    return v === 'light' || v === 'dark' || v === 'system' ? v : 'system';
  } catch {
    return 'system';
  }
}

export function setStoredTheme(p: ThemePreference): void {
  if (typeof window === 'undefined') return;
  try { localStorage.setItem(THEME_STORAGE_KEY, p); } catch { /* quota — non-critical */ }
}

export function resolveTheme(p: ThemePreference, prefersDark: boolean): 'light' | 'dark' {
  if (p === 'system') return prefersDark ? 'dark' : 'light';
  return p;
}

/** SSR/test-safe: sets <html data-theme> + the browser color-scheme. */
export function applyTheme(resolved: 'light' | 'dark'): void {
  if (typeof document === 'undefined' || !document.documentElement) return;
  document.documentElement.dataset.theme = resolved;
  document.documentElement.style.colorScheme = resolved;
}

/**
 * Inline bootstrap script for <head> — runs before first paint so a saved
 * dark preference doesn't flash light. Static constant, no user data.
 * Kept as a string so it can be injected with dangerouslySetInnerHTML.
 */
export const THEME_INIT_SCRIPT = `(function(){try{var k='${THEME_STORAGE_KEY}';var v=localStorage.getItem(k);var t=(v==='light'||v==='dark'||v==='system')?v:'system';var d=t==='system'?(window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches):t==='dark';var r=d?'dark':'light';document.documentElement.dataset.theme=r;document.documentElement.style.colorScheme=r;}catch(e){}})();`;
