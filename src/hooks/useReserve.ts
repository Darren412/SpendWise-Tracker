'use client';

import { useMemo } from 'react';
import { useBudgetStore } from '@/store/budgetStore';
import {
  buildReserveLedger, reserveBalance, reserveAvailableOn, reserveUsage,
  reserveCoverage, essentialMonthlyAverage, budgetPortionExpenses, ReserveEntry,
} from '@/lib/reserve';
import { buildBalanceLedger } from '@/lib/balance';
import { getFinancialMonthRange, todayLocalISO, getCurrentFinancialPeriod } from '@/utils/financialCycle';

export interface UseReserveResult {
  ledger: ReserveEntry[];
  balance: number;
  /** max drawable on `date` without any balance going negative */
  availableOn: (date: string, opts?: { excludeExpenseId?: string; excludeTransferId?: string }) => number;
  usageThisPeriod: { total: number; count: number };
  usageThisYear: { total: number; count: number };
  coverage: { months: number | null; status: 'ok' | 'insufficient-data' | 'no-essential-spend' };
  /** overall − reserve; null when no opening-balance baseline exists */
  unallocated: number | null;
  overallBalance: number | null;   // latest closing from the balance ledger
  suggestedContribution: number;   // this period's operating surplus (income − budget-portion expenses), >0
}

/** Derived reserve state — memoized on raw store data; recalculates on any txn/transfer change. */
export function useReserve(): UseReserveResult {
  const expenses = useBudgetStore(s => s.expenses);
  const income = useBudgetStore(s => s.income);
  const categories = useBudgetStore(s => s.categories);
  const transfers = useBudgetStore(s => s.reserveTransfers);
  const openingBalance = useBudgetStore(s => s.openingBalance);
  const financialCycleStart = useBudgetStore(s => s.financialCycleStart);
  const selectedMonth = useBudgetStore(s => s.selectedMonth);
  const selectedYear = useBudgetStore(s => s.selectedYear);

  return useMemo(() => {
    const today = todayLocalISO();
    const ledger = buildReserveLedger(transfers, expenses);
    const balance = reserveBalance(ledger);

    const period = getFinancialMonthRange(selectedMonth, selectedYear, financialCycleStart);
    const ISO = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const pStart = ISO(period.start), pEnd = ISO(period.end);

    const usagePeriod = reserveUsage(expenses, { from: pStart, to: pEnd });
    const usageYear = reserveUsage(expenses, { from: `${selectedYear}-01-01`, to: `${selectedYear}-12-31` });

    const { avg } = essentialMonthlyAverage(expenses, categories, { financialCycleStart, today });
    const coverage = reserveCoverage(balance, avg);

    // Overall balance = latest closing of the balance ledger (null without baseline)
    let overall: number | null = null;
    if (openingBalance) {
      const currentYear = getCurrentFinancialPeriod(financialCycleStart).year;
      let latestYear = Math.max(selectedYear, currentYear, openingBalance.startYear);
      for (const e of expenses) if (e.year > latestYear) latestYear = e.year;
      for (const i of income) if (i.year > latestYear) latestYear = i.year;
      const bal = buildBalanceLedger(expenses, income, openingBalance, { financialCycleStart, throughYear: latestYear, today }, transfers);
      overall = bal.length ? bal[bal.length - 1].closing : null;
    }
    const unallocated = overall === null ? null : overall - balance;

    // This period's operating surplus = income − budget-portion expenses
    const periodIncome = income.filter(i => i.date >= pStart && i.date <= pEnd).reduce((s, i) => s + i.amount, 0);
    const periodRegular = budgetPortionExpenses(expenses).filter(e => e.date >= pStart && e.date <= pEnd).reduce((s, e) => s + e.amount, 0);
    const surplus = Math.max(0, periodIncome - periodRegular);

    return {
      ledger,
      balance,
      availableOn: (date, opts) => reserveAvailableOn(transfers, expenses, date, opts),
      usageThisPeriod: { total: usagePeriod.total, count: usagePeriod.count },
      usageThisYear: { total: usageYear.total, count: usageYear.count },
      coverage,
      unallocated,
      overallBalance: overall,
      suggestedContribution: surplus,
    };
  }, [expenses, income, categories, transfers, openingBalance, financialCycleStart, selectedMonth, selectedYear]);
}
