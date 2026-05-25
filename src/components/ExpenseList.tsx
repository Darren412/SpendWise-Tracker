'use client';

import { useBudgetStore } from '@/store/budgetStore';
import { Trash2 } from 'lucide-react';
import { formatCurrency } from '@/utils/currency';

export default function ExpenseList() {
  const { deleteExpense, getExpensesByMonth, categories, excludedCategoryIds, selectedMonth, selectedYear, selectedCity, currency } = useBudgetStore();
  void selectedCity;

  const allForMonth = [...getExpensesByMonth(selectedMonth, selectedYear)].reverse();
  const monthExpenses = (excludedCategoryIds.length === 0
    ? allForMonth
    : allForMonth.filter(e => !excludedCategoryIds.includes(e.category))
  ).slice(0, 8);
  const getCategoryIcon = (id: string) => categories.find(c => c.id === id)?.icon || '📦';
  const getCategoryName = (id: string) => categories.find(c => c.id === id)?.name || 'Unknown';
  const getCategoryColor = (id: string) => categories.find(c => c.id === id)?.color || '#6b7280';

  return (
    <div className="dark-card p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="card-header-label mb-0.5">Recent Expenses</p>
          <p className="text-xs" style={{ color: '#9ca3af' }}>
            {monthExpenses.length > 0 ? `Latest ${monthExpenses.length} transactions` : 'No expenses this month'}
          </p>
        </div>
        <span className="badge badge-red">{monthExpenses.length}</span>
      </div>

      {monthExpenses.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 gap-2">
          <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ background: '#f4f6f9' }}>
            <span style={{ fontSize: 22 }}>💸</span>
          </div>
          <p className="text-sm font-medium" style={{ color: '#9ca3af' }}>No expenses yet</p>
          <p className="text-xs" style={{ color: '#d1d5db' }}>Add your first expense above</p>
        </div>
      ) : (
        <div className="space-y-1">
          {monthExpenses.map(expense => (
            <div key={expense.id} className="flex items-center gap-3 p-2.5 rounded-xl transition-colors hover:bg-gray-50 group">
              <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 text-base"
                style={{ background: `${getCategoryColor(expense.category)}15` }}>
                {getCategoryIcon(expense.category)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate" style={{ color: '#111827' }}>{expense.description}</p>
                <p className="text-xs truncate" style={{ color: '#9ca3af' }}>
                  {getCategoryName(expense.category)} · {new Date(expense.date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className="text-sm font-bold num-mono" style={{ color: '#ef4444' }}>−{formatCurrency(expense.amount, currency)}</span>
                <button onClick={() => deleteExpense(expense.id)}
                  className="w-7 h-7 rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all"
                  style={{ color: '#ef4444', background: '#fef2f2', border: '1px solid #fecaca' }}>
                  <Trash2 size={12} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
