import { describe, it, expect } from 'vitest';
import {
  validateThresholds, evaluateBudgetAlerts, visibleAlerts, newlyTriggered, pruneKeys,
} from '@/lib/budgetAlerts';

const T = { warning: 80, exceeded: 100 };

const input = (over: Partial<Parameters<typeof evaluateBudgetAlerts>[0]> = {}) => ({
  periodKey: '2026-06',
  overall: { budget: 20000, spent: 17000 }, // 85%
  categories: [
    { id: 'food', name: 'Dining & Food', budget: 8000, spent: 9000 },   // 112.5% exceeded
    { id: 'fun', name: 'Entertainment', budget: 5000, spent: 4100 },    // 82% warning
    { id: 'zero', name: 'No budget', budget: 0, spent: 500 },           // ignored
    { id: 'fine', name: 'Travel', budget: 10000, spent: 1000 },         // 10% ignored
  ],
  thresholds: T,
  ...over,
});

describe('validateThresholds', () => {
  it('accepts the defaults and sane values', () => {
    expect(validateThresholds(T)).toBeNull();
    expect(validateThresholds({ warning: 50, exceeded: 90 })).toBeNull();
  });
  it('rejects non-integers, out-of-range and inverted pairs', () => {
    expect(validateThresholds({ warning: 80.5, exceeded: 100 })).toBeTruthy();
    expect(validateThresholds({ warning: 0, exceeded: 100 })).toBeTruthy();
    expect(validateThresholds({ warning: 80, exceeded: 201 })).toBeTruthy();
    expect(validateThresholds({ warning: 100, exceeded: 100 })).toBeTruthy();
    expect(validateThresholds({ warning: 120, exceeded: 100 })).toBeTruthy();
  });
});

describe('evaluateBudgetAlerts', () => {
  it('emits one alert per breached scope, exceeded-first then pct desc', () => {
    const alerts = evaluateBudgetAlerts(input());
    expect(alerts.map(a => a.key)).toEqual([
      '2026-06:food:exceeded',   // 112.5%
      '2026-06:overall:warning', // 85%
      '2026-06:fun:warning',     // 82%
    ]);
    expect(alerts[0].scope).toBe('category');
    expect(alerts[0].pct).toBe(112.5);
    expect(alerts[1].name).toBe('Overall budget');
  });

  it('ignores zero budgets and under-warning scopes', () => {
    const alerts = evaluateBudgetAlerts(input());
    expect(alerts.some(a => a.scopeId === 'zero')).toBe(false);
    expect(alerts.some(a => a.scopeId === 'fine')).toBe(false);
  });

  it('only the highest level is emitted per scope', () => {
    const alerts = evaluateBudgetAlerts(input({ overall: { budget: 100, spent: 120 } }));
    expect(alerts.filter(a => a.scopeId === 'overall').map(a => a.level)).toEqual(['exceeded']);
  });

  it('handles null overall', () => {
    const alerts = evaluateBudgetAlerts(input({ overall: null }));
    expect(alerts.some(a => a.scope === 'overall')).toBe(false);
    expect(alerts).toHaveLength(2);
  });
});

describe('visibleAlerts', () => {
  const alerts = evaluateBudgetAlerts(input());

  it('hides an acknowledged alert by key', () => {
    const vis = visibleAlerts(alerts, ['2026-06:overall:warning']);
    expect(vis.map(a => a.scopeId)).toEqual(['food', 'fun']);
  });

  it('acknowledging exceeded hides that scope\'s warning too', () => {
    const vis = visibleAlerts(alerts, ['2026-06:food:exceeded']);
    expect(vis.some(a => a.scopeId === 'food')).toBe(false);
  });

  it('acknowledging warning does NOT hide a later exceeded', () => {
    const vis = visibleAlerts(alerts, ['2026-06:food:warning']);
    expect(vis.some(a => a.key === '2026-06:food:exceeded')).toBe(true);
  });
});

describe('newlyTriggered', () => {
  it('returns only alerts not already notified', () => {
    const alerts = evaluateBudgetAlerts(input());
    expect(newlyTriggered(alerts, ['2026-06:food:exceeded']).map(a => a.scopeId))
      .toEqual(['overall', 'fun']);
    expect(newlyTriggered(alerts, alerts.map(a => a.key))).toHaveLength(0);
  });
});

describe('pruneKeys', () => {
  it('keeps only keys whose period prefix is kept', () => {
    const keys = ['2026-06:food:warning', '2026-05:overall:exceeded', '2026-04:fun:warning', 'bogus'];
    expect(pruneKeys(keys, ['2026-06', '2026-05']))
      .toEqual(['2026-06:food:warning', '2026-05:overall:exceeded']);
  });
});
