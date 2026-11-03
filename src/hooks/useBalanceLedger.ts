'use client';

import { useMemo } from 'react';
import { useBudgetStore } from '@/store/budgetStore';
import { buildBalanceLedger, YearBalance } from '@/lib/balance';
import { todayLocalISO, getCurrentFinancialPeriod } from '@/utils/financialCycle';

/**
 * The derived running-balance ledger: startYear → max(selected year, current
 * year, latest transaction year). Memoized on raw store data, so any
 * transaction or baseline edit recalculates every subsequent month/year.
 * Empty array when no baseline is set.
 */
export function useBalanceLedger(): YearBalance[] {
  const expenses = useBudgetStore(s => s.expenses);
  const income = useBudgetStore(s => s.income);
  const openingBalance = useBudgetStore(s => s.openingBalance);
  const financialCycleStart = useBudgetStore(s => s.financialCycleStart);
  const selectedYear = useBudgetStore(s => s.selectedYear);

  return useMemo(() => {
    if (!openingBalance) return [];
    const currentYear = getCurrentFinancialPeriod(financialCycleStart).year;
    let latestTxnYear = 0;
    for (const e of expenses) if (e.year > latestTxnYear) latestTxnYear = e.year;
    for (const i of income) if (i.year > latestTxnYear) latestTxnYear = i.year;
    const throughYear = Math.max(selectedYear, currentYear, latestTxnYear, openingBalance.startYear);
    return buildBalanceLedger(expenses, income, openingBalance, {
      financialCycleStart, throughYear, today: todayLocalISO(),
    });
  }, [expenses, income, openingBalance, financialCycleStart, selectedYear]);
}
