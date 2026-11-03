import { describe, it, expect } from 'vitest';
import { targetProgress, TargetPeriodHistory } from './savingsTargets';
import { SpendingTarget } from '@/types';

const T = (over: Partial<SpendingTarget> = {}): SpendingTarget => ({
  target: 4000, baselineMonthly: 5000,
  createdAt: '2026-04-10T10:00:00Z', createdForPeriod: '2026-04',
  ...over,
});

const H: TargetPeriodHistory[] = [
  { key: '2026-04', label: "Apr '26", start: '2026-04-01', amount: 4200, isComplete: true },
  { key: '2026-05', label: "May '26", start: '2026-05-01', amount: 3800, isComplete: true },
  { key: '2026-06', label: "Jun '26", start: '2026-06-01', amount: 5200, isComplete: true },
  { key: '2026-07', label: "Jul '26", start: '2026-07-01', amount: 2100, isComplete: false },
];

describe('targetProgress', () => {
  it('computes spent/remaining/status and month-end projection', () => {
    const p = targetProgress(T(), 2100, 0.5, H);
    expect(p.spent).toBe(2100);
    expect(p.remaining).toBe(1900);
    expect(p.usedPct).toBeCloseTo(52.5);
    expect(p.status).toBe('on-track');
    expect(p.projected).toBe(4200);
  });

  it('status thresholds: approaching ≥80, over ≥100', () => {
    expect(targetProgress(T(), 3200, 1, []).status).toBe('approaching'); // 80%
    expect(targetProgress(T(), 4000, 1, []).status).toBe('over');        // 100%
    expect(targetProgress(T(), 5000, 1, []).remaining).toBe(0);
  });

  it('achieved savings count only complete periods started after createdAt', () => {
    const p = targetProgress(T(), 2100, 0.5, H);
    // Apr 1 started before createdAt Apr 10 → excluded (was already in progress)
    // May (saved 1200) + Jun (saved −200) count; Jul in progress → excluded
    expect(p.achievedSavings).toEqual([
      { periodKey: '2026-05', label: "May '26", saved: 1200 },
      { periodKey: '2026-06', label: "Jun '26", saved: -200 },
    ]);
    expect(p.totalAchieved).toBe(1000);
  });
});
