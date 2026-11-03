import { describe, it, expect } from 'vitest';
import { forecast, nextFinancialMonth } from '@/lib/forecast';
import { MonthPoint } from '@/lib/trends';

const pt = (over: Partial<MonthPoint>): MonthPoint => ({
  key: '2026-01', month: '01', year: 2026, label: "Jan '26",
  start: '2026-01-01', end: '2026-01-31',
  income: 0, expenses: 0, majorExpenses: 0, majorTxnTotal: 0, splitTxnTotal: 0,
  actualExpenses: 0, netCashFlow: 0, savings: 0, savingsRate: null,
  budget: null, budgetSpent: 0, budgetUsedPct: null,
  txnCount: 0, byCategory: {}, isComplete: true, isCurrent: false,
  ...over,
});

describe('nextFinancialMonth', () => {
  it('steps forward with Dec→Jan rollover', () => {
    expect(nextFinancialMonth('03', 2026)).toEqual({ month: '04', year: 2026 });
    expect(nextFinancialMonth('12', 2026)).toEqual({ month: '01', year: 2027 });
    expect(nextFinancialMonth('11', 2026, 3)).toEqual({ month: '02', year: 2027 });
  });
});

describe('forecast — insufficient data', () => {
  it('reports 0/1/2 available months', () => {
    const empty = forecast([], 3);
    expect(empty).toEqual({ status: 'insufficient', monthsAvailable: 0, monthsNeeded: 3 });

    const one = forecast([pt({ txnCount: 5 })], 3);
    expect(one).toEqual({ status: 'insufficient', monthsAvailable: 1, monthsNeeded: 3 });

    const two = forecast([pt({ txnCount: 5 }), pt({ month: '02', key: '2026-02', txnCount: 3 })], 3);
    expect((two as { monthsAvailable: number }).monthsAvailable).toBe(2);
  });

  it('does not count incomplete or empty months toward the minimum', () => {
    const series = [
      pt({ txnCount: 5 }),
      pt({ month: '02', key: '2026-02' }),                                // complete but EMPTY
      pt({ month: '03', key: '2026-03', isComplete: false, txnCount: 9 }), // in progress
    ];
    const res = forecast(series, 3);
    expect((res as { monthsAvailable: number }).monthsAvailable).toBe(1);
  });
});

describe('forecast — ok', () => {
  const series = [
    pt({ month: '01', key: '2026-01', label: "Jan '26", income: 1000, expenses: 400, txnCount: 10 }),
    pt({ month: '02', key: '2026-02', label: "Feb '26", income: 1000, expenses: 500, txnCount: 8 }),
    pt({ month: '03', key: '2026-03', label: "Mar '26", income: 2000, expenses: 600, txnCount: 12 }),
    pt({ month: '04', key: '2026-04', label: "Apr '26", isComplete: false, income: 50, expenses: 9999, txnCount: 1 }), // in progress — excluded from basis
  ];

  const res = forecast(series, 3);
  if (res.status !== 'ok') throw new Error('expected ok');

  it('uses the last `window` complete months with activity', () => {
    expect(res.basis.map(p => p.key)).toEqual(['2026-01', '2026-02', '2026-03']);
    expect(res.method).toBe("Rolling 3-month average of Jan '26–Mar '26");
  });

  it('averages the basis for each forecast month after the series end', () => {
    expect(res.points.map(p => p.key)).toEqual(['2026-05', '2026-06', '2026-07']);
    const avgExp = (400 + 500 + 600) / 3;
    const avgInc = (1000 + 1000 + 2000) / 3;
    for (const p of res.points) {
      // points are rounded to 1 decimal — allow that delta
      expect(p.expenses).toBeCloseTo(avgExp, 1);
      expect(p.income).toBeCloseTo(avgInc, 1);
      expect(p.savings).toBeCloseTo(avgInc - avgExp, 1);
      expect(p.savingsRate).toBeCloseTo(((avgInc - avgExp) / avgInc) * 100, 1);
      expect(p.low).toBe(400);
      expect(p.high).toBe(600);
      expect(p.isForecast).toBe(true);
    }
  });

  it('Dec→Jan rollover in forecast keys', () => {
    const s = [
      pt({ month: '10', key: '2026-10', label: "Oct '26", income: 100, expenses: 10, txnCount: 1 }),
      pt({ month: '11', key: '2026-11', label: "Nov '26", income: 100, expenses: 10, txnCount: 1 }),
      pt({ month: '12', key: '2026-12', label: "Dec '26", income: 100, expenses: 10, txnCount: 1 }),
    ];
    const r = forecast(s, 2);
    if (r.status !== 'ok') throw new Error('expected ok');
    expect(r.points.map(p => p.key)).toEqual(['2027-01', '2027-02']);
    expect(r.points[0].label).toBe("Jan '27");
  });

  it('savingsRate is null when basis income is zero', () => {
    const s = [
      pt({ income: 0, expenses: 10, txnCount: 1 }),
      pt({ month: '02', key: '2026-02', income: 0, expenses: 20, txnCount: 1 }),
      pt({ month: '03', key: '2026-03', income: 0, expenses: 30, txnCount: 1 }),
    ];
    const r = forecast(s, 1);
    if (r.status !== 'ok') throw new Error('expected ok');
    expect(r.points[0].savingsRate).toBeNull();
  });
});
