'use client';

import { useEffect, useMemo, useState } from 'react';
import { useBudgetStore } from '@/store/budgetStore';
import { applyTheme, resolveTheme, ThemePreference } from '@/lib/theme';

export interface UseTheme {
  preference: ThemePreference;
  resolved: 'light' | 'dark';
  setPreference: (p: ThemePreference) => void;
}

/**
 * Theme state + side effects. Applies the resolved theme to <html> whenever
 * the preference or the OS scheme changes (latter only matters for
 * 'system'). Mount once near the root so it also runs on the login and
 * reset-password pages.
 */
export function useTheme(): UseTheme {
  const { themePreference, setThemePreference } = useBudgetStore();

  const [prefersDark, setPrefersDark] = useState<boolean>(() =>
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia('(prefers-color-scheme: dark)').matches
      : false);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const mql = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = (e: MediaQueryListEvent) => setPrefersDark(e.matches);
    mql.addEventListener?.('change', onChange);
    return () => mql.removeEventListener?.('change', onChange);
  }, []);

  const resolved = useMemo(() => resolveTheme(themePreference, prefersDark), [themePreference, prefersDark]);

  useEffect(() => {
    applyTheme(resolved);
  }, [resolved]);

  return { preference: themePreference, resolved, setPreference: setThemePreference };
}
