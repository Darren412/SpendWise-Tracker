import { describe, it, expect, beforeEach } from 'vitest';
import {
  getStoredTheme, setStoredTheme, resolveTheme, applyTheme,
  THEME_STORAGE_KEY, THEME_INIT_SCRIPT,
} from '@/lib/theme';

beforeEach(() => {
  localStorage.clear();
  delete (globalThis as { document?: unknown }).document;
});

describe('stored theme', () => {
  it('round-trips preferences', () => {
    for (const p of ['light', 'dark', 'system'] as const) {
      setStoredTheme(p);
      expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe(p);
      expect(getStoredTheme()).toBe(p);
    }
  });

  it('invalid/missing stored value → system', () => {
    expect(getStoredTheme()).toBe('system');
    localStorage.setItem(THEME_STORAGE_KEY, 'neon');
    expect(getStoredTheme()).toBe('system');
  });
});

describe('resolveTheme', () => {
  it('explicit preference wins over the OS setting', () => {
    expect(resolveTheme('light', true)).toBe('light');
    expect(resolveTheme('dark', false)).toBe('dark');
  });
  it('system follows prefersDark', () => {
    expect(resolveTheme('system', true)).toBe('dark');
    expect(resolveTheme('system', false)).toBe('light');
  });
});

describe('applyTheme', () => {
  it('sets data-theme + colorScheme on documentElement', () => {
    const el = { dataset: {} as Record<string, string>, style: {} as Record<string, string> };
    (globalThis as { document?: unknown }).document = { documentElement: el };
    applyTheme('dark');
    expect(el.dataset.theme).toBe('dark');
    expect(el.style.colorScheme).toBe('dark');
    applyTheme('light');
    expect(el.dataset.theme).toBe('light');
  });

  it('is a no-op without a document', () => {
    expect(() => applyTheme('dark')).not.toThrow();
  });
});

describe('THEME_INIT_SCRIPT', () => {
  it('is a static, self-contained, try/catch-wrapped IIFE', () => {
    expect(THEME_INIT_SCRIPT).toContain('try');
    expect(THEME_INIT_SCRIPT).toContain(THEME_STORAGE_KEY);
    expect(THEME_INIT_SCRIPT).toContain('prefers-color-scheme');
    expect(THEME_INIT_SCRIPT).not.toContain('${'); // nothing interpolated at runtime
  });
});
