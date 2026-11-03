import { describe, it, expect } from 'vitest';
import {
  buildBalanceLedger, getYearBalance, defaultEffectiveDate, validateBaseline,
} from './balance';
import { Expense, Income, OpeningBalanceBaseline } from '@/types';

let uid = 0;
const mkExp = (amount: number, date: string, month: string, year: number): Expense => ({
  id: `x${++uid}`, category: 'groc', amount, date, month, year, description: 'exp',
});
const mkInc = (amount: number, date: string, month: string, year: number): Income => ({
  id: `i${++uid}`, source: 'Salary', amount, date, month, year,
});

const mkBaseline = (over: Partial<OpeningBalanceBaseline> = {}): OpeningBalanceBaseline => ({
  startYear: 2026,
  amount: 500000,
  effectiveDate: '2026-01-01',
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
  ...over,
});

const OPTS = { financialCycleStart: 1, throughYear: 2028, today: '2028-12-31' };

/** Spec example: 2026 open 5L +12L −9L = 8L; 2027 +13L −10L = 11L; 2028 open 11L */
const specExpenses: Expense[] = [
  ...Array.from({ length: 12 }, (_, i) => mkExp(900000 / 12, `2026-${String(i + 1).padStart(2, '0')}-10`, String(i + 1).padStart(2, '0'), 2026)),
  ...Array.from({ length: 12 }, (_, i) => mkExp(1000000 / 12, `2027-${String(i + 1).padStart(2, '0')}-10`, String(i + 1).padStart(2, '0'), 2027)),
];
const specIncome: Income[] = [
  ...Array.from({ length: 12 }, (_, i) => mkInc(1200000 / 12, `2026-${String(i + 1).padStart(2, '0')}-05`, String(i + 1).padStart(2, '0'), 2026)),
  ...Array.from({ length: 12 }, (_, i) => mkInc(1300000 / 12, `2027-${String(i + 1).padStart(2, '0')}-05`, String(i + 1).padStart(2, '0'), 2027)),
];

describe('spec example ledger', () => {
  const ledger = buildBalanceLedger(specExpenses, specIncome, mkBaseline(), OPTS);

  it('2026 → closing ₹8,00,000; 2027 → opening ₹8,00,000, closing ₹11,00,000; 2028 → opening ₹11,00,000', () => {
    // eslint-disable-next-line no-console
    console.log(JSON.stringify(ledger.map(y => ({
      year: y.year, opening: y.opening, income: y.income, expenses: y.expenses,
      net: y.net, closing: y.closing,
      months: y.year === 2026 ? y.months.map(m => [m.label, m.opening, m.income, m.expenses, m.closing]).slice(0, 4) : undefined,
    })), null, 1));
    const [y26, y27, y28] = ledger;
    expect(y26.opening).toBe(500000);
    expect(y26.income).toBe(1200000);
    expect(y26.expenses).toBe(900000);
    expect(y26.closing).toBe(800000);
    expect(y27.opening).toBe(800000);
    expect(y27.closing).toBe(1100000);
    expect(y28.opening).toBe(1100000);
    expect(y28.income).toBe(0);
    expect(y28.closing).toBe(1100000);
  });

  it('chains month openings: Jan opens at baseline, each month opens at prev closing, Dec closing = year closing', () => {
    const y26 = ledger[0];
    expect(y26.months[0].opening).toBe(500000);
    for (let i = 1; i < 12; i++) {
      expect(y26.months[i].opening).toBeCloseTo(y26.months[i - 1].closing as number, 6);
      expect(y26.months[i].closing).toBeCloseTo((y26.months[i].opening as number) + y26.months[i].net, 6);
    }
    expect(y26.months[11].closing).toBeCloseTo(y26.closing, 6);
    // Invariant: closing = opening + income − expenses
    for (const y of ledger) expect(y.closing).toBeCloseTo(y.opening + y.income - y.expenses, 6);
  });

  it('opening balance is never income: year income equals txn sums only', () => {
    expect(ledger[0].income).toBe(specIncome.filter(i => i.year === 2026).reduce((s, i) => s + i.amount, 0));
  });

  it('editing a 2026 txn shifts 2026/2027/2028 closings by the same delta', () => {
    const edited = specExpenses.map((e, i) => i === 0 ? { ...e, amount: e.amount + 500 } : e);
    const after = buildBalanceLedger(edited, specIncome, mkBaseline(), OPTS);
    for (let i = 0; i < 3; i++) expect(after[i].closing).toBeCloseTo(ledger[i].closing - 500, 6);
  });

  it('changing the baseline amount shifts every month and year by the delta', () => {
    const after = buildBalanceLedger(specExpenses, specIncome, mkBaseline({ amount: 500000 + 1000 }), OPTS);
    for (const y of after) {
      expect(y.opening).toBeCloseTo(getYearBalance(ledger, y.year)!.opening + 1000, 6);
      expect(y.closing).toBeCloseTo(getYearBalance(ledger, y.year)!.closing + 1000, 6);
      for (const m of y.months) expect(m.closing).toBeCloseTo(getYearBalance(ledger, y.year)!.months[+m.month - 1].closing! + 1000, 6);
    }
  });
});

describe('effectiveDate', () => {
  it('default = January period start (cycle 1 → Jan 1, cycle 25 → Dec 25)', () => {
    expect(defaultEffectiveDate(2026, 1)).toBe('2026-01-01');
    expect(defaultEffectiveDate(2026, 25)).toBe('2025-12-25');
  });

  it('cycle 25: a 2025-12-28 txn labelled Jan 2026 counts with the default effectiveDate', () => {
    const ledger = buildBalanceLedger(
      [mkExp(100, '2025-12-28', '01', 2026)], [],
      mkBaseline({ effectiveDate: defaultEffectiveDate(2026, 25) }),
      { financialCycleStart: 25, throughYear: 2026, today: '2026-12-31' },
    );
    expect(ledger[0].months[0].expenses).toBe(100);
    expect(ledger[0].excludedBeforeEffective.count).toBe(0);
  });

  it('mid-year effectiveDate: earlier months beforeBaseline, earlier txns excluded & reported', () => {
    const ledger = buildBalanceLedger(
      [
        mkExp(500, '2026-01-10', '01', 2026),   // before effectiveDate → excluded
        mkExp(300, '2026-04-10', '04', 2026),   // inside April period but before date → excluded
        mkExp(200, '2026-04-20', '04', 2026),   // counts
      ],
      [mkInc(1000, '2026-02-01', '02', 2026)],  // excluded income
      mkBaseline({ effectiveDate: '2026-04-15' }),
      { financialCycleStart: 1, throughYear: 2026, today: '2026-12-31' },
    );
    const y = ledger[0];
    expect(y.months.slice(0, 3).every(m => m.beforeBaseline && m.opening === null)).toBe(true);
    expect(y.months[3].opening).toBe(500000);           // April opens at baseline
    expect(y.months[3].expenses).toBe(200);             // only the Apr-20 txn counts
    expect(y.excludedBeforeEffective).toEqual({ income: 1000, expenses: 800, count: 3 });
    expect(y.closing).toBe(500000 + 0 - 200);
  });
});

describe('edge cases', () => {
  it('years with no transactions still carry the balance forward', () => {
    const ledger = buildBalanceLedger(
      [mkExp(1000, '2026-06-10', '06', 2026)], [],
      mkBaseline(), OPTS,
    );
    expect(ledger[1].opening).toBe(499000);
    expect(ledger[1].closing).toBe(499000);
    expect(ledger[2].closing).toBe(499000);
  });

  it('negative and zero baselines work', () => {
    const neg = buildBalanceLedger([], [], mkBaseline({ amount: -50000 }), OPTS);
    expect(neg[0].opening).toBe(-50000);
    expect(neg[0].closing).toBe(-50000);
    const zero = buildBalanceLedger([], [], mkBaseline({ amount: 0 }), OPTS);
    expect(zero[0].closing).toBe(0);
    const errs = validateBaseline({ startYear: 2026, amount: -50000, effectiveDate: '2026-01-01' }, 1);
    expect(errs.amount).toBeUndefined();
  });

  it('future months carry the balance with isFuture and zero activity', () => {
    const ledger = buildBalanceLedger(
      [mkExp(5000, '2027-09-10', '09', 2027)], [],   // future-dated txn inside a future month
      mkBaseline(),
      { financialCycleStart: 1, throughYear: 2027, today: '2027-06-15' },
    );
    const y27 = ledger[1];
    const sep = y27.months[8];
    expect(sep.isFuture).toBe(true);
    expect(sep.expenses).toBe(0);                    // future month carries balance only
    expect(sep.closing).toBe(sep.opening);
    const jun = y27.months[5];
    expect(jun.isFuture).toBe(false);
  });

  it('no baseline → empty ledger; years before startYear → null', () => {
    expect(buildBalanceLedger(specExpenses, specIncome, null, OPTS)).toEqual([]);
    const ledger = buildBalanceLedger(specExpenses, specIncome, mkBaseline(), OPTS);
    expect(getYearBalance(ledger, 2025)).toBeNull();
    expect(getYearBalance(ledger, 2026)).not.toBeNull();
  });
});

describe('validateBaseline', () => {
  const good = { startYear: 2026, amount: 500000, effectiveDate: '2026-03-10' };
  it('accepts a valid mid-year baseline', () => {
    expect(validateBaseline(good, 1)).toEqual({});
  });
  it('rejects out-of-range years and non-finite amounts', () => {
    expect(validateBaseline({ ...good, startYear: 1800 }, 1).startYear).toBeDefined();
    expect(validateBaseline({ ...good, startYear: 2101 }, 1).startYear).toBeDefined();
    expect(validateBaseline({ ...good, startYear: 2026.5 }, 1).startYear).toBeDefined();
    expect(validateBaseline({ ...good, amount: NaN }, 1).amount).toBeDefined();
    expect(validateBaseline({ ...good, amount: Infinity }, 1).amount).toBeDefined();
    expect(validateBaseline({ ...good, startYear: 1970 }, 1).startYear).toBeUndefined();
    expect(validateBaseline({ ...good, startYear: 2100 }, 1).startYear).toBeUndefined();
  });
  it('effectiveDate must fall inside the startYear financial year', () => {
    expect(validateBaseline({ ...good, effectiveDate: '2025-12-31' }, 1).effectiveDate).toBeDefined();
    expect(validateBaseline({ ...good, effectiveDate: '2027-01-01' }, 1).effectiveDate).toBeDefined();
    expect(validateBaseline({ ...good, effectiveDate: 'bad' }, 1).effectiveDate).toBeDefined();
    // cycle 25 widens the valid window to Dec 25 – Dec 24
    expect(validateBaseline({ ...good, effectiveDate: '2025-12-28' }, 25).effectiveDate).toBeUndefined();
  });
});
