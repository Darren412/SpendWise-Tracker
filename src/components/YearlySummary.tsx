'use client';

import { useState } from 'react';
import { useBudgetStore } from '@/store/budgetStore';
import { TrendingUp, TrendingDown, PiggyBank, Calendar, ChevronDown } from 'lucide-react';
import { formatCurrency } from '@/utils/currency';

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export default function YearlySummary() {
  const { expenses, income, selectedYear, currency } = useBudgetStore();

  const yearExpenses = expenses.filter(e => e.year === selectedYear);
  const yearIncome = income.filter(i => i.year === selectedYear);

  const totalSpent = yearExpenses.reduce((sum, e) => sum + e.amount, 0);
  const totalIncome = yearIncome.reduce((sum, i) => sum + i.amount, 0);
  const totalSavings = totalIncome - totalSpent;
  const savingsRate = totalIncome > 0 ? (totalSavings / totalIncome) * 100 : 0;

  // Monthly breakdown
  const monthlyData = Array.from({ length: 12 }, (_, i) => {
    const month = String(i + 1).padStart(2, '0');
    const mIncome = yearIncome.filter(inc => inc.month === month).reduce((s, inc) => s + inc.amount, 0);
    const mExpense = yearExpenses.filter(exp => exp.month === month).reduce((s, exp) => s + exp.amount, 0);
    return { month: MONTH_NAMES[i], income: mIncome, expense: mExpense, savings: mIncome - mExpense };
  });

  const activeMonths = monthlyData.filter(m => m.income > 0 || m.expense > 0);
  const maxBar = Math.max(...monthlyData.map(m => Math.max(m.income, m.expense)), 1);
  const [showBreakdown, setShowBreakdown] = useState(false);

  return (
    <div className="dark-card p-7" style={{ border: '1px solid rgba(99,102,241,0.15)' }}>
      <div className="flex items-center gap-3 mb-6">
        <div className="w-1 h-7 rounded-full" style={{ background: 'linear-gradient(180deg, #6366f1, #4f46e5)' }} />
        <h2 className="graffiti-font text-3xl" style={{ color: '#1e293b' }}>YEARLY OVERVIEW</h2>
        <span className="ml-auto text-sm font-bold px-3 py-1 rounded-full" style={{ background: '#eef2ff', color: '#6366f1' }}>
          {selectedYear}
        </span>
      </div>

      {/* Top Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="rounded-xl p-4" style={{ background: '#ecfdf5', border: '1px solid #d1fae5' }}>
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp size={14} color="#059669" />
            <span className="text-xs font-bold uppercase tracking-wider" style={{ color: '#059669' }}>Total Income</span>
          </div>
          <p className="text-xl font-bold num-mono" style={{ color: '#065f46' }}>{formatCurrency(totalIncome, currency)}</p>
        </div>
        <div className="rounded-xl p-4" style={{ background: '#fef2f2', border: '1px solid #fecaca' }}>
          <div className="flex items-center gap-2 mb-2">
            <TrendingDown size={14} color="#dc2626" />
            <span className="text-xs font-bold uppercase tracking-wider" style={{ color: '#dc2626' }}>Total Spent</span>
          </div>
          <p className="text-xl font-bold num-mono" style={{ color: '#991b1b' }}>{formatCurrency(totalSpent, currency)}</p>
        </div>
        <div className="rounded-xl p-4" style={{ background: totalSavings >= 0 ? '#f0fdf4' : '#fef2f2', border: `1px solid ${totalSavings >= 0 ? '#bbf7d0' : '#fecaca'}` }}>
          <div className="flex items-center gap-2 mb-2">
            <PiggyBank size={14} color={totalSavings >= 0 ? '#16a34a' : '#dc2626'} />
            <span className="text-xs font-bold uppercase tracking-wider" style={{ color: totalSavings >= 0 ? '#16a34a' : '#dc2626' }}>Total Savings</span>
          </div>
          <p className="text-xl font-bold num-mono" style={{ color: totalSavings >= 0 ? '#166534' : '#991b1b' }}>
            {totalSavings >= 0 ? '+' : ''}{formatCurrency(totalSavings, currency)}
          </p>
        </div>
        <div className="rounded-xl p-4" style={{ background: '#eef2ff', border: '1px solid #c7d2fe' }}>
          <div className="flex items-center gap-2 mb-2">
            <Calendar size={14} color="#6366f1" />
            <span className="text-xs font-bold uppercase tracking-wider" style={{ color: '#6366f1' }}>Savings Rate</span>
          </div>
          <p className="text-xl font-bold num-mono" style={{ color: '#3730a3' }}>{savingsRate.toFixed(1)}%</p>
        </div>
      </div>

      {/* Monthly Breakdown - Collapsible */}
      <div>
        <button
          onClick={() => setShowBreakdown(!showBreakdown)}
          className="flex items-center justify-between w-full py-3 px-1"
        >
          <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#94a3b8' }}>Monthly Breakdown</p>
          <ChevronDown
            size={18}
            style={{ color: '#94a3b8' }}
            className={`transition-transform duration-300 ${showBreakdown ? 'rotate-180' : ''}`}
          />
        </button>
        {showBreakdown && (
        <div className="space-y-2 mt-1">
          {monthlyData.map((m) => {
            const hasData = m.income > 0 || m.expense > 0;
            if (!hasData) return null;
            const incomeWidth = (m.income / maxBar) * 100;
            const expenseWidth = (m.expense / maxBar) * 100;
            const monthlySavings = m.savings;
            return (
              <div key={m.month} className="rounded-lg p-3" style={{ background: '#f8fafc', border: '1px solid #f1f5f9' }}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold w-8" style={{ color: '#334155' }}>{m.month}</span>
                  <div className="flex items-center gap-4 text-xs num-mono">
                    <span style={{ color: '#059669' }}>+{formatCurrency(m.income, currency)}</span>
                    <span style={{ color: '#dc2626' }}>-{formatCurrency(m.expense, currency)}</span>
                    <span className="font-bold" style={{ color: monthlySavings >= 0 ? '#059669' : '#dc2626' }}>
                      {monthlySavings >= 0 ? '+' : ''}{formatCurrency(monthlySavings, currency)}
                    </span>
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="w-full rounded-full h-1.5" style={{ background: '#e2e8f0' }}>
                    <div className="h-1.5 rounded-full" style={{ width: `${incomeWidth}%`, background: 'linear-gradient(90deg, #34d399, #059669)' }} />
                  </div>
                  <div className="w-full rounded-full h-1.5" style={{ background: '#e2e8f0' }}>
                    <div className="h-1.5 rounded-full" style={{ width: `${expenseWidth}%`, background: 'linear-gradient(90deg, #fb7185, #dc2626)' }} />
                  </div>
                </div>
              </div>
            );
          })}
          {activeMonths.length === 0 && (
            <p className="text-center py-4 text-sm" style={{ color: '#94a3b8' }}>No data for {selectedYear}</p>
          )}

          {/* Legend */}
          <div className="flex items-center justify-center gap-6 pt-2">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-1.5 rounded-full" style={{ background: 'linear-gradient(90deg, #34d399, #059669)' }} />
              <span className="text-xs" style={{ color: '#64748b' }}>Income</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-1.5 rounded-full" style={{ background: 'linear-gradient(90deg, #fb7185, #dc2626)' }} />
              <span className="text-xs" style={{ color: '#64748b' }}>Expenses</span>
            </div>
          </div>
        </div>
        )}
      </div>
    </div>
  );
}
