import { describe, it, expect } from 'vitest';
import {
  fundingSource, fundingParts, budgetPortionExpenses, validateFunding,
  buildReserveLedger, reserveBalance, reserveAvailableOn, reserveUsage,
  reserveCoverage, essentialMonthlyAverage, capReserveFunding, buildPositionSummary,
  ReserveTransfer,
} from './reserve';
import { Expense, Category } from '@/types';

let uid = 0;
const mkExp = (amount: number, date: string, over: Partial<Expense> = {}): Expense => ({
  id: `x${++uid}`, category: 'dining', description: 'e', amount, date,
  month: date.slice(5, 7), year: +date.slice(0, 4), ...over,
});
const mkT = (date: string, amount: number, direction: 'in' | 'out', note = ''): ReserveTransfer => ({
  id: `t${++uid}`, date, amount, direction, note, createdAt: `${date}T0${uid % 10}:00:00Z`,
});
const util = (id: string): Category => ({
  id, name: 'Rent & Utilities', color: '#f0f', icon: '🏠', type: 'expense', spendClass: 'essential',
});

describe('funding parts', () => {
  it('undefined funding ⇒ budget; reserve ⇒ full amount; split ⇒ exact sum', () => {
    expect(fundingSource(mkExp(100, '2026-01-10'))).toBe('budget');
    expect(fundingParts(mkExp(100, '2026-01-10'))).toEqual({ budget: 100, reserve: 0 });
    const car = mkExp(300000, '2026-03-05', { funding: { source: 'reserve' } });
    expect(fundingParts(car)).toEqual({ budget: 0, reserve: 300000 });
    // spec case: split 3,00,000 with 2,50,000 from reserve
    const split = mkExp(300000, '2026-03-05', { funding: { source: 'split', reserveAmount: 250000 } });
    const p = fundingParts(split);
    expect(p).toEqual({ budget: 50000, reserve: 250000 });
    expect(p.budget + p.reserve).toBe(300000);
  });

  it('rounding residue lands in the budget portion', () => {
    const p = fundingParts(mkExp(0.03, '2026-01-10', { funding: { source: 'split', reserveAmount: 0.01 } }));
    expect(p.budget + p.reserve).toBeCloseTo(0.03, 9);
    expect(p.reserve).toBe(0.01);
  });

  it('budgetPortionExpenses trims splits and drops pure-reserve rows', () => {
    const out = budgetPortionExpenses([
      mkExp(100, '2026-01-10'),
      mkExp(300, '2026-01-11', { funding: { source: 'split', reserveAmount: 250 } }),
      mkExp(500, '2026-01-12', { funding: { source: 'reserve' } }),
    ]);
    expect(out).toHaveLength(2);
    expect(out.map(e => e.amount)).toEqual([100, 50]);
  });
});

describe('validateFunding', () => {
  it('passes budget/reserve and valid splits; rejects bad splits', () => {
    expect(validateFunding({ amount: 100, source: 'budget' })).toBeNull();
    expect(validateFunding({ amount: 100, source: 'reserve' })).toBeNull();
    expect(validateFunding({ amount: 100, source: 'split', reserveAmount: 40 })).toBeNull();
    expect(validateFunding({ amount: 100, source: 'split' })).not.toBeNull();            // missing
    expect(validateFunding({ amount: 100, source: 'split', reserveAmount: 0 })).not.toBeNull();
    expect(validateFunding({ amount: 100, source: 'split', reserveAmount: 100 })).not.toBeNull();
    expect(validateFunding({ amount: 100, source: 'split', reserveAmount: 150 })).not.toBeNull();
    expect(validateFunding({ amount: 100, source: 'split', reserveAmount: 40.123 })).not.toBeNull();
  });
});

describe('reserve ledger', () => {
  it('spec case: in 6,00,000 then a 3,00,000 reserve-funded car ⇒ balance 3,00,000', () => {
    const ledger = buildReserveLedger(
      [mkT('2026-01-01', 600000, 'in')],
      [mkExp(300000, '2026-03-05', { description: 'Car down payment', funding: { source: 'reserve' } })],
    );
    expect(ledger).toHaveLength(2);
    expect(ledger[0].kind).toBe('in');
    expect(ledger[1].kind).toBe('spend');
    expect(reserveBalance(ledger)).toBe(300000);
    expect(reserveBalance(ledger, '2026-02-01')).toBe(600000); // before the spend
  });

  it('same-date order: in → spend → out; running balance never mis-orders', () => {
    const ledger = buildReserveLedger(
      [mkT('2026-02-10', 1000, 'out'), mkT('2026-02-10', 5000, 'in')],
      [mkExp(2000, '2026-02-10', { funding: { source: 'reserve' } })],
    );
    expect(ledger.map(e => e.kind)).toEqual(['in', 'spend', 'out']);
    expect(ledger.map(e => e.balanceAfter)).toEqual([5000, 3000, 2000]);
  });

  it('availableOn prevents a later negative: in 1,00,000 Jan 1 + spend 80,000 Mar 1 ⇒ Feb 1 available = 20,000', () => {
    const t = [mkT('2026-01-01', 100000, 'in')];
    const spend = mkExp(80000, '2026-03-01', { funding: { source: 'reserve' } });
    expect(reserveAvailableOn(t, [spend], '2026-02-01')).toBe(20000);
    // editing the existing spend can use the full balance
    expect(reserveAvailableOn(t, [spend], '2026-03-01', { excludeExpenseId: spend.id })).toBe(100000);
    // transfers out are constrained identically — an out that would drive a
    // later entry negative leaves nothing drawable on its date
    const out = mkT('2026-02-01', 90000, 'out');
    expect(reserveAvailableOn([...t, out], [spend], '2026-02-01')).toBe(0);
    // excluding the out restores availability
    expect(reserveAvailableOn([...t, out], [spend], '2026-02-01', { excludeTransferId: out.id })).toBe(20000);
  });

  it('usage: only reserve portions inside the range', () => {
    const u = reserveUsage([
      mkExp(1000, '2026-03-05'),
      mkExp(3000, '2026-03-10', { funding: { source: 'split', reserveAmount: 2000 } }),
      mkExp(500, '2026-03-20', { funding: { source: 'reserve' } }),
      mkExp(900, '2026-04-01', { funding: { source: 'reserve' } }),
    ], { from: '2026-03-01', to: '2026-03-31' });
    expect(u.total).toBe(2500);
    expect(u.count).toBe(2);
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
        mkExp(10000, '2026-05-11', { category: 'rent', month: '05', funding: { source: 'reserve' } }), // reserve portion ignored
      ],
      cats, opt,
    );
    expect(monthsUsed).toBe(3);
    expect(avg).toBe(20000); // (20k + 21k + 19k)/3 — reserve txn adds 0 budget portion
  });

  it('insufficient history (< 3 complete months) → null avg', () => {
    // history starts in May → only May + Jun are complete months since
    const { avg, monthsUsed } = essentialMonthlyAverage(
      threeMonthsEssential.slice(1), cats, opt,
    );
    expect(avg).toBeNull();
    expect(monthsUsed).toBe(2);
    // but a zero-spend month after history start still counts toward the 3
    const withZero = essentialMonthlyAverage(threeMonthsEssential, cats, opt);
    expect(withZero.monthsUsed).toBe(3);
  });

  it('coverage states', () => {
    expect(reserveCoverage(300000, 20000)).toEqual({ months: 15, status: 'ok' });
    expect(reserveCoverage(300000, null).status).toBe('insufficient-data');
    expect(reserveCoverage(300000, 0).status).toBe('no-essential-spend');
    expect(reserveCoverage(166000, 20000).months).toBe(8.3); // 1 decimal
  });
});

describe('capReserveFunding', () => {
  const mkExp = (over: Partial<Expense> & { funding?: Expense['funding'] } = {}): Expense => ({
    id: 'n1', category: 'c', description: 'd', amount: 1000, date: '2026-03-05',
    month: '03', year: 2026, ...over,
  });
  const transfer = (amt: number, date = '2026-01-01'): ReserveTransfer => ({
    id: `t-${amt}`, date, amount: amt, direction: 'in', createdAt: '',
  });

  it('keeps a fully covered reserve expense untouched', () => {
    const { expenses, notices } = capReserveFunding(
      [mkExp({ amount: 30000, funding: { source: 'reserve' } })], [transfer(60000)], []);
    expect(expenses[0].funding).toEqual({ source: 'reserve' });
    expect(notices).toEqual([]);
  });

  it('caps to split when reserve is short; converts to budget at 0', () => {
    const { expenses, notices } = capReserveFunding(
      [
        mkExp({ id: 'n1', amount: 50000, date: '2026-03-05', funding: { source: 'reserve' }, recurringId: 'r1' }),
        mkExp({ id: 'n2', amount: 10000, date: '2026-04-05', funding: { source: 'reserve' }, recurringId: 'r1' }),
      ], [transfer(60000)], []);
    // first fully covered (60k avail ≥ 50k); second's 10k reserve part is
    // exactly what remains → still fully funded, no notice
    expect(expenses[0].funding).toEqual({ source: 'reserve' });
    expect(expenses[1].funding).toEqual({ source: 'reserve' });
    expect(notices).toEqual([]);

    // A second run: existing spend consumed all 60k → a new 30k reserve
    // occurrence degrades to budget and notifies the full shortfall
    const { expenses: e2, notices: n2 } = capReserveFunding(
      [mkExp({ id: 'n3', amount: 30000, date: '2026-05-05', funding: { source: 'reserve' }, recurringId: 'r1' })],
      [transfer(60000)], [...expenses as Expense[]]);
    expect(e2[0].funding).toBeUndefined();
    expect(n2).toHaveLength(1);
    expect(n2[0].shortBy).toBe(30000);
    expect(n2[0].ruleId).toBe('r1');
  });

  it('existing spend counts toward availability; zero reserve → budget', () => {
    const existing = [mkExp({ id: 'old', amount: 60000, date: '2026-02-01', funding: { source: 'reserve' } })];
    const { expenses, notices } = capReserveFunding(
      [mkExp({ id: 'n1', amount: 5000, date: '2026-03-05', funding: { source: 'reserve' }, recurringId: 'r2' })],
      [transfer(60000)], existing);
    expect(expenses[0].funding).toBeUndefined();
    expect(notices).toHaveLength(1);
    expect(notices[0].shortBy).toBe(5000);
  });

  it('split occurrences keep their budget part and cap only the reserve part', () => {
    const { expenses, notices } = capReserveFunding(
      [mkExp({ id: 'n1', amount: 30000, date: '2026-03-05', funding: { source: 'split', reserveAmount: 25000 }, recurringId: 'r3' })],
      [transfer(10000)], []);
    expect(expenses[0].funding).toEqual({ source: 'split', reserveAmount: 10000 });
    expect(notices[0].shortBy).toBe(15000);
  });
});

describe('buildPositionSummary', () => {
  const fmt = (v: number) => `₹${v.toLocaleString('en-IN')}`;

  it('reproduces the spec test case sentences', () => {
    const lines = buildPositionSummary({
      monthlyBudget: 80000, operatingSurplus: 40000, regularSpend: 60000,
      reserveUsed: 300000, majorCount: 1, reserveBalance: 300000,
      overallBalance: 740000, format: fmt,
    });
    expect(lines).toEqual([
      'Your normal monthly budget remains within plan with a ₹40,000 operating surplus.',
      'You used ₹3,00,000 from your Reserve for a major expense. Your remaining Reserve is ₹3,00,000.',
      'Your actual overall balance is now ₹7,40,000.',
    ]);
  });

  it('over-plan and deficit variants', () => {
    const over = buildPositionSummary({
      monthlyBudget: 50000, operatingSurplus: -20000, regularSpend: 90000,
      reserveUsed: 0, majorCount: 0, reserveBalance: 0, overallBalance: null, format: fmt,
    });
    expect(over).toEqual(['Your normal monthly budget is ₹40,000 over plan.']);

    const deficit = buildPositionSummary({
      monthlyBudget: null, operatingSurplus: -5000,
      reserveUsed: 0, majorCount: 0, reserveBalance: 0, overallBalance: null, format: fmt,
    });
    expect(deficit).toEqual(['Your month shows a ₹5,000 operating deficit.']);
  });

  it('pluralises and omits inapplicable lines', () => {
    const lines = buildPositionSummary({
      monthlyBudget: null, operatingSurplus: 1000,
      reserveUsed: 80000, majorCount: 3, reserveBalance: 20000,
      overallBalance: null, format: fmt,
    });
    expect(lines[1]).toContain('for 3 major expenses');
    expect(lines).toHaveLength(2); // no overall-balance line without a baseline
  });
});
