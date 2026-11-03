'use client';

import { useEffect, useState } from 'react';

/**
 * Chart palette resolved from the app's CSS custom properties so charts
 * follow the active theme (dark mode in Phase 4). Values are read live via
 * getComputedStyle with hardcoded light-theme fallbacks for SSR/tests.
 */
export interface ChartTheme {
  income: string;
  expenses: string;
  savings: string;
  forecast: string;
  forecastDim: string;
  axis: string;
  grid: string;
  text: string;
  textMuted: string;
  tooltipBg: string;
  tooltipBorder: string;
  tooltipText: string;
  budget: string;
  reserve: string;    // reserve-funded spend (distinct from regular expenses)
  series: string[];   // rotating palette for categorical series
}

const FALLBACKS = {
  income: '#16a34a',
  expenses: '#ef4444',
  savings: '#6366f1',
  axis: '#94a3b8',
  grid: '#e2e8f0',
  text: '#0f172a',
  textMuted: '#64748b',
  tooltipBg: '#ffffff',
  tooltipBorder: '#e2e8f0',
  budget: '#f59e0b',
};

export function getChartTheme(): ChartTheme {
  const get = (name: string, fallback: string): string => {
    if (typeof window === 'undefined') return fallback;
    const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return v || fallback;
  };
  const income = get('--green-600', FALLBACKS.income);
  const expenses = get('--red-500', FALLBACKS.expenses);
  const savings = get('--brand-600', FALLBACKS.savings);
  const budget = get('--amber-500', FALLBACKS.budget);
  return {
    income,
    expenses,
    savings,
    forecast: savings,
    forecastDim: 'rgba(99,102,241,0.35)',
    axis: get('--text-400', FALLBACKS.axis),
    grid: get('--bg-muted', FALLBACKS.grid),
    text: get('--text-900', FALLBACKS.text),
    textMuted: get('--text-400', FALLBACKS.textMuted),
    tooltipBg: get('--bg-surface', FALLBACKS.tooltipBg),
    tooltipBorder: get('--border-default', FALLBACKS.tooltipBorder),
    tooltipText: get('--text-900', FALLBACKS.text),
    budget,
    reserve: get('--amber-400', '#fbbf24'),
    series: [income, expenses, savings, budget, '#8b5cf6', '#06b6d4', '#ec4899', '#64748b'],
  };
}

/**
 * Reactive variant — re-resolves the palette when <html data-theme> flips,
 * so mounted charts update on theme change without a reload.
 */
export function useChartTheme(): ChartTheme {
  const [theme, setTheme] = useState<ChartTheme>(() => getChartTheme());
  useEffect(() => {
    const refresh = () => setTheme(getChartTheme());
    refresh();
    if (typeof MutationObserver === 'undefined' || !document.documentElement) return;
    const obs = new MutationObserver((muts) => {
      if (muts.some(m => m.attributeName === 'data-theme')) refresh();
    });
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => obs.disconnect();
  }, []);
  return theme;
}
