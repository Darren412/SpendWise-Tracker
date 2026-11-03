import { describe, it, expect } from 'vitest';
import {
  fundingSource, fundingParts, budgetPortionExpenses, validateFunding,
  majorExpenseUsage, balanceCoverage, essentialMonthlyAverage,
  capBalanceFunding, buildPositionSummary, BalanceLedgerInputs,
} from './funding';
import { availableBalanceOn } from './balance';
import { Expense, Income, Category, OpeningBalanceBaseline } from '@/types';

let uid = 0;
const mkExp = (amount: number, date: string, over: Partial<Expense> = {}): Expense => ({
  id: `x${++uid}`, category: 'dining', description: 'e', amount, date,
  month: date.slice(5, 7), year: +date.slice(0, 4), ...over,
});
const mkInc = (amount: number, date: string): Income => ({
  id: `i${++uid}`, source: 'Salary', amount, date,
  month: date.slice(5, 7), year: +date.slice(0, 4),
});
const util = (id: string): Category => ({
  id, name: 'Rent & Utilities', color: '#f0f', icon: '🏠', type: 'expense', spendClass: 'essential',
});

const BASELINE: OpeningBalanceBaseline = {
  startYear: 2026, amount: 1_000_000,
  effectiveDate: '2026-01-01', createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z',
};
const li = (expenses: Expense[], income: Income[] = [], baseline: OpeningBalanceBaseline | null = BASELINE): BalanceLedgerInputs =>
  ({ baseline, expenses, income, financialCycleStart: 1 });

describe('funding parts', () => {
  it('undefined funding ⇒ budget; balance ⇒ full amount; split ⇒ exact sum', () => {
    expect(fundingSource(mkExp(100, '2026-01-10'))).toBe('budget');
    expect(fundingParts(mkExp(100, '2026-01-10'))).toEqual({ budget: 100, balance: 0 });
    const car = mkExp(300000, '2026-03-05', { funding: { source: 'balance' } });
    expect(fundingParts(car)).toEqual({ budget: 0, balance: 300000 });
    // spec case: split 3,00,000 with 2,50,000 from the existing balance
    const split = mkExp(300000, '2026-03-05', { funding: { source: 'split', balanceAmount: 250000 } });
    const p = fundingParts(split);
    expect(p).toEqual({ budget: 50000, balance: 250000 });
    expect(p.budget + p.balance).toBe(300000);
  });

  it('normalises legacy reserve naming', () => {
    const legacy = mkExp(100, '2026-01-10', { funding: { source: 'reserve' as 'balance' } });
    expect(fundingSource(legacy)).toBe('balance');
    expect(fundingParts(legacy)).toEqual({ budget: 0, balance: 100 });
    const legacySplit = mkExp(100, '2026-01-10', { funding: { source: 'split', reserveAmount: 40 } });
    expect(fundingParts(legacySplit)).toEqual({ budget: 60, balance: 40 });
  });

  it('rounding residue lands in the budget portion', () => {
    const p = fundingParts(mkExp(0.03, '2026-01-10', { funding: { source: 'split', balanceAmount: 0.01 } }));
    expect(p.budget + p.balance).toBeCloseTo(0.03, 9);
    expect(p.balance).toBe(0.01);
  });

  it('budgetPortionExpenses trims splits and drops pure-balance rows', () => {
    const out = budgetPortionExpenses([
      mkExp(100, '2026-01-10'),
      mkExp(300, '2026-01-11', { funding: { source: 'split', balanceAmount: 250 } }),
      mkExp(500, '2026-01-12', { funding: { source: 'balance' } }),
    ]);
    expect(out).toHaveLength(2);
    expect(out.map(e => e.amount)).toEqual([100, 50]);
  });
});

describe('validateFunding', () => {
  it('passes budget/balance and valid splits; rejects bad splits', () => {
    expect(validateFunding({ amount: 100, source: 'budget' })).toBeNull();
    expect(validateFunding({ amount: 100, source: 'balance' })).toBeNull();
    expect(validateFunding({ amount: 100, source: 'split', balanceAmount: 40 })).toBeNull();
    expect(validateFunding({ amount: 100, source: 'split' })).not.toBeNull();            // missing
    expect(validateFunding({ amount: 100, source: 'split', balanceAmount: 0 })).not.toBeNull();
    expect(validateFunding({ amount: 100, source: 'split', balanceAmount: 100 })).not.toBeNull();
    expect(validateFunding({ amount: 100, source: 'split', balanceAmount: 150 })).not.toBeNull();
    expect(validateFunding({ amount: 100, source: 'split', balanceAmount: 40.123 })).not.toBeNull();
  });
});

describe('majorExpenseUsage', () => {
  it('only balance portions inside the range', () => {
    const u = majorExpenseUsage([
      mkExp(1000, '2026-03-05'),
      mkExp(3000, '2026-03-10', { funding: { source: 'split', balanceAmount: 2000 } }),
      mkExp(500, '2026-03-20', { funding: { source: 'balance' } }),
      mkExp(900, '2026-04-01', { funding: { source: 'balance' } }),
    ], { from: '2026-03-01', to: '2026-03-31' });
    expect(u.total).toBe(2500);
    expect(u.count).toBe(2);
  });
});

describe('availableBalanceOn', () => {
  it('spec case: 10,00,000 + 1,00,000 − 60,000 ⇒ 10,40,000; after a 3,00,000 car ⇒ 7,40,000', () => {
    const expenses = [mkExp(60000, '2026-01-10'), mkExp(300000, '2026-03-05', { funding: { source: 'balance' } })];
    const income = [mkInc(100000, '2026-01-01')];
    expect(availableBalanceOn(li(expenses, income), '2026-02-01')).toBe(1_040_000);
    expect(availableBalanceOn(li(expenses, income), '2026-03-31')).toBe(740_000);
  });

  it('ignores txns after the date and before the effectiveDate; honours exclusion', () => {
    const expenses = [
      mkExp(60000, '2026-01-10'),
      mkExp(300000, '2026-03-05', { id: 'car', funding: { source: 'balance' } }),
      mkExp(10000, '2025-12-31', { year: 2025, month: '12' }), // pre-baseline year — ignored
    ];
    const l = li(expenses, [mkInc(50000, '2026-01-01')]);
    expect(availableBalanceOn(l, '2026-01-31')).toBe(990_000);           // 1,000,000 + 50,000 − 60,000
    expect(availableBalanceOn(l, '2026-03-05', { excludeExpenseId: 'car' })).toBe(990_000);
    // editing the car on its own date can draw the balance without the car
    expect(availableBalanceOn(l, '2026-03-05')).toBe(690_000);
  });

  it('returns null without a baseline', () => {
    expect(availableBalanceOn(li([], [], null), '2026-03-01')).toBeNull();
  });
});

describe('essential monthly average + coverage', () => {
  const cats: Category[] = [
    util('rent'),
    { id: 'dining', name: 'Dining', color: '#0f0', icon: '🍽️', type: 'expense', spendClass: 'discretionary' },
  ];
  const opt = { financialCycleStart: 1, today: '2026-07-15' };

  const threeMonthsEssential: Expense[] = [
    mkExp(20000, '2026-04-10', { category: 'rent', month: '04' }),
    mkExp(21000, '2026-05-10', { category: 'rent', month: '05' }),
    mkExp(19000, '2026-06-10', { category: 'rent', month: '06' }),
  ];

  it('averages essential budget portions over the last 3 complete months', () => {
    const { avg, monthsUsed } = essentialMonthlyAverage(
      [...threeMonthsEssential,
        mkExp(4000, '2026-04-11', { month: '04' }),                              // discretionary — ignored
        mkExp(10000, '2026-05-11', { category: 'rent', month: '05', funding: { source: 'balance' } }), // balance portion ignored
      ],
      cats, opt,
    );
    expect(monthsUsed).toBe(3);
    expect(avg).toBe(20000); // (20k + 21k + 19k)/3 — balance-funded txn adds 0 budget portion
  });

  it('insufficient history (< 3 complete months) → null avg', () => {
    const { avg, monthsUsed } = essentialMonthlyAverage(
      threeMonthsEssential.slice(1), cats, opt,
    );
    expect(avg).toBeNull();
    expect(monthsUsed).toBe(2);
    const withZero = essentialMonthlyAverage(threeMonthsEssential, cats, opt);
    expect(withZero.monthsUsed).toBe(3);
  });

  it('coverage states', () => {
    expect(balanceCoverage(300000, 20000)).toEqual({ months: 15, status: 'ok' });
    expect(balanceCoverage(300000, null).status).toBe('insufficient-data');
    expect(balanceCoverage(300000, 0).status).toBe('no-essential-spend');
    expect(balanceCoverage(166000, 20000).months).toBe(8.3); // 1 decimal
  });
});

describe('capBalanceFunding', () => {
  const mkTxn = (over: Partial<Expense> = {}): Expense => ({
    id: 'n1', category: 'c', description: 'd', amount: 1000, date: '2026-03-05',
    month: '03', year: 2026, ...over,
  });
  const base = { baseline: BASELINE, income: [] as Income[], financialCycleStart: 1 };

  it('keeps a fully covered balance expense untouched', () => {
    const { expenses, notices } = capBalanceFunding(
      [mkTxn({ amount: 30000, funding: { source: 'balance' } })],
      { ...base, expenses: [] });
    expect(expenses[0].funding).toEqual({ source: 'balance' });
    expect(notices).toEqual([]);
  });

  it('caps to split when the balance is short; converts to budget at 0', () => {
    const prior = [mkTxn({ id: 'old', amount: 990_000, date: '2026-02-01' })];
    const { expenses, notices } = capBalanceFunding(
      [mkTxn({ id: 'n1', amount: 50000, date: '2026-03-05', funding: { source: 'balance' }, recurringId: 'r1' })],
      { ...base, expenses: prior });
    // 10,000 available → 40,000 short → split 40k budget + 10k balance
    expect(expenses[0].funding).toEqual({ source: 'split', balanceAmount: 10000 });
    expect(notices).toHaveLength(1);
    expect(notices[0].shortBy).toBe(40000);
    expect(notices[0].ruleId).toBe('r1');

    // Balance fully consumed → degrades to plain budget
    const { expenses: e2, notices: n2 } = capBalanceFunding(
      [mkTxn({ id: 'n2', amount: 5000, date: '2026-04-05', funding: { source: 'balance' }, recurringId: 'r1' })],
      { ...base, expenses: [mkTxn({ id: 'old', amount: 1_000_000, date: '2026-02-01' })] });
    expect(e2[0].funding).toBeUndefined();
    expect(n2[0].shortBy).toBe(5000);
  });

  it('occurrences generated earlier in the run count toward availability', () => {
    const { expenses, notices } = capBalanceFunding(
      [
        mkTxn({ id: 'n1', amount: 800_000, date: '2026-03-05', funding: { source: 'balance' }, recurringId: 'r1' }),
        mkTxn({ id: 'n2', amount: 300_000, date: '2026-04-05', funding: { source: 'balance' }, recurringId: 'r1' }),
      ],
      { ...base, expenses: [] });
    expect(expenses[0].funding).toEqual({ source: 'balance' });          // 800k ≤ 1M
    expect(expenses[1].funding).toEqual({ source: 'split', balanceAmount: 200_000 }); // only 200k left
    expect(notices).toHaveLength(1);
    expect(notices[0].shortBy).toBe(100_000);
  });

  it('no baseline → nothing is capped', () => {
    const { expenses, notices } = capBalanceFunding(
      [mkTxn({ amount: 5_000_000, funding: { source: 'balance' } })],
      { baseline: null, expenses: [], income: [], financialCycleStart: 1 });
    expect(expenses[0].funding).toEqual({ source: 'balance' });
    expect(notices).toEqual([]);
  });
});

describe('buildPositionSummary', () => {
  const fmt = (v: number) => `₹${v.toLocaleString('en-IN')}`;

  it('reproduces the spec test case sentences', () => {
    const lines = buildPositionSummary({
      monthlyBudget: 80000, operatingSurplus: 40000, regularSpend: 60000,
      majorUsed: 300000, majorCount: 1,
      overallBalance: 740000, format: fmt,
    });
    expect(lines).toEqual([
      'Your normal monthly budget remains within plan with a ₹40,000 operating surplus.',
      'You paid ₹3,00,000 for a major expense from your existing balance.',
      'Your actual overall balance is now ₹7,40,000.',
    ]);
  });

  it('over-plan and deficit variants', () => {
    const over = buildPositionSummary({
      monthlyBudget: 50000, operatingSurplus: -20000, regularSpend: 90000,
      majorUsed: 0, majorCount: 0, overallBalance: null, format: fmt,
    });
    expect(over).toEqual(['Your normal monthly budget is ₹40,000 over plan.']);

    const deficit = buildPositionSummary({
      monthlyBudget: null, operatingSurplus: -5000,
      majorUsed: 0, majorCount: 0, overallBalance: null, format: fmt,
    });
    expect(deficit).toEqual(['Your month shows a ₹5,000 operating deficit.']);
  });

  it('pluralises and omits inapplicable lines', () => {
    const lines = buildPositionSummary({
      monthlyBudget: null, operatingSurplus: 1000,
      majorUsed: 80000, majorCount: 3,
      overallBalance: null, format: fmt,
    });
    expect(lines[1]).toBe('You paid ₹80,000 for 3 major expenses from your existing balance.');
    expect(lines).toHaveLength(2); // no overall-balance line without a baseline
  });
});
