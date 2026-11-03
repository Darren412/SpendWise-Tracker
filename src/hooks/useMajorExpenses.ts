'use client';

import { useMemo } from 'react';
import { useBudgetStore } from '@/store/budgetStore';
import {
  majorExpenseUsage, balanceCoverage, essentialMonthlyAverage,
} from '@/lib/funding';
import { availableBalanceOn, buildBalanceLedger, BalanceLedgerInputs } from '@/lib/balance';
import { getFinancialMonthRange, todayLocalISO, getCurrentFinancialPeriod } from '@/utils/financialCycle';

export interface UseMajorExpensesResult {
  /**
   * Overall balance on `date` (opening + counted income − counted expenses);
   * null when no opening-balance baseline exists — callers then show a "set an
   * opening balance" hint instead of a number. `excludeExpenseId` = edit flow.
   */
  availableOn: (date: string, opts?: { excludeExpenseId?: string }) => number | null;
  /** Available balance "now" (overall balance at today), or null w/o baseline. */
  availableNow: number | null;
  usageThisPeriod: { total: number; count: number };
  usageThisYear: { total: number; count: number };
  coverage: { months: number | null; status: 'ok' | 'insufficient-data' | 'no-essential-spend' };
  overallBalance: number | null;   // latest closing from the balance ledger
  hasBaseline: boolean;
}

/** Derived existing-balance state — memoized on raw store data; recalculates on any txn/baseline change. */
export function useMajorExpenses(): UseMajorExpensesResult {
  const expenses = useBudgetStore(s => s.expenses);
  const income = useBudgetStore(s => s.income);
  const categories = useBudgetStore(s => s.categories);
  const openingBalance = useBudgetStore(s => s.openingBalance);
  const financialCycleStart = useBudgetStore(s => s.financialCycleStart);
  const selectedMonth = useBudgetStore(s => s.selectedMonth);
  const selectedYear = useBudgetStore(s => s.selectedYear);

  return useMemo(() => {
    const today = todayLocalISO();
    const ledgerInputs: BalanceLedgerInputs = {
      baseline: openingBalance, expenses, income, financialCycleStart,
    };

    const period = getFinancialMonthRange(selectedMonth, selectedYear, financialCycleStart);
    const ISO = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const pStart = ISO(period.start), pEnd = ISO(period.end);

    const usagePeriod = majorExpenseUsage(expenses, { from: pStart, to: pEnd });
    const usageYear = majorExpenseUsage(expenses, { from: `${selectedYear}-01-01`, to: `${selectedYear}-12-31` });

    // Overall balance = latest closing of the balance ledger (null without baseline)
    let overall: number | null = null;
    if (openingBalance) {
      const currentYear = getCurrentFinancialPeriod(financialCycleStart).year;
      let latestYear = Math.max(selectedYear, currentYear, openingBalance.startYear);
      for (const e of expenses) if (e.year > latestYear) latestYear = e.year;
      for (const i of income) if (i.year > latestYear) latestYear = i.year;
      const bal = buildBalanceLedger(expenses, income, openingBalance, { financialCycleStart, throughYear: latestYear, today });
      overall = bal.length ? bal[bal.length - 1].closing : null;
    }

    const availableNow = openingBalance ? availableBalanceOn(ledgerInputs, today) : null;
    const { avg } = essentialMonthlyAverage(expenses, categories, { financialCycleStart, today });
    const coverage = balanceCoverage(availableNow ?? 0, availableNow === null ? null : avg);

    return {
      availableOn: (date, opts) => availableBalanceOn(ledgerInputs, date, opts),
      availableNow,
      usageThisPeriod: { total: usagePeriod.total, count: usagePeriod.count },
      usageThisYear: { total: usageYear.total, count: usageYear.count },
      coverage,
      overallBalance: overall,
      hasBaseline: openingBalance !== null,
    };
  }, [expenses, income, categories, openingBalance, financialCycleStart, selectedMonth, selectedYear]);
}
