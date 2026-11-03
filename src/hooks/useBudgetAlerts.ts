'use client';

import { useMemo } from 'react';
import { useBudgetStore } from '@/store/budgetStore';
import { budgetTrackedSpend } from '@/lib/trends';
import {
  evaluateBudgetAlerts, visibleAlerts, newlyTriggered, BudgetAlert,
} from '@/lib/budgetAlerts';

export interface BudgetAlerts {
  alerts: BudgetAlert[];   // all breached scopes for the selected period
  visible: BudgetAlert[];  // minus acknowledged ones
  newOnes: BudgetAlert[];  // visible AND not yet toasted
}

/**
 * Budget alerts for the toolbar's selected financial period. Overall uses
 * the same numbers as Overview's budget tracker (monthly budget vs
 * budgetCategoryIds-tracked spend, unscoped label-filtered set); category
 * scopes use categoryBudgets. Empty when alerts are disabled.
 */
export function useBudgetAlerts(): BudgetAlerts {
  const {
    expenses, categories, selectedMonth, selectedYear,
    budgetCategoryIds, categoryBudgets, alertThresholds, alertsEnabled,
    acknowledgedAlerts, notifiedAlerts, getMonthlyBudget,
  } = useBudgetStore();

  return useMemo(() => {
    if (!alertsEnabled) return { alerts: [], visible: [], newOnes: [] };

    // Same period set Overview uses — label-matched, unscoped
    const periodExpenses = expenses.filter(e => e.month === selectedMonth && e.year === selectedYear);
    const periodKey = `${selectedYear}-${selectedMonth}`;

    const alerts = evaluateBudgetAlerts({
      periodKey,
      overall: {
        budget: getMonthlyBudget(selectedMonth, selectedYear),
        spent: budgetTrackedSpend(periodExpenses, budgetCategoryIds),
      },
      categories: categories
        .filter(c => (categoryBudgets[c.id] ?? 0) > 0)
        .map(c => ({
          id: c.id,
          name: c.name,
          budget: categoryBudgets[c.id],
          spent: periodExpenses.filter(e => e.category === c.id).reduce((s, e) => s + e.amount, 0),
        })),
      thresholds: alertThresholds,
    });

    const visible = visibleAlerts(alerts, acknowledgedAlerts);
    // Toast only for alerts the user would actually see
    const newOnes = newlyTriggered(visible, notifiedAlerts);
    return { alerts, visible, newOnes };
  }, [
    expenses, categories, selectedMonth, selectedYear,
    budgetCategoryIds, categoryBudgets, alertThresholds, alertsEnabled,
    acknowledgedAlerts, notifiedAlerts, getMonthlyBudget,
  ]);
}
