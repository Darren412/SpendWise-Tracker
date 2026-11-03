import { describe, it, expect } from 'vitest';
import { occurrenceDates, occurrenceId, generateDue, nextOccurrence, resumeRule, mergeRecurringRules } from '@/lib/recurring';
import { RecurringRule } from '@/types';

const base: RecurringRule = {
  id: 'r1',
  type: 'expense',
  amount: 100,
  category: 'food',
  description: 'Groceries',
  frequency: 'monthly',
  startDate: '2026-01-15',
  paused: false,
  createdAt: '2026-01-01T00:00:00Z',
};

const rule = (over: Partial<RecurringRule>): RecurringRule => ({ ...base, ...over });

describe('occurrenceDates', () => {
  it('weekly steps every 7 days anchored on startDate', () => {
    const r = rule({ frequency: 'weekly', startDate: '2026-03-01' });
    expect(occurrenceDates(r, undefined, '2026-03-22')).toEqual([
      '2026-03-01', '2026-03-08', '2026-03-15', '2026-03-22',
    ]);
  });

  it('monthly keeps the anchor day-of-month', () => {
    const r = rule({ startDate: '2026-01-15' });
    expect(occurrenceDates(r, undefined, '2026-04-20')).toEqual([
      '2026-01-15', '2026-02-15', '2026-03-15', '2026-04-15',
    ]);
  });

  it('clamps to month end per occurrence without cumulative drift (Jan 31 → Feb 28 → Mar 31)', () => {
    const r = rule({ startDate: '2026-01-31' });
    expect(occurrenceDates(r, undefined, '2026-04-30')).toEqual([
      '2026-01-31', '2026-02-28', '2026-03-31', '2026-04-30',
    ]);
  });

  it('clamps Feb 29 on leap years then resumes Mar 31', () => {
    const r = rule({ startDate: '2028-01-31' });
    const dates = occurrenceDates(r, undefined, '2028-04-30');
    expect(dates).toEqual(['2028-01-31', '2028-02-29', '2028-03-31', '2028-04-30']);
  });

  it('quarterly and yearly step correctly', () => {
    expect(occurrenceDates(rule({ frequency: 'quarterly', startDate: '2026-01-10' }), undefined, '2027-01-10'))
      .toEqual(['2026-01-10', '2026-04-10', '2026-07-10', '2026-10-10', '2027-01-10']);
    expect(occurrenceDates(rule({ frequency: 'yearly', startDate: '2026-02-10' }), undefined, '2028-12-31'))
      .toEqual(['2026-02-10', '2027-02-10', '2028-02-10']);
  });

  it('respects afterExclusive and untilInclusive bounds', () => {
    const r = rule({ startDate: '2026-01-15' });
    expect(occurrenceDates(r, '2026-02-15', '2026-04-15')).toEqual(['2026-03-15', '2026-04-15']);
    expect(occurrenceDates(r, '2026-12-15', '2026-12-31')).toEqual([]);
  });

  it('respects endDate', () => {
    const r = rule({ startDate: '2026-01-15', endDate: '2026-03-20' });
    expect(occurrenceDates(r, undefined, '2026-12-31')).toEqual(['2026-01-15', '2026-02-15', '2026-03-15']);
  });

  it('returns [] when the interval is empty or before start', () => {
    expect(occurrenceDates(rule({ startDate: '2026-06-01' }), undefined, '2026-05-01')).toEqual([]);
  });

  it('hard-caps at 500 dates', () => {
    const r = rule({ frequency: 'weekly', startDate: '2000-01-01' });
    expect(occurrenceDates(r, undefined, '2099-12-31').length).toBe(500);
  });
});

describe('occurrenceId', () => {
  it('is deterministic', () => {
    expect(occurrenceId('abc', '2026-03-15')).toBe('rec_abc_20260315');
    expect(occurrenceId('abc', '2026-03-15')).toBe(occurrenceId('abc', '2026-03-15'));
  });
});

describe('generateDue', () => {
  it('generates a startDate-today occurrence exactly once even on repeat calls', () => {
    const rules = [rule({ startDate: '2026-11-03', description: 'Rent' })];
    const first = generateDue(rules, new Set(), '2026-11-03');
    expect(first.expenses).toHaveLength(1);
    expect(first.expenses[0].date).toBe('2026-11-03');
    expect(first.expenses[0].id).toBe(occurrenceId('r1', '2026-11-03'));
    expect(first.rules[0].generatedThrough).toBe('2026-11-03');

    // Second call with the generated ids present → nothing new
    const ids = new Set(first.expenses.map(e => e.id));
    const second = generateDue(first.rules, ids, '2026-11-03');
    expect(second.expenses).toHaveLength(0);
  });

  it('skips ids already existing (cross-device dedupe)', () => {
    const rules = [rule({ startDate: '2026-11-01', generatedThrough: undefined })];
    const existing = new Set([occurrenceId('r1', '2026-11-01')]);
    const due = generateDue(rules, existing, '2026-11-03');
    expect(due.expenses).toHaveLength(0);
    expect(due.rules[0].generatedThrough).toBe('2026-11-03'); // bound still advances
  });

  it('builds income rows with source = rule description', () => {
    const rules = [rule({ type: 'income', startDate: '2026-11-01', description: 'Salary', category: 'sal' })];
    const due = generateDue(rules, new Set(), '2026-11-01');
    expect(due.income).toHaveLength(1);
    expect(due.income[0].source).toBe('Salary');
    expect(due.income[0].recurringId).toBe('r1');
  });

  it('never generates future-dated transactions', () => {
    const rules = [rule({ startDate: '2026-11-10' })];
    expect(generateDue(rules, new Set(), '2026-11-03').expenses).toHaveLength(0);
  });

  it('paused rules are returned unchanged and generate nothing', () => {
    const paused = rule({ startDate: '2026-01-01', paused: true });
    const due = generateDue([paused], new Set(), '2026-12-31');
    expect(due.expenses).toHaveLength(0);
    expect(due.rules[0]).toBe(paused); // identity preserved
  });

  it('unchanged rules keep object identity in the output', () => {
    const upToDate = rule({ startDate: '2026-11-01', generatedThrough: '2026-11-03' });
    const due = generateDue([upToDate], new Set(), '2026-11-03');
    expect(due.rules[0]).toBe(upToDate);
  });

  it('endDate caps generation and advances the bound to endDate', () => {
    const rules = [rule({ startDate: '2026-10-01', endDate: '2026-10-15' })];
    const due = generateDue(rules, new Set(), '2026-12-31');
    expect(due.expenses.map(e => e.date)).toEqual(['2026-10-01']); // next monthly is past endDate
    expect(due.rules[0].generatedThrough).toBe('2026-10-15');
  });

  it('truncated runs continue next time instead of skipping the remainder', () => {
    // Weekly rule started ~11 years ago → >500 due dates at once
    const rules = [rule({ frequency: 'weekly', startDate: '2015-01-01' })];
    const first = generateDue(rules, new Set(), '2026-06-01');
    expect(first.expenses).toHaveLength(500);
    // Bound advanced to the last emitted date, NOT today's upper bound
    expect(first.rules[0].generatedThrough).toBe(first.expenses[499].date);
    expect(first.rules[0].generatedThrough! < '2026-06-01').toBe(true);

    const second = generateDue(first.rules, new Set(first.expenses.map(e => e.id)), '2026-06-01');
    expect(second.expenses.length).toBeGreaterThan(0);
    expect(second.expenses.length).toBeLessThan(200); // ~96 remaining weeks
    expect(second.rules[0].generatedThrough).toBe('2026-06-01');
    // No overlap between the two batches
    const firstIds = new Set(first.expenses.map(e => e.id));
    expect(second.expenses.every(e => !firstIds.has(e.id))).toBe(true);
    expect(second.expenses.every(e => e.date > first.expenses[499].date)).toBe(true);

    // Third run is a no-op
    const third = generateDue(second.rules, new Set([...firstIds, ...second.expenses.map(e => e.id)]), '2026-06-01');
    expect(third.expenses).toHaveLength(0);
  });

  it('resuming skips the paused gap but still generates an occurrence due today', () => {
    const resumed = resumeRule(
      rule({ startDate: '2026-01-01', paused: true, generatedThrough: '2026-02-01' }),
      '2026-06-01'
    );
    expect(resumed.paused).toBe(false);
    expect(resumed.generatedThrough).toBe('2026-05-31'); // floor = yesterday
    const due = generateDue([resumed], new Set(), '2026-06-01');
    // Feb–May occurrences skipped, but the June 1 occurrence IS generated
    expect(due.expenses.map(e => e.date)).toEqual(['2026-06-01']);
  });

  it('resume keeps a generatedThrough already ahead of the floor', () => {
    const resumed = resumeRule(
      rule({ paused: true, generatedThrough: '2026-07-15' }),
      '2026-06-01'
    );
    expect(resumed.generatedThrough).toBe('2026-07-15');
  });
});

describe('nextOccurrence', () => {
  it('returns the first occurrence after today', () => {
    const r = rule({ startDate: '2026-01-15' });
    expect(nextOccurrence(r, '2026-01-15')).toBe('2026-02-15');
    expect(nextOccurrence(r, '2026-01-14')).toBe('2026-01-15');
  });

  it('returns null past endDate', () => {
    const r = rule({ startDate: '2026-01-15', endDate: '2026-03-15' });
    expect(nextOccurrence(r, '2026-03-15')).toBeNull();
    expect(nextOccurrence(r, '2026-04-01')).toBeNull();
  });
});

describe('mergeRecurringRules', () => {
  it('keeps remote order, appends local-only rules', () => {
    const remote = [rule({ id: 'a' }), rule({ id: 'b' })];
    const local = [rule({ id: 'b' }), rule({ id: 'c' })];
    const merged = mergeRecurringRules(remote, local);
    expect(merged.map(r => r.id)).toEqual(['a', 'b', 'c']);
  });

  it('local fields win for shared ids', () => {
    const remote = [rule({ id: 'a', description: 'old', amount: 100 })];
    const local = [rule({ id: 'a', description: 'new', amount: 250 })];
    const merged = mergeRecurringRules(remote, local);
    expect(merged[0].description).toBe('new');
    expect(merged[0].amount).toBe(250);
  });

  it('generatedThrough takes the max — stale local bound cannot regress it', () => {
    const remote = [rule({ id: 'a', generatedThrough: '2026-06-01' })];
    const local = [rule({ id: 'a', generatedThrough: '2026-03-01', paused: true })];
    const merged = mergeRecurringRules(remote, local);
    expect(merged[0].generatedThrough).toBe('2026-06-01');
    expect(merged[0].paused).toBe(true); // local fields still win otherwise
  });

  it('generatedThrough survives when only one side has it', () => {
    expect(mergeRecurringRules(
      [rule({ id: 'a' })],
      [rule({ id: 'a', generatedThrough: '2026-01-01' })]
    )[0].generatedThrough).toBe('2026-01-01');
    expect(mergeRecurringRules(
      [rule({ id: 'a', generatedThrough: '2026-01-01' })],
      [rule({ id: 'a' })]
    )[0].generatedThrough).toBe('2026-01-01');
    expect(mergeRecurringRules([rule({ id: 'a' })], [rule({ id: 'a' })])[0].generatedThrough).toBeUndefined();
  });
});
