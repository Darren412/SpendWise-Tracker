import { MonthPoint } from '@/lib/trends';

export interface ForecastPoint {
  key: string;
  label: string;
  month: string;
  year: number;
  expenses: number;
  income: number;
  savings: number;
  savingsRate: number | null;
  low: number;    // min basis expenses
  high: number;   // max basis expenses
  isForecast: true;
}

export type ForecastResult =
  | { status: 'insufficient'; monthsAvailable: number; monthsNeeded: number }
  | {
      status: 'ok';
      basis: MonthPoint[];
      method: string;
      points: ForecastPoint[];
    };

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/** Step `count` financial months forward from (month='MM', year). */
export function nextFinancialMonth(month: string, year: number, count = 1): { month: string; year: number } {
  const total = (parseInt(month, 10) - 1) + count;
  return {
    month: String((total % 12) + 1).padStart(2, '0'),
    year: year + Math.floor(total / 12),
  };
}

/**
 * Transparent forecast: rolling average of the last `window` COMPLETE months
 * that have any activity (txnCount > 0 or income > 0). The in-progress
 * current period is never part of the basis, and forecast points are stepped
 * forward from the END OF THE INPUT SERIES (not the basis) so projections
 * never mix into actuals.
 */
export function forecast(
  series: MonthPoint[],
  horizon: 1 | 2 | 3 = 3,
  window = 3
): ForecastResult {
  const active = series.filter(p => p.isComplete && (p.txnCount > 0 || p.income > 0));
  if (active.length < window) {
    return { status: 'insufficient', monthsAvailable: active.length, monthsNeeded: window };
  }

  const basis = active.slice(-window);
  const avgExpenses = basis.reduce((s, p) => s + p.expenses, 0) / basis.length;
  const avgIncome = basis.reduce((s, p) => s + p.income, 0) / basis.length;
  const low = Math.min(...basis.map(p => p.expenses));
  const high = Math.max(...basis.map(p => p.expenses));
  const savings = avgIncome - avgExpenses;

  const method = basis.length === 1
    ? `Based on ${basis[0].label} only`
    : `Rolling ${window}-month average of ${basis[0].label}–${basis[basis.length - 1].label}`;

  const last = series[series.length - 1];
  const points: ForecastPoint[] = [];
  for (let h = 1; h <= horizon; h++) {
    const { month, year } = nextFinancialMonth(last.month, last.year, h);
    const m = parseInt(month, 10);
    points.push({
      key: `${year}-${month}`,
      month,
      year,
      label: `${MONTH_NAMES[m - 1]} '${String(year).slice(2)}`,
      expenses: round1(avgExpenses),
      income: round1(avgIncome),
      savings: round1(savings),
      savingsRate: avgIncome > 0 ? round1((savings / avgIncome) * 100) : null,
      low,
      high,
      isForecast: true,
    });
  }

  return { status: 'ok', basis, method, points };
}
