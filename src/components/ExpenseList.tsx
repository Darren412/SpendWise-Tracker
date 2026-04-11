'use client';

import { useBudgetStore } from '@/store/budgetStore';
import { Trash2 } from 'lucide-react';

export default function ExpenseList() {
  const { deleteExpense, getExpensesByMonth, categories, selectedMonth, selectedYear } =
    useBudgetStore();

  const monthExpenses = getExpensesByMonth(selectedMonth, selectedYear);
  const getCategoryIcon = (categoryId: string) => {
    return categories.find((c) => c.id === categoryId)?.icon || '📦';
  };

  const getCategoryName = (categoryId: string) => {
    return categories.find((c) => c.id === categoryId)?.name || 'Unknown';
  };

  if (monthExpenses.length === 0) {
    return (
      <div className="dark-card glow-pink p-8" style={{ border: '1px solid rgba(225,29,72,0.15)' }}>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-1 h-7 rounded-full" style={{ background: 'linear-gradient(180deg, #e11d48, #be123c)' }} />
          <h2 className="graffiti-font text-3xl" style={{ color: '#1e293b' }}>RECENT EXPENSES</h2>
        </div>
        <p className="text-center py-8 font-medium" style={{ color: '#94a3b8' }}>
          No expenses recorded yet. Start by adding your first expense!
        </p>
      </div>
    );
  }

  return (
    <div className="dark-card glow-pink p-8" style={{ border: '1px solid rgba(225,29,72,0.15)' }}>
      <div className="flex items-center gap-3 mb-6">
        <div className="w-1 h-7 rounded-full" style={{ background: 'linear-gradient(180deg, #e11d48, #be123c)' }} />
        <h2 className="graffiti-font text-3xl" style={{ color: '#1e293b' }}>RECENT EXPENSES</h2>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full dark-table">
          <thead>
            <tr>
              <th className="text-left">Category</th>
              <th className="text-left">Description</th>
              <th className="text-left">Date</th>
              <th className="text-right">Amount</th>
              <th className="text-center">Action</th>
            </tr>
          </thead>
          <tbody>
            {monthExpenses.map((expense) => (
              <tr key={expense.id}>
                <td>
                  <span className="text-xl mr-2">{getCategoryIcon(expense.category)}</span>
                  <span style={{ color: '#1e293b' }}>{getCategoryName(expense.category)}</span>
                </td>
                <td style={{ color: '#64748b' }}>{expense.description}</td>
                <td style={{ color: '#64748b' }}>{new Date(expense.date).toLocaleDateString()}</td>
                <td className="text-right font-bold font-mono" style={{ color: '#e11d48' }}>
                  ₹{expense.amount.toFixed(2)}
                </td>
                <td className="text-center">
                  <button
                    onClick={() => deleteExpense(expense.id)}
                    className="inline-flex items-center justify-center w-8 h-8 rounded-lg transition-all hover:scale-110"
                    style={{ color: '#e11d48', background: 'rgba(225,29,72,0.08)', border: '1px solid rgba(225,29,72,0.15)' }}
                  >
                    <Trash2 size={16} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
