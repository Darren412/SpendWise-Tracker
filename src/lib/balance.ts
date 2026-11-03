import { Expense, Income, OpeningBalanceBaseline } from '@/types';
import { getFinancialMonthRange } from '@/utils/financialCycle';
import { fundingParts } from '@/lib/reserve';
import type { ReserveTransfer } from '@/lib/reserve';

export interface MonthBalance {
  month: string;            // '01'–'12' financial month label
  label: string;            // "Jan '26"
  opening: number | null;   // null for beforeBaseline months
  income: number;           // counted txns only (see counting rules)
  expenses: number;         // ALL actual expenses (full amounts, any funding)
  regularExpenses: number;  // budget portions — monthly-budget performance
  reserveExpenses: number;  // reserve portions — paid from the reserve
  reserveIn: number;        // transfers in this month (informational — not in closing)
  reserveOut: number;
  net: number;
  closing: number | null;
  beforeBaseline: boolean;
  isFuture: boolean;        // financial period starts after today
}

export interface YearBalance {
  year: number;
  opening: number;          // baseline amount (startYear) or previous year's closing
  income: number;
  expenses: number;
  regularExpenses: number;
  reserveExpenses: number;
  reserveIn: number;
  reserveOut: number;
  net: number;
  closing: number;          // December closing; invariant: opening + income − expenses
  months: MonthBalance[];
  /** startYear txns (by label) dated before effectiveDate — explains any gap vs Yearly Overview */
  excludedBeforeEffective: { income: number; expenses: number; count: number };
}

export interface BalanceLedgerOptions {
  financialCycleStart: number;
  throughYear: number;
  today: string;            // 'YYYY-MM-DD'
}

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const ISO = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** First day of the January financial period of `startYear` (e.g. 2025-12-25 with cycle 25). */
export function defaultEffectiveDate(startYear: number, financialCycleStart: number): string {
  return ISO(getFinancialMonthRange('01', startYear, financialCycleStart).start);
}

export type BaselineErrors = Partial<Record<'startYear' | 'amount' | 'effectiveDate', string>>;

export function validateBaseline(
  input: { startYear: number; amount: number; effectiveDate: string },
  financialCycleStart: number,
): BaselineErrors {
  const errors: BaselineErrors = {};
  if (!Number.isInteger(input.startYear) || input.startYear < 1970 || input.startYear > 2100) {
    errors.startYear = 'Enter a year between 1970 and 2100.';
  } else {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(input.effectiveDate) || isNaN(new Date(input.effectiveDate + 'T12:00:00').getTime())) {
      errors.effectiveDate = 'Enter a valid date.';
    } else {
      const janStart = ISO(getFinancialMonthRange('01', input.startYear, financialCycleStart).start);
      const decEnd = ISO(getFinancialMonthRange('12', input.startYear, financialCycleStart).end);
      if (input.effectiveDate < janStart || input.effectiveDate > decEnd) {
        errors.effectiveDate = `Must be inside the ${input.startYear} financial year (${janStart} – ${decEnd}).`;
      }
    }
  }
  if (typeof input.amount !== 'number' || !Number.isFinite(input.amount)) {
    errors.amount = 'Enter a valid amount.';
  }
  return errors;
}

/**
 * Derives the full running-balance ledger from the baseline record and raw
 * transactions. Everything is computed — nothing here is stored — so any
 * transaction or baseline edit recalculates every subsequent month/year.
 *
 * Counting rules:
 *  - A txn counts iff its label year ≥ baseline.startYear AND its date ≥
 *    effectiveDate AND it falls in a non-future month.
 *  - Months of startYear whose financial period ends before effectiveDate are
 *    beforeBaseline (no opening/closing); their txns are reported in
 *    excludedBeforeEffective.
 *  - Future months (period starts after today) carry the balance but record
 *    zero activity — closing equals the carried opening.
 *  - Opening balance is never income: income/expenses here are txn sums only.
 */
export function buildBalanceLedger(
  expenses: Expense[],
  income: Income[],
  baseline: OpeningBalanceBaseline | null,
  opts: BalanceLedgerOptions,
  transfers: ReserveTransfer[] = [],
): YearBalance[] {
  if (!baseline) return [];
  const { financialCycleStart, throughYear, today } = opts;
  const { startYear, amount, effectiveDate } = baseline;
  if (throughYear < startYear) return [];

  const ledger: YearBalance[] = [];
  let carried = amount; // balance entering the next month/year

  for (let year = startYear; year <= throughYear; year++) {
    const isStartYear = year === startYear;
    let yearOpening = 0;
    let yIncome = 0, yExpenses = 0, yRegular = 0, yReserve = 0, yIn = 0, yOut = 0;
    const months: MonthBalance[] = [];
    const excluded = { income: 0, expenses: 0, count: 0 };
    let yearOpeningSet = false;

    for (let m = 1; m <= 12; m++) {
      const mm = String(m).padStart(2, '0');
      const range = getFinancialMonthRange(mm, year, financialCycleStart);
      const startISO = ISO(range.start);
      const endISO = ISO(range.end);

      const monthExpenses = expenses.filter(e => e.year === year && e.month === mm);
      const monthIncome = income.filter(i => i.year === year && i.month === mm);

      const beforeBaseline = isStartYear && endISO < effectiveDate;
      const isFuture = startISO > today;

      let inc = 0, exp = 0, regular = 0, reserve = 0, reserveIn = 0, reserveOut = 0;
      if (!beforeBaseline && !isFuture) {
        inc = monthIncome.reduce((s, i) => s + (i.date >= effectiveDate ? i.amount : 0), 0);
        exp = monthExpenses.reduce((s, e) => {
          if (e.date < effectiveDate) return s;
          const p = fundingParts(e);
          regular += p.budget;
          reserve += p.reserve;
          return s + e.amount;
        }, 0);
        for (const t of transfers) {
          if (t.date >= effectiveDate && t.date >= startISO && t.date <= endISO) {
            if (t.direction === 'in') reserveIn += t.amount; else reserveOut += t.amount;
          }
        }
      }
      if (isStartYear) {
        // txns labelled in startYear but dated before the effective date
        for (const i of monthIncome) if (i.date < effectiveDate) { excluded.income += i.amount; excluded.count++; }
        for (const e of monthExpenses) if (e.date < effectiveDate) { excluded.expenses += e.amount; excluded.count++; }
      }

      const opening = beforeBaseline ? null : carried;
      const closing = beforeBaseline ? null : carried + inc - exp;
      if (!beforeBaseline && !yearOpeningSet) { yearOpening = carried; yearOpeningSet = true; }
      if (!beforeBaseline) carried = closing as number;

      months.push({
        month: mm,
        label: `${MONTH_NAMES[m - 1]} '${String(year).slice(2)}`,
        opening, income: inc, expenses: exp,
        regularExpenses: regular, reserveExpenses: reserve,
        reserveIn, reserveOut,
        net: inc - exp, closing,
        beforeBaseline, isFuture,
      });
      yIncome += inc;
      yExpenses += exp;
      yRegular += regular; yReserve += reserve;
      yIn += reserveIn; yOut += reserveOut;
    }

    // If every month were beforeBaseline (impossible per validation — the
    // effectiveDate is inside the year), yearOpening stays 0.
    ledger.push({
      year,
      opening: yearOpening,
      income: yIncome,
      expenses: yExpenses,
      regularExpenses: yRegular,
      reserveExpenses: yReserve,
      reserveIn: yIn,
      reserveOut: yOut,
      net: yIncome - yExpenses,
      closing: carried,
      months,
      excludedBeforeEffective: excluded,
    });
  }

  return ledger;
}

/** Ledger row for a year, or null when it precedes startYear / is beyond the chain. */
export function getYearBalance(ledger: YearBalance[], year: number): YearBalance | null {
  return ledger.find(y => y.year === year) ?? null;
}
