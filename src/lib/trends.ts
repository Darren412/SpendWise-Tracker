import { Category, Expense, Income } from '@/types';
import { getFinancialMonthRange, todayLocalISO } from '@/utils/financialCycle';

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function isoOf(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/**
 * Overview's budget-tracked spending: total spent inside the tracked
 * categories. Callers pass the period-scoped expense list (Overview passes
 * its month/year-filtered set; the series builder passes its date-bucketed
 * set) — category filtering itself is identical either way.
 */
export function budgetTrackedSpend(
  expenses: Pick<Expense, 'amount' | 'category'>[],
  budgetCategoryIds: string[]
): number {
  if (budgetCategoryIds.length === 0) return 0;
  const tracked = new Set(budgetCategoryIds);
  return expenses.reduce((sum, e) => (tracked.has(e.category) ? sum + e.amount : sum), 0);
}

export interface MonthPoint {
  key: string;           // 'YYYY-MM' (financial period label)
  month: string;         // 'MM'
  year: number;
  label: string;         // "Mar '26"
  start: string;         // 'YYYY-MM-DD' period bounds
  end: string;
  income: number;
  expenses: number;
  savings: number;
  savingsRate: number | null;   // null when income is 0
  budget: number | null;        // null when no budget set
  budgetSpent: number;
  budgetUsedPct: number | null; // null when no budget
  txnCount: number;
  byCategory: Record<string, number>;
  isComplete: boolean;          // period end is before today
  isCurrent: boolean;           // today falls inside the period
}

export interface SeriesOptions {
  endMonth: string;      // 'MM' — newest period (inclusive)
  endYear: number;
  months: number;        // how many periods back
  financialCycleStart: number;
  selectedCity: string;
  excludedCategoryIds: string[];
  budgetCategoryIds: string[];
  getBudget: (month: string, year: number) => number;
  today?: string;        // 'YYYY-MM-DD', defaults to local today
}

/**
 * Per-financial-month aggregates oldest→newest. Transactions are bucketed by
 * getFinancialMonthRange date bounds (local-midnight parsing, same as
 * Overview/Insights). Expenses apply Overview's scoping — city rule
 * (missing city counts as 'Bangalore', 'Both' shows everything) plus
 * excludedCategoryIds. Income and budget-tracked spend are unscoped,
 * matching Overview's own semantics.
 */
export function buildMonthlySeries(
  expenses: Expense[],
  income: Income[],
  opts: SeriesOptions
): MonthPoint[] {
  const today = opts.today ?? todayLocalISO();
  const points: MonthPoint[] = [];

  let m = parseInt(opts.endMonth, 10);
  let y = opts.endYear;
  for (let i = 0; i < opts.months; i++) {
    const month = String(m).padStart(2, '0');
    const { start, end } = getFinancialMonthRange(month, y, opts.financialCycleStart);
    const startISO = isoOf(start);
    const endISO = isoOf(end);

    // Unscoped (except date) bucket — used for income and budget spend,
    // matching Overview's global-vs-scoped split
    const periodExpenses = expenses.filter(e => {
      const d = new Date(e.date + 'T00:00:00');
      return d >= start && d <= end;
    });
    const scopedExpenses = periodExpenses.filter(e => {
      const inCity = opts.selectedCity === 'Both' || (e.city ?? 'Bangalore') === opts.selectedCity;
      const notExcluded = opts.excludedCategoryIds.length === 0 || !opts.excludedCategoryIds.includes(e.category);
      return inCity && notExcluded;
    });
    const periodIncome = income.filter(i => {
      const d = new Date(i.date + 'T00:00:00');
      return d >= start && d <= end;
    });

    const inc = periodIncome.reduce((s, i) => s + i.amount, 0);
    const exp = scopedExpenses.reduce((s, e) => s + e.amount, 0);
    const savings = inc - exp;
    const budget = opts.getBudget(month, y);
    const budgetSpent = budgetTrackedSpend(periodExpenses, opts.budgetCategoryIds);

    const byCategory: Record<string, number> = {};
    for (const e of scopedExpenses) {
      byCategory[e.category] = (byCategory[e.category] ?? 0) + e.amount;
    }

    points.unshift({
      key: `${y}-${month}`,
      month,
      year: y,
      label: `${MONTH_NAMES[m - 1]} '${String(y).slice(2)}`,
      start: startISO,
      end: endISO,
      income: inc,
      expenses: exp,
      savings,
      savingsRate: inc > 0 ? round1((savings / inc) * 100) : null,
      budget: budget > 0 ? budget : null,
      budgetSpent,
      budgetUsedPct: budget > 0 ? round1((budgetSpent / budget) * 100) : null,
      txnCount: scopedExpenses.length + periodIncome.length,
      byCategory,
      isComplete: endISO < today,
      isCurrent: startISO <= today && today <= endISO,
    });

    // Step back one financial month
    m -= 1;
    if (m < 1) { m = 12; y -= 1; }
  }

  return points;
}

/** MoM % change, 1 decimal — null when there's no previous baseline. */
export function momChange(curr: number, prev: number): number | null {
  if (prev === 0) return null;
  return round1(((curr - prev) / prev) * 100);
}

export interface MonthPointMoM extends MonthPoint {
  incomeMoM: number | null;
  expensesMoM: number | null;
  savingsMoM: number | null;
}

/** Adds month-over-month deltas; the first point always gets nulls. */
export function withMoM(series: MonthPoint[]): MonthPointMoM[] {
  return series.map((p, i) => {
    const prev = series[i - 1];
    return {
      ...p,
      incomeMoM:   prev ? momChange(p.income,   prev.income)   : null,
      expensesMoM: prev ? momChange(p.expenses, prev.expenses) : null,
      savingsMoM:  prev ? momChange(p.savings,  prev.savings)  : null,
    };
  });
}

export interface CategoryTrend {
  catId: string;
  name: string;
  icon: string;
  color: string;
  values: number[];          // spend per series month
  total: number;
  avg: number;               // per month
  latestMoM: number | null;
  trend: 'up' | 'down' | 'flat';
}

/** Per-expense-category trend rows, sorted by total spend desc. */
export function categoryTrends(series: MonthPoint[], categories: Category[]): CategoryTrend[] {
  return categories
    .filter(c => c.type !== 'income')
    .map(c => {
      const values = series.map(p => p.byCategory[c.id] ?? 0);
      const total = values.reduce((s, v) => s + v, 0);
      const latestMoM = series.length >= 2 ? momChange(values[values.length - 1], values[values.length - 2]) : null;
      const trend: CategoryTrend['trend'] =
        latestMoM === null || Math.abs(latestMoM) < 5 ? 'flat' : latestMoM > 0 ? 'up' : 'down';
      return {
        catId: c.id, name: c.name, icon: c.icon, color: c.color,
        values, total, avg: series.length ? total / series.length : 0,
        latestMoM, trend,
      };
    })
    .filter(t => t.total > 0)
    .sort((a, b) => b.total - a.total);
}
