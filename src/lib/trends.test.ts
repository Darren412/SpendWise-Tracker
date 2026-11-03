import { describe, it, expect } from 'vitest';
import { budgetTrackedSpend, buildMonthlySeries, momChange, withMoM, categoryTrends } from '@/lib/trends';
import { Category, Expense, Income } from '@/types';

const cat = (id: string, name = id, type: 'expense' | 'income' = 'expense'): Category =>
  ({ id, name, color: '#000', icon: 'x', type });

const exp = (over: Partial<Expense>): Expense => ({
  id: over.id ?? 'e', category: 'food', description: 'x', amount: 100,
  date: '2026-03-05', month: '03', year: 2026, ...over,
});
const inc = (over: Partial<Income>): Income => ({
  id: over.id ?? 'i', source: 'x', amount: 500,
  date: '2026-03-05', month: '03', year: 2026, ...over,
});

// Financial cycle start 25: Feb 2026 period = Jan 25 – Feb 24
const CYCLE = 25;

const seriesOpts = (over: Partial<Parameters<typeof buildMonthlySeries>[2]> = {}) => ({
  endMonth: '04', endYear: 2026, months: 3,
  financialCycleStart: CYCLE,
  selectedCity: 'Both',
  excludedCategoryIds: [] as string[],
  budgetCategoryIds: [] as string[],
  getBudget: () => 0,
  today: '2026-04-10',
  ...over,
});

describe('budgetTrackedSpend', () => {
  it('sums only tracked categories', () => {
    const list = [exp({ amount: 100, category: 'a' }), exp({ amount: 50, category: 'b' }), exp({ amount: 25, category: 'a' })];
    expect(budgetTrackedSpend(list, ['a'])).toBe(125);
    expect(budgetTrackedSpend(list, ['a', 'b'])).toBe(175);
    expect(budgetTrackedSpend(list, [])).toBe(0);
    expect(budgetTrackedSpend(list, ['zz'])).toBe(0);
  });
});

describe('buildMonthlySeries', () => {
  const expenses = [
    exp({ id: 'f1', category: 'food', amount: 100, date: '2026-02-05', month: '02', year: 2026 }),
    exp({ id: 'f2', category: 'food', amount: 200, date: '2026-03-05', month: '03', year: 2026 }),
    exp({ id: 'r1', category: 'rent', amount: 900, date: '2026-03-10', month: '03', year: 2026, city: 'Mangalore' }),
    exp({ id: 'nocity', category: 'food', amount: 60, date: '2026-03-15', month: '03', year: 2026 }), // no city → Bangalore in Overview rule
    exp({ id: 'ap', category: 'food', amount: 300, date: '2026-04-02', month: '04', year: 2026 }),
    // date inside Apr period labelled differently still buckets by date
  ];
  const income = [
    inc({ id: 'i1', amount: 1000, date: '2026-02-01', month: '02', year: 2026 }),
    inc({ id: 'i2', amount: 1000, date: '2026-03-01', month: '03', year: 2026 }),
  ];

  it('builds oldest→newest month points with keys, labels and bounds', () => {
    const s = buildMonthlySeries(expenses, income, seriesOpts());
    expect(s.map(p => p.key)).toEqual(['2026-02', '2026-03', '2026-04']);
    expect(s[0].label).toBe("Feb '26");
    // cycle 25 → Feb period is Jan 25 – Feb 24
    expect(s[0].start).toBe('2026-01-25');
    expect(s[0].end).toBe('2026-02-24');
  });

  it('aggregates income unscoped and expenses scoped, computes savings/rate', () => {
    const s = buildMonthlySeries(expenses, income, seriesOpts());
    expect(s[0].income).toBe(1000);
    expect(s[0].expenses).toBe(100);
    expect(s[0].savings).toBe(900);
    expect(s[0].savingsRate).toBe(90);
    expect(s[1].expenses).toBe(200 + 900 + 60);
    expect(s[2].savingsRate).toBeNull(); // no income in Apr → null
    expect(s[2].expenses).toBe(300);
  });

  it('city scoping follows the Overview rule (missing city = Bangalore)', () => {
    const s = buildMonthlySeries(expenses, income, seriesOpts({ selectedCity: 'Mangalore' }));
    // Only the Mangalore expense remains in March
    expect(s[1].expenses).toBe(900);
    const blr = buildMonthlySeries(expenses, income, seriesOpts({ selectedCity: 'Bangalore' }));
    expect(blr[1].expenses).toBe(200 + 60); // city-less counts as Bangalore
  });

  it('excludedCategoryIds removes those expenses', () => {
    const s = buildMonthlySeries(expenses, income, seriesOpts({ excludedCategoryIds: ['rent'] }));
    expect(s[1].expenses).toBe(200 + 60);
    expect(s[1].byCategory['rent']).toBeUndefined();
  });

  it('budget fields from getBudget + budgetTrackedSpend (unscoped)', () => {
    const s = buildMonthlySeries(expenses, income, seriesOpts({
      budgetCategoryIds: ['food'],
      getBudget: (m) => (m === '03' ? 500 : 0),
    }));
    expect(s[1].budget).toBe(500);
    expect(s[1].budgetSpent).toBe(200 + 60); // only 'food', Mangalore 'rent' doesn't count anyway
    expect(s[1].budgetUsedPct).toBe(52);
    expect(s[0].budget).toBeNull();
    expect(s[0].budgetUsedPct).toBeNull();
  });

  it('isComplete/isCurrent against today', () => {
    const s = buildMonthlySeries(expenses, income, seriesOpts({ today: '2026-04-10' }));
    expect(s[0].isComplete).toBe(true);
    expect(s[1].isComplete).toBe(true);
    expect(s[2].isComplete).toBe(false);   // Apr period ends Apr 24 > Apr 10
    expect(s[2].isCurrent).toBe(true);
    expect(s[0].isCurrent).toBe(false);
  });

  it('txnCount counts scoped expenses + income', () => {
    const s = buildMonthlySeries(expenses, income, seriesOpts());
    expect(s[1].txnCount).toBe(3 + 1); // 3 scoped expenses + 1 income
  });
});

describe('momChange / withMoM', () => {
  it('momChange rounds to 1 decimal and handles zero baseline', () => {
    expect(momChange(110, 100)).toBe(10);
    expect(momChange(90, 100)).toBe(-10);
    expect(momChange(105.55, 100)).toBe(5.5); // float edge: 5.55*10 ≈ 55.49 → 5.5
    expect(momChange(100, 0)).toBeNull();
    expect(momChange(0, 0)).toBeNull();
  });

  it('withMoM adds deltas; first point nulls', () => {
    const pts = buildMonthlySeries(
      [exp({ amount: 100, date: '2026-02-05', month: '02', year: 2026 }),
       exp({ amount: 200, date: '2026-03-05', month: '03', year: 2026 })],
      [inc({ amount: 500, date: '2026-02-01', month: '02', year: 2026 })],
      seriesOpts()
    );
    const s = withMoM(pts);
    expect(s[0].expensesMoM).toBeNull();
    expect(s[1].expensesMoM).toBe(100);
    expect(s[2].expensesMoM).toBe(-100);
    expect(s[1].incomeMoM).toBe(-100);
  });
});

describe('categoryTrends', () => {
  it('returns per-category totals/avg/trend sorted desc', () => {
    const pts = buildMonthlySeries(
      [exp({ amount: 100, category: 'a', date: '2026-02-05', month: '02', year: 2026 }),
       exp({ amount: 50, category: 'b', date: '2026-02-05', month: '02', year: 2026 }),
       exp({ amount: 200, category: 'a', date: '2026-03-05', month: '03', year: 2026 }),
       exp({ amount: 40, category: 'b', date: '2026-04-05', month: '04', year: 2026 })],
      [],
      seriesOpts()
    );
    const trends = categoryTrends(pts, [cat('a', 'Alpha', 'expense'), cat('b', 'Beta', 'expense'), cat('inc', 'Inc', 'income')]);
    expect(trends.map(t => t.catId)).toEqual(['a', 'b']);
    expect(trends[0].values).toEqual([100, 200, 0]);
    expect(trends[0].total).toBe(300);
    expect(trends[0].avg).toBe(100);
    expect(trends[0].latestMoM).toBe(-100);   // 0 vs 200 → -100%? 0 vs 200: (0-200)/200 = -100
    expect(trends[0].trend).toBe('down');
    expect(trends[1].latestMoM).toBeNull();   // prev month (Mar) had 0 spend → no baseline
    expect(trends[1].trend).toBe('flat');
    // Income category excluded even if it had values
    expect(trends.some(t => t.catId === 'inc')).toBe(false);
  });
});

describe('balance-funded portions in the monthly series', () => {
  const mkExp = (amount: number, date: string, funding?: { source: 'budget' | 'balance' | 'split'; balanceAmount?: number }): Expense => ({
    id: `e-${date}-${amount}-${Math.random().toString(36).slice(2, 6)}`,
    category: 'food', description: 't', amount, date,
    month: date.slice(5, 7), year: +date.slice(0, 4), funding,
  });
  const mkInc = (amount: number, date: string): Income => ({
    id: `i-${date}`, source: 's', amount, date,
    month: date.slice(5, 7), year: +date.slice(0, 4),
  });
  const opts = {
    financialCycleStart: 1, selectedCity: 'Both', excludedCategoryIds: [] as string[],
    budgetCategoryIds: [] as string[], getBudget: () => 0, today: '2026-03-31',
    endMonth: '03', endYear: 2026, months: 1,
  };

  it('regular + major = actual; netCashFlow = income − actual', () => {
    const s = buildMonthlySeries([
      mkExp(60000, '2026-03-05'),                                            // regular
      mkExp(300000, '2026-03-10', { source: 'balance' }),                    // pure balance
      mkExp(10000, '2026-03-12', { source: 'split', balanceAmount: 4000 }),  // split 6k/4k
    ], [mkInc(100000, '2026-03-01')], opts);
    const p = s[0];
    expect(p.expenses).toBe(66000);        // regular portions only
    expect(p.majorExpenses).toBe(304000);
    expect(p.actualExpenses).toBe(370000);
    expect(p.netCashFlow).toBe(100000 - 370000);
    expect(p.savings).toBe(100000 - 66000); // operating = income − regular
    expect(p.byCategory['food']).toBe(66000);
  });

  it('pure-balance txns still count as transactions but not in byCategory', () => {
    const s = buildMonthlySeries([mkExp(50000, '2026-03-10', { source: 'balance' })], [], opts);
    expect(s[0].txnCount).toBe(1);
    expect(s[0].byCategory['food']).toBeUndefined();
    expect(s[0].expenses).toBe(0);
    expect(s[0].actualExpenses).toBe(50000);
  });
});
