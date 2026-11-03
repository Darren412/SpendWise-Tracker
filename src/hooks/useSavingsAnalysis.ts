'use client';

import { useMemo } from 'react';
import { useBudgetStore } from '@/store/budgetStore';
import { analyzeSavings, SavingsAnalysis } from '@/lib/savings';
import { todayLocalISO } from '@/utils/financialCycle';

/**
 * Runs the savings-opportunity analysis over the store's current data.
 * Memoized on the raw inputs so it recomputes on any add/edit/delete of
 * transactions, categories, rules or budgets. `baselineWindow` is the UI's
 * 3/6/12 selector.
 */
export function useSavingsAnalysis(baselineWindow: 3 | 6 | 12): SavingsAnalysis {
  const expenses = useBudgetStore(s => s.expenses);
  const categories = useBudgetStore(s => s.categories);
  const recurring = useBudgetStore(s => s.recurring);
  const categoryBudgets = useBudgetStore(s => s.categoryBudgets);
  const spendingTargets = useBudgetStore(s => s.spendingTargets);
  const financialCycleStart = useBudgetStore(s => s.financialCycleStart);
  const selectedMonth = useBudgetStore(s => s.selectedMonth);
  const selectedYear = useBudgetStore(s => s.selectedYear);
  const selectedCity = useBudgetStore(s => s.selectedCity);
  const excludedCategoryIds = useBudgetStore(s => s.excludedCategoryIds);
  const dismissed = useBudgetStore(s => s.dismissedOpportunities);
  const mutedCategoryIds = useBudgetStore(s => s.mutedOpportunityCategories);
  const currency = useBudgetStore(s => s.currency);

  return useMemo(() => analyzeSavings({
    expenses, categories, recurring, categoryBudgets, spendingTargets,
    financialCycleStart, selectedMonth, selectedYear, selectedCity,
    excludedCategoryIds, baselineWindow, today: todayLocalISO(),
    dismissed, mutedCategoryIds, currency,
  }), [
    expenses, categories, recurring, categoryBudgets, spendingTargets,
    financialCycleStart, selectedMonth, selectedYear, selectedCity,
    excludedCategoryIds, baselineWindow, dismissed, mutedCategoryIds, currency,
  ]);
}
