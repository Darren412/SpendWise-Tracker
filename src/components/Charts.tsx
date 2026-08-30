'use client';

import {
  BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { useBudgetStore } from '@/store/budgetStore';
import { formatCurrency, formatCurrencyShort } from '@/utils/currency';

export default function Charts() {
  const {
    categories,
    expenses: allExpenses,
    selectedMonth, selectedYear,
    selectedCity,
    excludedCategoryIds,
    currency,
  } = useBudgetStore();


  // Build the filtered expense set: period + city + category
  // This mirrors the same scoping as the rest of the expense-focused widgets.
  const filteredExpenses = allExpenses.filter(e => {
    const inPeriod = e.month === selectedMonth && e.year === selectedYear;
    const inCity   = selectedCity === 'Both' || !e.city || (e.city ?? 'Bangalore') === selectedCity;
    const inCat    = excludedCategoryIds.length === 0 || !excludedCategoryIds.includes(e.category);
    return inPeriod && inCity && inCat;
  });

  // Per-category totals from the already-filtered expense set (no extra store calls)
  const catTotals: Record<string, number> = {};
  for (const e of filteredExpenses) {
    catTotals[e.category] = (catTotals[e.category] ?? 0) + e.amount;
  }

  // Which categories to show: if a category filter is active, only show selected ones
  const visibleCategories = categories.filter(c =>
    c.type !== 'income' &&
    (excludedCategoryIds.length === 0 || !excludedCategoryIds.includes(c.id))
  );

  const barData = visibleCategories
    .map(cat => ({
      name: cat.name.length > 12 ? cat.name.slice(0, 12) + '\u2026' : cat.name,
      fullName: cat.name,
      color: cat.color,
      spent: catTotals[cat.id] ?? 0,
    }))
    .filter(d => d.spent > 0)
    .sort((a, b) => b.spent - a.spent);

  const barTotal = barData.reduce((s, d) => s + d.spent, 0);

  // Pie includes ALL categories in scope (expense + income) for distribution view,
  // but still respects category filter
  const pieCategories = categories.filter(c =>
    excludedCategoryIds.length === 0 || !excludedCategoryIds.includes(c.id)
  );
  const pieData = pieCategories
    .map(cat => ({
      id: cat.id,
      name: cat.name,
      value: catTotals[cat.id] ?? 0,
      color: cat.color,
    }))
    .filter(d => d.value > 0);

  const totalSpent = pieData.reduce((s, d) => s + d.value, 0);

  return (
    <div className="space-y-4">

      {/* Bar Chart — Category Spending Overview */}
      <div className="dark-card p-5">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <div>
            <p className="card-header-label mb-0.5">Category Spending Overview</p>
            <p className="text-xs" style={{ color: '#9ca3af' }}>
              Top categories by amount spent this period
              {excludedCategoryIds.length > 0 && (
                <span style={{ color: '#6366f1', marginLeft: 6, fontWeight: 600 }}>
                  · {excludedCategoryIds.length} categor{excludedCategoryIds.length === 1 ? 'y' : 'ies'} hidden
                </span>
              )}
            </p>
          </div>
        </div>

        {barData.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-12">
            <div className="w-14 h-14 rounded-full flex items-center justify-center" style={{ background: '#f4f6f9' }}>
              <span style={{ fontSize: 26 }}>📊</span>
            </div>
            <p className="text-sm font-semibold" style={{ color: '#9ca3af' }}>No spending data</p>
            <p className="text-xs" style={{ color: '#d1d5db' }}>
              {excludedCategoryIds.length > 0 ? 'No expenses match the active category filter' : 'Add expenses to see your breakdown'}
            </p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={barData} margin={{ top: 4, right: 4, left: -20, bottom: 50 }} barGap={4}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#9ca3af' }} angle={-35} textAnchor="end" height={60} interval={0} />
              <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} width={50} />
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const spent = payload.find(p => p.dataKey === 'spent')?.value as number ?? 0;
                  const pct = barTotal > 0 ? ((spent / barTotal) * 100).toFixed(1) : '0.0';
                  return (
                    <div style={{ background: '#fff', border: '1px solid #e8ecf0', borderRadius: 10, padding: '10px 14px', fontSize: 12, minWidth: 160, boxShadow: '0 4px 16px rgba(0,0,0,0.08)' }}>
                      <p style={{ fontWeight: 700, marginBottom: 6, color: '#111827' }}>{payload[0]?.payload?.fullName}</p>
                      <p style={{ color: '#4f46e5', marginBottom: 2 }}>Spent: {formatCurrency(spent, currency)}</p>
                      <p style={{ color: '#9ca3af' }}>{pct}% of total spend</p>
                    </div>
                  );
                }}
              />
              <Bar dataKey="spent" name="Spent" radius={[4, 4, 0, 0]} maxBarSize={36}>
                {barData.map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Pie — Spending Distribution */}
      <div className="dark-card p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="card-header-label mb-0.5">Spending Distribution</p>
            <p className="text-xs" style={{ color: '#9ca3af' }}>Breakdown by category this month</p>
          </div>
          {pieData.length > 0 && (
            <span className="badge badge-purple">{pieData.length} active</span>
          )}
        </div>

        {pieData.length > 0 ? (
          <>
            {/* Stats row */}
            <div className="grid grid-cols-3 gap-3 mb-4">
              {[
                { label: 'Total Spent', value: formatCurrencyShort(totalSpent, currency) },
                { label: 'Top Category', value: [...pieData].sort((a, b) => b.value - a.value)[0]?.name?.split(' ')[0] ?? '-' },
                { label: 'Avg / Category', value: formatCurrencyShort(totalSpent / pieData.length, currency) },
              ].map(({ label, value }) => (
                <div key={label} className="rounded-xl p-3 text-center" style={{ background: '#f8fafc', border: '1px solid #e8ecf0' }}>
                  <p className="card-header-label mb-1">{label}</p>
                  <p className="text-sm font-bold truncate" style={{ color: '#111827' }}>{value}</p>
                </div>
              ))}
            </div>

            <div style={{ position: 'relative' }}>
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={65} outerRadius={105} paddingAngle={2} dataKey="value">
                    {pieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                  </Pie>
                  <Tooltip
                    formatter={(value, name) => [`${formatCurrency(Number(value), currency)} (${totalSpent > 0 ? ((Number(value) / totalSpent) * 100).toFixed(1) : '0.0'}%)`, name]}
                    contentStyle={{ background: '#fff', border: '1px solid #e8ecf0', borderRadius: 10, fontSize: 12, boxShadow: '0 4px 16px rgba(0,0,0,0.08)' }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', textAlign: 'center', pointerEvents: 'none' }}>
                <p className="card-header-label">Total</p>
                <p className="text-lg font-bold num-mono" style={{ color: '#111827' }}>{formatCurrencyShort(totalSpent, currency)}</p>
              </div>
            </div>

            {/* Legend */}
            <div className="mt-4 space-y-2">
              {[...pieData].sort((a, b) => b.value - a.value).map(item => {
                const pct = totalSpent > 0 ? (item.value / totalSpent) * 100 : 0;
                return (
                  <div key={item.id} className="flex items-center gap-3">
                    <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: item.color }} />
                    <span className="text-xs font-medium flex-1 truncate" style={{ color: '#374151' }}>{item.name}</span>
                    <div className="w-16 progress-track flex-shrink-0">
                      <div className="progress-fill" style={{ width: `${pct}%`, background: item.color }} />
                    </div>
                    <span className="text-xs font-semibold w-9 text-right num-mono flex-shrink-0" style={{ color: '#6b7280' }}>{pct.toFixed(0)}%</span>
                    <span className="text-xs num-mono w-16 text-right flex-shrink-0" style={{ color: '#9ca3af' }}>{formatCurrencyShort(item.value, currency)}</span>
                  </div>
                );
              })}
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center gap-2 py-16">
            <div className="w-14 h-14 rounded-full flex items-center justify-center" style={{ background: '#f4f6f9' }}>
              <span style={{ fontSize: 26 }}>📊</span>
            </div>
            <p className="text-sm font-semibold" style={{ color: '#9ca3af' }}>No spending data yet</p>
            <p className="text-xs" style={{ color: '#d1d5db' }}>
              {excludedCategoryIds.length > 0 ? 'No expenses match the active category filter' : 'Add expenses to see your breakdown'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
