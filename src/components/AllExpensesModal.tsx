'use client';

import { useState, useMemo } from 'react';
import { X, Calendar } from 'lucide-react';
import { useBudgetStore } from '@/store/budgetStore';

interface AllExpensesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function AllExpensesModal({ isOpen, onClose }: AllExpensesModalProps) {
  const { categories, expenses: allExpenses, selectedMonth, selectedYear } = useBudgetStore();
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedDay, setSelectedDay] = useState<string>('all');

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];

  const defaultMonthKey = `${selectedYear}-${selectedMonth}`;
  const [filterMonthKey, setFilterMonthKey] = useState(defaultMonthKey);

  const getCategoryIcon = (categoryId: string) => categories.find((c) => c.id === categoryId)?.icon || '📦';
  const getCategoryName = (categoryId: string) => categories.find((c) => c.id === categoryId)?.name || 'Unknown';

  // All months that have at least one expense, newest first
  const availableMonths = useMemo(() => {
    const seen = new Set<string>();
    const months: { key: string; label: string }[] = [];
    allExpenses.forEach((e) => {
      const key = `${e.year}-${e.month}`;
      if (!seen.has(key)) {
        seen.add(key);
        months.push({ key, label: `${monthNames[parseInt(e.month, 10) - 1]} ${e.year}` });
      }
    });
    return months.sort((a, b) => b.key.localeCompare(a.key));
  }, [allExpenses]);

  // Expenses for the selected month
  const monthExpenses = useMemo(() => {
    const [yr, mo] = filterMonthKey.split('-');
    return allExpenses.filter((e) => e.year === parseInt(yr) && e.month === mo);
  }, [allExpenses, filterMonthKey]);

  // Unique days in that month, newest first
  const availableDays = useMemo(() => {
    const days = [...new Set(monthExpenses.map((e) => e.date))].sort(
      (a, b) => new Date(b).getTime() - new Date(a).getTime()
    );
    return days;
  }, [monthExpenses]);

  // Whether we're in day view (a specific day is selected)
  const isDayView = selectedDay !== 'all';

  // Base list: optionally filtered by day
  const baseExpenses = useMemo(() => {
    if (isDayView) return monthExpenses.filter((e) => e.date === selectedDay);
    return monthExpenses;
  }, [monthExpenses, isDayView, selectedDay]);

  // Further filtered by category
  const visibleExpenses = useMemo(() => {
    if (selectedCategory === 'all') return baseExpenses;
    return baseExpenses.filter((e) => e.category === selectedCategory);
  }, [baseExpenses, selectedCategory]);

  const totalVisible = visibleExpenses.reduce((sum, e) => sum + e.amount, 0);

  // Grouped by day (for day view)
  const groupedByDay = useMemo(() => {
    const groups: Record<string, typeof allExpenses> = {};
    visibleExpenses.forEach((e) => {
      if (!groups[e.date]) groups[e.date] = [];
      groups[e.date].push(e);
    });
    Object.keys(groups).forEach((d) =>
      groups[d].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    );
    return groups;
  }, [visibleExpenses]);

  const dayKeys = Object.keys(groupedByDay).sort((a, b) => new Date(b).getTime() - new Date(a).getTime());

  // Grouped by category (for month view)
  const groupedByCategory = useMemo(() => {
    const groups: Record<string, typeof allExpenses> = {};
    visibleExpenses.forEach((e) => {
      if (!groups[e.category]) groups[e.category] = [];
      groups[e.category].push(e);
    });
    Object.keys(groups).forEach((c) =>
      groups[c].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    );
    return groups;
  }, [visibleExpenses]);

  // Label for the header
  const [filterYear, filterMo] = filterMonthKey.split('-');
  const headerLabel = `${monthNames[parseInt(filterMo, 10) - 1]} ${filterYear}`;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(6px)' }}>
      <div className="rounded-2xl max-w-4xl w-full max-h-[90vh] flex flex-col" style={{ background: '#ffffff', border: '1px solid #e2e8f0', boxShadow: '0 25px 50px rgba(0,0,0,0.15)' }}>

        {/* ── Header ── */}
        <div className="sticky top-0 px-6 py-4 flex items-center justify-between flex-shrink-0" style={{ background: '#ffffff', borderBottom: '1px solid #e2e8f0', borderRadius: '16px 16px 0 0' }}>
          <div>
            <h2 className="text-lg font-bold" style={{ color: '#0f172a' }}>All Expenses</h2>
            <p className="text-xs mt-0.5" style={{ color: '#94a3b8' }}>
              {headerLabel}
              &nbsp;·&nbsp;
              <span className="font-semibold" style={{ color: '#dc2626' }}>₹{totalVisible.toFixed(2)}</span>
              &nbsp;·&nbsp;{visibleExpenses.length} transaction{visibleExpenses.length !== 1 ? 's' : ''}
            </p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg transition-colors hover:bg-slate-100" style={{ color: '#64748b' }}>
            <X size={18} />
          </button>
        </div>

        {/* ── Toolbar ── */}
        <div className="px-6 py-3 flex-shrink-0 space-y-3" style={{ borderBottom: '1px solid #e2e8f0' }}>

          {/* Month + Day dropdowns */}
          <div className="flex items-center gap-4 flex-wrap">
            {/* Month dropdown */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#94a3b8' }}>Month</span>
              <select
                value={filterMonthKey}
                onChange={(e) => { setFilterMonthKey(e.target.value); setSelectedDay('all'); }}
                className="dark-select px-3 py-2 text-sm font-semibold"
              >
                {availableMonths.length === 0 && (
                  <option value={defaultMonthKey}>{headerLabel}</option>
                )}
                {availableMonths.map((m) => (
                  <option key={m.key} value={m.key}>{m.label}</option>
                ))}
              </select>
            </div>

            {/* Day dropdown */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#94a3b8' }}>Day</span>
              <select
                value={selectedDay}
                onChange={(e) => setSelectedDay(e.target.value)}
                className="dark-select px-3 py-2 text-sm font-semibold"
              >
                <option value="all">All Days</option>
                {availableDays.map((d) => (
                  <option key={d} value={d}>
                    {new Date(d).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Category filter */}
          <div className="flex flex-wrap gap-1.5">
            <button
              onClick={() => setSelectedCategory('all')}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors"
              style={selectedCategory === 'all'
                ? { background: '#0f172a', color: '#fff' }
                : { background: '#f1f5f9', color: '#64748b', border: '1px solid #e2e8f0' }
              }
            >
              All Categories
            </button>
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors"
                style={selectedCategory === cat.id
                  ? { background: '#0f172a', color: '#fff' }
                  : { background: '#f1f5f9', color: '#64748b', border: '1px solid #e2e8f0' }
                }
              >
                <span>{cat.icon}</span>{cat.name}
              </button>
            ))}
          </div>
        </div>

        {/* ── Content ── */}
        <div className="overflow-y-auto flex-1 p-6 space-y-5">
          {visibleExpenses.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-16">
              <div className="w-14 h-14 rounded-full flex items-center justify-center" style={{ background: '#f1f5f9' }}>
                <span style={{ fontSize: '24px' }}>🧾</span>
              </div>
              <p className="text-sm font-semibold" style={{ color: '#94a3b8' }}>No expenses found</p>
            </div>
          ) : isDayView ? (
            /* ── Day View ── */
            dayKeys.map((day) => {
              const dayExpenses = groupedByDay[day];
              const dayTotal = dayExpenses.reduce((s, e) => s + e.amount, 0);
              return (
                <div key={day} className="rounded-xl overflow-hidden" style={{ border: '1px solid #e2e8f0' }}>
                  <div className="flex items-center justify-between px-4 py-2.5" style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                    <div className="flex items-center gap-2">
                      <Calendar size={13} style={{ color: '#dc2626' }} />
                      <span className="text-sm font-bold" style={{ color: '#0f172a' }}>
                        {new Date(day).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-medium" style={{ color: '#94a3b8' }}>{dayExpenses.length} item{dayExpenses.length !== 1 ? 's' : ''}</span>
                      <span className="text-sm font-bold num-mono" style={{ color: '#dc2626' }}>₹{dayTotal.toFixed(2)}</span>
                    </div>
                  </div>
                  <div className="divide-y divide-slate-100">
                    {dayExpenses.map((expense) => (
                      <div key={expense.id} className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors">
                        <span className="text-lg">{getCategoryIcon(expense.category)}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate" style={{ color: '#1e293b' }}>{expense.description}</p>
                          <p className="text-xs" style={{ color: '#94a3b8' }}>{getCategoryName(expense.category)}</p>
                        </div>
                        <span className="text-sm font-bold num-mono flex-shrink-0" style={{ color: '#dc2626' }}>₹{expense.amount.toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })
          ) : (
            /* ── Month View (grouped by category) ── */
            Object.keys(groupedByCategory).map((catId) => {
              const catExpenses = groupedByCategory[catId];
              const catTotal = catExpenses.reduce((s, e) => s + e.amount, 0);
              return (
                <div key={catId} className="rounded-xl overflow-hidden" style={{ border: '1px solid #e2e8f0' }}>
                  <div className="flex items-center gap-3 px-4 py-2.5" style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                    <span className="text-xl">{getCategoryIcon(catId)}</span>
                    <div className="flex-1">
                      <span className="text-sm font-bold" style={{ color: '#0f172a' }}>{getCategoryName(catId)}</span>
                      <span className="ml-2 text-xs" style={{ color: '#94a3b8' }}>{catExpenses.length} transaction{catExpenses.length !== 1 ? 's' : ''}</span>
                    </div>
                    <span className="text-sm font-bold num-mono" style={{ color: '#dc2626' }}>₹{catTotal.toFixed(2)}</span>
                  </div>
                  <div>
                    {catExpenses.map((expense) => (
                      <div key={expense.id} className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors" style={{ borderBottom: '1px solid #f8fafc' }}>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate" style={{ color: '#1e293b' }}>{expense.description}</p>
                          <p className="text-xs" style={{ color: '#94a3b8' }}>
                            {new Date(expense.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </p>
                        </div>
                        <span className="text-sm font-bold num-mono flex-shrink-0" style={{ color: '#dc2626' }}>₹{expense.amount.toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

