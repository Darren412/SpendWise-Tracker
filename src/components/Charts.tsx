'use client';

import { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { useBudgetStore } from '@/store/budgetStore';

export default function Charts() {
  const { categories, getCategoryTotal, selectedMonth, selectedYear } = useBudgetStore();
  const [selectedCategories, setSelectedCategories] = useState<Set<string>>(
    new Set(categories.map((cat) => cat.id))
  );
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const filterRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (filterRef.current && !filterRef.current.contains(e.target as Node)) {
        setIsDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Handle category filter toggle
  const toggleCategory = (categoryId: string) => {
    const newSelected = new Set(selectedCategories);
    if (newSelected.has(categoryId)) {
      newSelected.delete(categoryId);
    } else {
      newSelected.add(categoryId);
    }
    setSelectedCategories(newSelected);
  };

  // Handle select/deselect all
  const toggleAll = (selectAll: boolean) => {
    if (selectAll) {
      setSelectedCategories(new Set(categories.map((cat) => cat.id)));
    } else {
      setSelectedCategories(new Set());
    }
  };

  // Filter categories based on selection
  const filteredCategories = categories.filter((cat) => selectedCategories.has(cat.id));
  const selectedCount = selectedCategories.size;

  const categoryChartData = filteredCategories.map((cat) => ({
    name: cat.name,
    spent: getCategoryTotal(cat.id, selectedMonth, selectedYear),
    budget: cat.budget,
  }));

  const pieChartData = filteredCategories
    .map((cat) => ({
      name: cat.name,
      value: getCategoryTotal(cat.id, selectedMonth, selectedYear),
      color: cat.color,
    }))
    .filter((item) => item.value > 0);

  return (
    <div className="space-y-4">
      {/* Filter Dropdown Section */}
      <div className="relative" ref={filterRef}>
        <div
          className="dark-card p-4 cursor-pointer select-none"
          style={{ border: '1px solid rgba(124,58,237,0.18)' }}
          onClick={() => setIsDropdownOpen(!isDropdownOpen)}
        >
          <div className="flex items-center gap-3">
            <div className="w-1 h-6 rounded-full" style={{ background: 'linear-gradient(180deg, #7c3aed, #0891b2)' }} />
            <span className="graffiti-font text-xl" style={{ color: '#1e293b' }}>FILTER CATEGORIES</span>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold" style={{ background: 'rgba(124,58,237,0.08)', color: '#7c3aed', border: '1px solid rgba(124,58,237,0.25)' }}>
              {selectedCount} / {categories.length}
            </span>
            <ChevronDown
              size={18}
              className={`ml-auto transition-transform duration-300 ${isDropdownOpen ? 'rotate-180' : ''}`}
              style={{ color: '#7c3aed', flexShrink: 0 }}
            />
          </div>
        </div>

        {/* Dropdown Content */}
        {isDropdownOpen && (
          <div className="absolute top-full left-0 right-0 z-50 mt-2 rounded-2xl shadow-2xl" style={{ background: '#ffffff', border: '1px solid rgba(124,58,237,0.2)' }}>
            <div className="flex gap-2 p-4" style={{ borderBottom: '1px solid #e2e8f0' }}>
              <button onClick={() => toggleAll(true)} className="btn-neon-green flex-1 px-3 py-2 rounded-lg text-sm">
                Select All
              </button>
              <button onClick={() => toggleAll(false)} className="flex-1 px-3 py-2 rounded-lg text-sm font-bold transition-colors" style={{ background: '#f1f5f9', color: '#64748b', border: '1px solid #e2e8f0' }}>
                Clear All
              </button>
            </div>
            <div className="p-4 max-h-60 overflow-y-auto">
              <div className="space-y-2">
                {categories.map((category) => (
                  <label key={category.id} className="flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-all" style={{ background: '#f8f9fc', border: '1px solid #e2e8f0' }}>
                    <input type="checkbox" checked={selectedCategories.has(category.id)} onChange={() => toggleCategory(category.id)} className="w-4 h-4 rounded cursor-pointer accent-purple-500" />
                    <span className="text-xl">{category.icon}</span>
                    <span className="flex-1 text-sm font-medium" style={{ color: '#374151' }}>{category.name}</span>
                    <span className="text-xs font-mono" style={{ color: '#94a3b8' }}>₹{getCategoryTotal(category.id, selectedMonth, selectedYear).toFixed(2)}</span>
                  </label>
                ))}
              </div>
            </div>

          </div>
        )}
      </div>

      {/* Bar Chart */}
      <div className="dark-card glow-cyan p-5" style={{ border: '1px solid rgba(8,145,178,0.18)' }}>
        <div className="flex items-center gap-2 mb-3">
          <div className="w-1 h-5 rounded-full" style={{ background: 'linear-gradient(180deg, #0891b2, #7c3aed)' }} />
          <h3 className="graffiti-font text-xl" style={{ color: '#1e293b' }}>BUDGET VS SPENDING</h3>
        </div>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={categoryChartData} margin={{ top: 4, right: 8, left: -10, bottom: 55 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
            <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#94a3b8' }} angle={-40} textAnchor="end" height={65} interval={0} />
            <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} width={44} />
            <Tooltip
              formatter={(value) => `₹${typeof value === 'number' ? value.toFixed(2) : value}`}
              contentStyle={{ backgroundColor: '#ffffff', border: '1px solid rgba(124,58,237,0.2)', borderRadius: '10px', color: '#0f172a', fontSize: '12px' }}
            />
            <Legend wrapperStyle={{ paddingTop: '6px', color: '#64748b', fontSize: '11px' }} />
            <Bar dataKey="budget" fill="#34d399" name="Budget" radius={[4, 4, 0, 0]} />
            <Bar dataKey="spent" fill="#fb7185" name="Spent" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Pie Chart */}
      <div className="dark-card p-5" style={{ borderTop: '3px solid #6366f1' }}>
        {/* Header */}
        <div className="flex items-center gap-2 mb-4">
          <div>
            <h3 className="text-sm font-bold uppercase tracking-wider" style={{ color: '#0f172a' }}>Spending Distribution</h3>
            <p className="text-xs mt-0.5" style={{ color: '#94a3b8' }}>Breakdown by category for this month</p>
          </div>
          <span
            className="ml-auto text-xs font-semibold px-2.5 py-1 rounded-full"
            style={{ background: '#eef2ff', color: '#6366f1' }}
          >
            {pieChartData.length} active
          </span>
        </div>

        {pieChartData.length > 0 ? (() => {
          const totalSpent = pieChartData.reduce((s, d) => s + d.value, 0);
          const topCat = [...pieChartData].sort((a, b) => b.value - a.value)[0];
          const avgSpend = totalSpent / pieChartData.length;
          const sorted = [...pieChartData].sort((a, b) => b.value - a.value);

          return (
            <>
              {/* Summary Stats Row */}
              <div className="grid grid-cols-3 gap-3 mb-5">
                {[
                  { label: 'Total Spent', value: `₹${totalSpent.toFixed(0)}`, color: '#6366f1' },
                  { label: 'Top Category', value: topCat.name, color: '#dc2626' },
                  { label: 'Avg / Category', value: `₹${avgSpend.toFixed(0)}`, color: '#0891b2' },
                ].map(({ label, value, color }) => (
                  <div key={label} className="rounded-xl p-3 text-center" style={{ background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                    <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: '#94a3b8' }}>{label}</p>
                    <p className="text-sm font-bold truncate" style={{ color }}>{value}</p>
                  </div>
                ))}
              </div>

              {/* Donut Chart with center label */}
              <div style={{ position: 'relative' }}>
                <ResponsiveContainer width="100%" height={280}>
                  <PieChart>
                    <Pie
                      data={pieChartData}
                      cx="50%"
                      cy="50%"
                      innerRadius={75}
                      outerRadius={120}
                      paddingAngle={2}
                      dataKey="value"
                    >
                      {pieChartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value, name) => {
                        const pct = ((Number(value) / totalSpent) * 100).toFixed(1);
                        return [`₹${Number(value).toFixed(2)} (${pct}%)`, name];
                      }}
                      contentStyle={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '10px', color: '#0f172a', fontSize: '12px', boxShadow: '0 4px 16px rgba(0,0,0,0.08)' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                {/* Center Label */}
                <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', textAlign: 'center', pointerEvents: 'none' }}>
                  <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#94a3b8' }}>Total</p>
                  <p className="text-xl font-bold num-mono" style={{ color: '#0f172a' }}>₹{totalSpent.toFixed(0)}</p>
                </div>
              </div>

              {/* Category Breakdown Legend */}
              <div className="mt-5 space-y-2.5">
                <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: '#94a3b8' }}>Category Breakdown</p>
                {sorted.map((item) => {
                  const pct = (item.value / totalSpent) * 100;
                  return (
                    <div key={item.name} className="flex items-center gap-3">
                      <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: item.color }} />
                      <span className="text-xs font-medium flex-1 truncate" style={{ color: '#334155' }}>{item.name}</span>
                      <div className="w-20 h-1.5 rounded-full flex-shrink-0" style={{ background: '#f1f5f9' }}>
                        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: item.color }} />
                      </div>
                      <span className="text-xs font-bold w-10 text-right num-mono flex-shrink-0" style={{ color: '#64748b' }}>{pct.toFixed(1)}%</span>
                      <span className="text-xs num-mono w-20 text-right flex-shrink-0" style={{ color: '#94a3b8' }}>₹{item.value.toFixed(0)}</span>
                    </div>
                  );
                })}
              </div>
            </>
          );
        })() : (
          <div className="flex flex-col items-center justify-center gap-2" style={{ height: '300px' }}>
            <div className="w-16 h-16 rounded-full flex items-center justify-center" style={{ background: '#f1f5f9' }}>
              <span style={{ fontSize: '28px' }}>📊</span>
            </div>
            <p className="text-sm font-semibold" style={{ color: '#94a3b8' }}>No spending data yet</p>
            <p className="text-xs" style={{ color: '#cbd5e1' }}>Add expenses to see your breakdown</p>
          </div>
        )}
      </div>
    </div>
  );
}
