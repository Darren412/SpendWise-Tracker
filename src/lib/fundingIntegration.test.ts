import { describe, it, expect } from 'vitest';
import { Expense, Income, Category, OpeningBalanceBaseline } from '@/types';
import { buildMonthlySeries } from './trends';
import { buildBalanceLedger, availableBalanceOn } from './balance';
import { majorExpenseUsage } from './funding';
import { analyzeSavings } from './savings';

/**
 * Integration-style recalculation test: flipping a historical expense from
 * budget → existing balance must shift every derived view consistently while
 * leaving the actual-money totals untouched.
 */

const CAT: Category[] = [
  { id: 'dining', name: 'Dining', color: '#111', icon: '🍽️' },
  { id: 'fun', name: 'Movies', color: '#222', icon: '🎬' },
];

const BASELINE: OpeningBalanceBaseline = {
  startYear: 2026, amount: 1_000_000,
  effectiveDate: '2026-01-01', createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z',
};

const INCOME: Income[] = ['2026-01-01', '2026-02-01', '2026-03-01', '2026-04-01']
  .map((d, i) => ({ id: `inc${i}`, source: 'Salary', amount: 100_000, date: d, month: d.slice(5, 7), year: 2026 }));

const baseExpenses = (carFunding?: Expense['funding']): Expense[] => [
  { id: 'd1', category: 'dining', description: 'jan', amount: 5000, date: '2026-01-10', month: '01', year: 2026 },
  { id: 'd2', category: 'dining', description: 'feb', amount: 5000, date: '2026-02-10', month: '02', year: 2026 },
  { id: 'd3', category: 'dining', description: 'mar', amount: 5000, date: '2026-03-10', month: '03', year: 2026 },
  { id: 'd4', category: 'dining', description: 'apr', amount: 5000, date: '2026-04-10', month: '04', year: 2026 },
  { id: 'car', category: 'fun', description: 'Car down payment', amount: 300_000, date: '2026-04-15', month: '04', year: 2026, funding: carFunding },
];

const SERIES_OPTS = {
  financialCycleStart: 1, selectedCity: 'Both', excludedCategoryIds: [] as string[],
  budgetCategoryIds: [] as string[], getBudget: () => 0,
  endMonth: '04', endYear: 2026, months: 4, today: '2026-05-01',
};

const LEDGER_OPTS = { financialCycleStart: 1, throughYear: 2026, today: '2026-05-01' };
const LEDGER_INPUTS = { baseline: BASELINE, income: INCOME, financialCycleStart: 1 };

const savingsInput = (expenses: Expense[]) => ({
  expenses, categories: CAT, recurring: [], categoryBudgets: {},
  financialCycleStart: 1, selectedMonth: '04', selectedYear: 2026,
  selectedCity: 'Both', excludedCategoryIds: [], baselineWindow: 3 as const,
  today: '2026-05-01', dismissed: [], mutedCategoryIds: [], spendingTargets: {}, currency: 'INR',
});

describe('changing a historical expense budget → existing balance recalculates everything', () => {
  const asBudget = baseExpenses(undefined);
  const asBalance = baseExpenses({ source: 'balance' });

  const seriesBudget = buildMonthlySeries(asBudget, INCOME, SERIES_OPTS);
  const seriesBalance = buildMonthlySeries(asBalance, INCOME, SERIES_OPTS);
  const aprB = seriesBudget[3];
  const aprR = seriesBalance[3];

  const ledgerBudget = buildBalanceLedger(asBudget, INCOME, BASELINE, LEDGER_OPTS);
  const ledgerBalance = buildBalanceLedger(asBalance, INCOME, BASELINE, LEDGER_OPTS);

  it('trends: regular drops by the balance portion, actual is unchanged', () => {
    expect(aprB.expenses).toBe(305_000);
    expect(aprB.majorExpenses).toBe(0);
    expect(aprR.expenses).toBe(5_000);
    expect(aprR.majorExpenses).toBe(300_000);
    expect(aprR.actualExpenses).toBe(aprB.actualExpenses);   // 305,000
    expect(aprR.netCashFlow).toBe(aprB.netCashFlow);         // 100,000 − 305,000
    expect(aprR.savings).not.toBe(aprB.savings);             // operating ≠ net
    expect(aprR.savings).toBe(95_000);                       // income − regular
  });

  it('balance ledger: closings are identical (actual money is unchanged)', () => {
    const closing = (l: ReturnType<typeof buildBalanceLedger>) =>
      l.find(y => y.year === 2026)!.closing;
    expect(closing(ledgerBudget)).toBe(1_080_000); // 1,000,000 + 400,000 − 320,000
    expect(closing(ledgerBalance)).toBe(1_080_000);
    const yr = ledgerBalance.find(y => y.year === 2026)!;
    expect(yr.regularExpenses + yr.majorExpenses).toBe(yr.expenses);
  });

  it('available balance reflects the flip; usage reports only the funded parts', () => {
    const lB = { ...LEDGER_INPUTS, expenses: asBudget };
    const lR = { ...LEDGER_INPUTS, expenses: asBalance };
    expect(availableBalanceOn(lB, '2026-05-01')).toBe(1_080_000);
    expect(availableBalanceOn(lR, '2026-05-01')).toBe(1_080_000); // same money either way
    expect(majorExpenseUsage(asBalance, { from: '2026-01-01', to: '2026-12-31' }).total).toBe(300_000);
    expect(majorExpenseUsage(asBudget, { from: '2026-01-01', to: '2026-12-31' }).total).toBe(0);
  });

  it('savings analysis: the balance payment stops raising an opportunity', () => {
    const a1 = analyzeSavings(savingsInput(asBudget));
    const a2 = analyzeSavings(savingsInput(asBalance));
    if (a1.status !== 'ok' || a2.status !== 'ok') throw new Error('expected ok');
    // As a budget expense the ₹3,00,000 movie ticket inflates 'fun' to an
    // opportunity; as balance-funded it contributes nothing and is reported.
    expect(a1.opportunities.some(o => o.catId === 'fun')).toBe(true);
    expect(a2.opportunities.some(o => o.catId === 'fun')).toBe(false);
    expect(a2.majorOutflows).toHaveLength(1);
    expect(a2.majorOutflows[0].amount).toBe(300_000);
    expect(a1.majorOutflows).toHaveLength(0);
  });
});
