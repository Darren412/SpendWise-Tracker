'use client';

import { useMemo } from 'react';
import { useBudgetStore } from '@/store/budgetStore';
import { budgetPortionExpenses } from '@/lib/funding';
import type { Expense } from '@/types';

/**
 * Store expenses reduced to their BUDGET portions — balance-funded amounts are
 * stripped (pure-balance txns disappear, split txns keep only the budget part).
 * Use wherever spending behaviour or budget performance is measured; never for
 * actual-money totals (balances, cash flow, history, exports' actual figures).
 */
export function useRegularExpenses(): Expense[] {
  const expenses = useBudgetStore(s => s.expenses);
  return useMemo(() => budgetPortionExpenses(expenses), [expenses]);
}
