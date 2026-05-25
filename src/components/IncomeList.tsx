'use client';

import { useBudgetStore } from '@/store/budgetStore';
import { Trash2 } from 'lucide-react';
import { formatCurrency } from '@/utils/currency';

export default function IncomeList() {
  const { deleteIncome, getIncomeByMonth, categories, selectedMonth, selectedYear, currency } = useBudgetStore();
  const monthIncome = [...getIncomeByMonth(selectedMonth, selectedYear)].reverse();

  const getCatForIncome = (catId?: string) =>
    catId ? categories.find(c => c.id === catId) : undefined;

  return (
    <div className="dark-card p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="card-header-label mb-0.5">Income Records</p>
          <p className="text-xs" style={{ color: '#9ca3af' }}>
            {monthIncome.length > 0 ? `${monthIncome.length} source${monthIncome.length > 1 ? 's' : ''} this month` : 'No income this month'}
          </p>
        </div>
        <span className="badge badge-green">{monthIncome.length}</span>
      </div>

      {monthIncome.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 gap-2">
          <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ background: '#f4f6f9' }}>
            <span style={{ fontSize: 22 }}>💰</span>
          </div>
          <p className="text-sm font-medium" style={{ color: '#9ca3af' }}>No income yet</p>
          <p className="text-xs" style={{ color: '#d1d5db' }}>Add your income above</p>
        </div>
      ) : (
        <div className="space-y-1">
          {monthIncome.map(inc => {
            const cat = getCatForIncome(inc.category);
            return (
            <div key={inc.id} className="flex items-center gap-3 p-2.5 rounded-xl transition-colors hover:bg-gray-50 group">
              <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ background: cat ? `${cat.color}20` : '#ecfdf5' }}>
                <span style={{ fontSize: 16 }}>{cat?.icon ?? '💵'}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate" style={{ color: '#111827' }}>
                  {inc.source || cat?.name || 'Income'}
                </p>
                <p className="text-xs" style={{ color: '#9ca3af' }}>
                  {cat && <span style={{ color: cat.color, fontWeight: 600 }}>{cat.name} · </span>}
                  {new Date(inc.date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className="text-sm font-bold num-mono" style={{ color: '#10b981' }}>+{formatCurrency(inc.amount, currency)}</span>
                <button onClick={() => deleteIncome(inc.id)}
                  className="w-7 h-7 rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all"
                  style={{ color: '#ef4444', background: '#fef2f2', border: '1px solid #fecaca' }}>
                  <Trash2 size={12} />
                </button>
              </div>
            </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
