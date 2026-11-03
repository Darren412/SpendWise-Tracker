import { describe, it, expect } from 'vitest';
import { goalProgress, validateGoal, sortGoals } from '@/lib/goals';
import { SavingsGoal } from '@/types';

const goal = (over: Partial<SavingsGoal>): SavingsGoal => ({
  id: 'g', name: 'G', targetAmount: 1000, savedAmount: 0,
  archived: false, createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z',
  ...over,
});

describe('goalProgress', () => {
  it('pct is clamped 0–100 with 1 decimal', () => {
    expect(goalProgress(goal({ savedAmount: 333 }), '2026-06-01').pct).toBe(33.3);
    expect(goalProgress(goal({ savedAmount: 5000 }), '2026-06-01').pct).toBe(100);
    expect(goalProgress(goal({ savedAmount: -50 }), '2026-06-01').pct).toBe(0);
  });

  it('target 0 → pct 0, not complete', () => {
    const p = goalProgress(goal({ targetAmount: 0, savedAmount: 100 }), '2026-06-01');
    expect(p.pct).toBe(0);
    expect(p.isComplete).toBe(false);
  });

  it('complete when saved ≥ target', () => {
    const p = goalProgress(goal({ savedAmount: 1000, targetDate: '2026-12-01' }), '2026-06-01');
    expect(p.isComplete).toBe(true);
    expect(p.status).toBe('completed');
    expect(p.remaining).toBe(0);
    expect(p.requiredPerMonth).toBeNull();
  });

  it('overdue when target date passed and incomplete', () => {
    const p = goalProgress(goal({ savedAmount: 200, targetDate: '2026-05-01' }), '2026-06-01');
    expect(p.status).toBe('overdue');
    expect(p.daysLeft).toBe(-31);
    expect(p.monthsLeft).toBeNull();
    expect(p.requiredPerMonth).toBeNull();
    expect(p.remaining).toBe(800);
  });

  it('no-deadline when no target date', () => {
    const p = goalProgress(goal({ savedAmount: 200 }), '2026-06-01');
    expect(p.status).toBe('no-deadline');
    expect(p.daysLeft).toBeNull();
    expect(p.requiredPerMonth).toBeNull();
  });

  it('active goal computes days/months/required-per-month', () => {
    // today 2026-06-01 → 2026-09-01 is 92 days → ceil(92/30.44) = 4 months
    const p = goalProgress(goal({ savedAmount: 200, targetDate: '2026-09-01' }), '2026-06-01');
    expect(p.status).toBe('active');
    expect(p.daysLeft).toBe(92);
    expect(p.monthsLeft).toBe(4);
    expect(p.requiredPerMonth).toBe(200); // 800 / 4
  });

  it('target date today → monthsLeft 1, required = full remaining', () => {
    const p = goalProgress(goal({ savedAmount: 300, targetDate: '2026-06-01' }), '2026-06-01');
    expect(p.daysLeft).toBe(0);
    expect(p.monthsLeft).toBe(1);
    expect(p.requiredPerMonth).toBe(700);
  });

  it('short windows floor monthsLeft at 1', () => {
    const p = goalProgress(goal({ savedAmount: 500, targetDate: '2026-06-10' }), '2026-06-01');
    expect(p.daysLeft).toBe(9);
    expect(p.monthsLeft).toBe(1);
    expect(p.requiredPerMonth).toBe(500);
  });
});

describe('validateGoal', () => {
  const ok = { name: 'Vacation', targetAmount: 50000, savedAmount: 1000, targetDate: '2027-01-01' };

  it('accepts a valid new goal', () => {
    expect(validateGoal(ok, '2026-06-01', { isNew: true })).toEqual({});
  });

  it('name required, trimmed, ≤60 chars', () => {
    expect(validateGoal({ ...ok, name: '   ' }, '2026-06-01', { isNew: true }).name).toBeTruthy();
    expect(validateGoal({ ...ok, name: 'x'.repeat(61) }, '2026-06-01', { isNew: true }).name).toBeTruthy();
    expect(validateGoal({ ...ok, name: 'x'.repeat(60) }, '2026-06-01', { isNew: true }).name).toBeUndefined();
  });

  it('target must be > 0 and finite; saved ≥ 0 and finite', () => {
    expect(validateGoal({ ...ok, targetAmount: 0 }, '2026-06-01', { isNew: true }).targetAmount).toBeTruthy();
    expect(validateGoal({ ...ok, targetAmount: -5 }, '2026-06-01', { isNew: true }).targetAmount).toBeTruthy();
    expect(validateGoal({ ...ok, targetAmount: NaN }, '2026-06-01', { isNew: true }).targetAmount).toBeTruthy();
    expect(validateGoal({ ...ok, savedAmount: -1 }, '2026-06-01', { isNew: true }).savedAmount).toBeTruthy();
  });

  it('saved > target is allowed (shows complete)', () => {
    expect(validateGoal({ ...ok, savedAmount: 99999 }, '2026-06-01', { isNew: true })).toEqual({});
  });

  it('targetDate must be valid and, when new, ≥ today', () => {
    expect(validateGoal({ ...ok, targetDate: '2026-13-40' }, '2026-06-01', { isNew: true }).targetDate).toBeTruthy();
    expect(validateGoal({ ...ok, targetDate: '2026-02-30' }, '2026-06-01', { isNew: true }).targetDate).toBeTruthy();
    expect(validateGoal({ ...ok, targetDate: '2026-05-01' }, '2026-06-01', { isNew: true }).targetDate).toBeTruthy();
    // Editing an existing goal may keep a past date
    expect(validateGoal({ ...ok, targetDate: '2026-05-01' }, '2026-06-01', { isNew: false }).targetDate).toBeUndefined();
    expect(validateGoal({ ...ok, targetDate: '2026-06-01' }, '2026-06-01', { isNew: true }).targetDate).toBeUndefined();
  });
});

describe('sortGoals', () => {
  it('active (soonest date first) → completed → archived', () => {
    const goals = [
      goal({ id: 'arch', archived: true, createdAt: '2026-01-01T00:00:00Z' }),
      goal({ id: 'late', targetDate: '2027-12-01', createdAt: '2026-01-02T00:00:00Z' }),
      goal({ id: 'done', savedAmount: 1000, targetDate: '2026-03-01' }),
      goal({ id: 'soon', targetDate: '2026-07-01' }),
      goal({ id: 'nodate', createdAt: '2025-05-05T00:00:00Z' }),
    ];
    const sorted = sortGoals(goals).map(g => g.id);
    expect(sorted).toEqual(['soon', 'late', 'nodate', 'done', 'arch']);
  });

  it('does not mutate input', () => {
    const goals = [goal({ id: 'b' }), goal({ id: 'a', targetDate: '2026-01-01' })];
    const copy = [...goals];
    sortGoals(goals);
    expect(goals).toEqual(copy);
  });
});
