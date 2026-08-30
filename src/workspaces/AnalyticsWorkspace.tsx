'use client';

import { useMemo } from 'react';
import {
  BarChart2, TrendingUp, TrendingDown, Minus, Flame, Calendar,
  Zap, Target, ArrowUpRight, ArrowDownRight, Clock, DollarSign,
} from 'lucide-react';
import {
  BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  AreaChart, Area,
} from 'recharts';
import { useBudgetStore } from '@/store/budgetStore';
import { formatCurrency, formatCurrencyShort, currencySymbol } from '@/utils/currency';
import { getFinancialMonthRange } from '@/utils/financialCycle';
import DailySpendTracker from '@/components/DailySpendTracker';
import WeeklySpendTracker from '@/components/WeeklySpendTracker';

// ── Helpers ──────────────────────────────────────────────────────────────

const DOW_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DOW_COLORS = ['#ef4444', '#6366f1', '#6366f1', '#6366f1', '#6366f1', '#6366f1', '#8b5cf6'];

function prevPeriod(month: string, year: number): { month: string; year: number } {
  let m = parseInt(month, 10) - 1;
  let y = year;
  if (m < 1) { m = 12; y -= 1; }
  return { month: m.toString().padStart(2, '0'), year: y };
}

// ── Main Component ───────────────────────────────────────────────────────

export default function AnalyticsWorkspace() {
  const {
    expenses: allExpenses,
    income: allIncome,
    categories,
    selectedMonth, selectedYear,
    selectedCity,
    excludedCategoryIds,
    currency,
    financialCycleStart,
  } = useBudgetStore();

  const sym = currencySymbol(currency);
  const { start, end } = getFinancialMonthRange(selectedMonth, selectedYear, financialCycleStart);
  const prev = prevPeriod(selectedMonth, selectedYear);
  const { start: prevStart, end: prevEnd } = getFinancialMonthRange(prev.month, prev.year, financialCycleStart);

  // ── Filtered expenses (current period) ─────────────────────────────────

  const filteredExpenses = useMemo(() => allExpenses.filter(e => {
    if (e.month !== selectedMonth || e.year !== selectedYear) return false;
    if (selectedCity !== 'Both' && (e.city ?? 'Bangalore') !== selectedCity) return false;
    if (excludedCategoryIds.length > 0 && excludedCategoryIds.includes(e.category)) return false;
    return true;
  }), [allExpenses, selectedMonth, selectedYear, selectedCity, excludedCategoryIds]);

  const prevExpenses = useMemo(() => allExpenses.filter(e => {
    if (e.month !== prev.month || e.year !== prev.year) return false;
    if (selectedCity !== 'Both' && (e.city ?? 'Bangalore') !== selectedCity) return false;
    if (excludedCategoryIds.length > 0 && excludedCategoryIds.includes(e.category)) return false;
    return true;
  }), [allExpenses, prev.month, prev.year, selectedCity, excludedCategoryIds]);

  const filteredIncome = useMemo(() => allIncome.filter(i =>
    i.month === selectedMonth && i.year === selectedYear
  ), [allIncome, selectedMonth, selectedYear]);

  // ── Core metrics ───────────────────────────────────────────────────────

  const totalSpent = useMemo(() => filteredExpenses.reduce((s, e) => s + e.amount, 0), [filteredExpenses]);
  const prevTotalSpent = useMemo(() => prevExpenses.reduce((s, e) => s + e.amount, 0), [prevExpenses]);
  const totalIncome = useMemo(() => filteredIncome.reduce((s, i) => s + i.amount, 0), [filteredIncome]);
  const txnCount = filteredExpenses.length;

  const totalDays = Math.round((end.getTime() - start.getTime()) / 86400000) + 1;
  const now = new Date();
  const isCurrentPeriod = now >= start && now <= new Date(end.getFullYear(), end.getMonth(), end.getDate(), 23, 59, 59);
  const elapsedDays = isCurrentPeriod
    ? Math.max(1, Math.ceil((now.getTime() - start.getTime()) / 86400000) + 1)
    : totalDays;
  const avgDaily = elapsedDays > 0 ? totalSpent / elapsedDays : 0;
  const activeDays = useMemo(() => {
    const seen = new Set<string>();
    filteredExpenses.forEach(e => { if (e.date) seen.add(e.date.slice(0, 10)); });
    return seen.size;
  }, [filteredExpenses]);

  const momChange = prevTotalSpent > 0 ? ((totalSpent - prevTotalSpent) / prevTotalSpent) * 100 : 0;

  // Projected spend for the full period
  const projectedSpend = isCurrentPeriod && elapsedDays > 0
    ? (totalSpent / elapsedDays) * totalDays
    : totalSpent;

  // ── Category data ──────────────────────────────────────────────────────

  const catTotals: Record<string, number> = {};
  for (const e of filteredExpenses) catTotals[e.category] = (catTotals[e.category] ?? 0) + e.amount;
  const prevCatTotals: Record<string, number> = {};
  for (const e of prevExpenses) prevCatTotals[e.category] = (prevCatTotals[e.category] ?? 0) + e.amount;

  const expenseCategories = categories.filter(c =>
    c.type !== 'income' && (excludedCategoryIds.length === 0 || !excludedCategoryIds.includes(c.id))
  );

  const barData = useMemo(() => expenseCategories
    .map(cat => ({
      name: cat.name.length > 10 ? cat.name.slice(0, 10) + '\u2026' : cat.name,
      fullName: cat.name,
      color: cat.color,
      icon: cat.icon,
      spent: catTotals[cat.id] ?? 0,
      prev: prevCatTotals[cat.id] ?? 0,
    }))
    .filter(d => d.spent > 0)
    .sort((a, b) => b.spent - a.spent),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [filteredExpenses, prevExpenses, categories, excludedCategoryIds]);

  const pieData = useMemo(() => expenseCategories
    .map(cat => ({
      id: cat.id,
      name: cat.name,
      value: catTotals[cat.id] ?? 0,
      color: cat.color,
      icon: cat.icon,
    }))
    .filter(d => d.value > 0)
    .sort((a, b) => b.value - a.value),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [filteredExpenses, categories, excludedCategoryIds]);

  // ── Day-of-week analysis ───────────────────────────────────────────────

  const dowData = useMemo(() => {
    const totals = [0, 0, 0, 0, 0, 0, 0];
    const counts = [0, 0, 0, 0, 0, 0, 0];
    filteredExpenses.forEach(e => {
      if (!e.date) return;
      const d = new Date(e.date + 'T00:00:00');
      const dow = d.getDay();
      totals[dow] += e.amount;
      counts[dow]++;
    });
    const max = Math.max(...totals);
    return DOW_LABELS.map((label, i) => ({
      day: label,
      total: totals[i],
      count: counts[i],
      pct: max > 0 ? (totals[i] / max) * 100 : 0,
    }));
  }, [filteredExpenses]);

  const peakDow = useMemo(() => dowData.reduce((mx, d) => d.total > mx.total ? d : mx, dowData[0]), [dowData]);

  // ── Top expenses ───────────────────────────────────────────────────────

  const topExpenses = useMemo(() =>
    [...filteredExpenses].sort((a, b) => b.amount - a.amount).slice(0, 5),
    [filteredExpenses]);

  // ── Cumulative spending curve (current vs previous) ────────────────────

  const cumulativeData = useMemo(() => {
    const buildCurve = (exps: typeof filteredExpenses, rangeStart: Date, rangeEnd: Date) => {
      const days = Math.round((rangeEnd.getTime() - rangeStart.getTime()) / 86400000) + 1;
      const dailyMap: Record<number, number> = {};
      exps.forEach(e => {
        if (!e.date) return;
        const d = new Date(e.date + 'T00:00:00');
        const dayIdx = Math.round((d.getTime() - rangeStart.getTime()) / 86400000);
        if (dayIdx >= 0 && dayIdx < days) dailyMap[dayIdx] = (dailyMap[dayIdx] ?? 0) + e.amount;
      });
      let cum = 0;
      return Array.from({ length: days }, (_, i) => {
        cum += dailyMap[i] ?? 0;
        return cum;
      });
    };

    const currCurve = buildCurve(filteredExpenses, start, end);
    const prevCurve = buildCurve(prevExpenses, prevStart, prevEnd);

    const maxLen = Math.max(currCurve.length, prevCurve.length);
    return Array.from({ length: maxLen }, (_, i) => ({
      day: i + 1,
      current: currCurve[i] ?? currCurve[currCurve.length - 1] ?? 0,
      previous: prevCurve[i] ?? prevCurve[prevCurve.length - 1] ?? 0,
    }));
  }, [filteredExpenses, prevExpenses, start, end, prevStart, prevEnd]);

  // ── Category momentum ─────────────────────────────────────────────────

  const categoryMomentum = useMemo(() => expenseCategories
    .map(c => {
      const curr = catTotals[c.id] ?? 0;
      const prev = prevCatTotals[c.id] ?? 0;
      const change = prev > 0 ? ((curr - prev) / prev) * 100 : (curr > 0 ? 100 : 0);
      return { ...c, curr, prev, change };
    })
    .filter(c => c.curr > 0 || c.prev > 0)
    .sort((a, b) => Math.abs(b.change) - Math.abs(a.change))
    .slice(0, 6),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [filteredExpenses, prevExpenses, categories, excludedCategoryIds]);

  // ── Render ─────────────────────────────────────────────────────────────

  const statCard = (
    icon: React.ReactNode, label: string, value: string,
    sub?: string, accent?: string,
  ) => (
    <div className="dark-card" style={{ padding: '16px 18px', display: 'flex', alignItems: 'flex-start', gap: 12 }}>
      <div style={{
        width: 38, height: 38, borderRadius: 10,
        background: `${accent ?? '#6366f1'}12`,
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      }}>
        {icon}
      </div>
      <div style={{ minWidth: 0 }}>
        <p style={{ fontSize: 10, fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3 }}>{label}</p>
        <p style={{ fontSize: 18, fontWeight: 800, color: '#111827', fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>{value}</p>
        {sub && <p style={{ fontSize: 10, color: '#9ca3af', marginTop: 4 }}>{sub}</p>}
      </div>
    </div>
  );

  return (
    <div style={{ maxWidth: 1400 }}>

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="ws-header">
        <div>
          <h1 className="ws-title" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <BarChart2 size={20} style={{ color: 'var(--brand-600)' }} />
            Analytics
          </h1>
          <p className="ws-subtitle">
            Spending patterns · Weekly breakdown · Category trends · Behavioural insights
          </p>
        </div>
      </div>

      {/* ── Summary Stats Row ──────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 20 }}>
        {statCard(
          <DollarSign size={16} color="#ef4444" />,
          'Total Spent',
          formatCurrencyShort(totalSpent, currency),
          `${txnCount} transactions · ${activeDays} active days`,
          '#ef4444',
        )}
        {statCard(
          <Flame size={16} color="#f59e0b" />,
          'Daily Average',
          formatCurrency(avgDaily, currency),
          `over ${elapsedDays} elapsed days`,
          '#f59e0b',
        )}
        {statCard(
          <Target size={16} color="#8b5cf6" />,
          isCurrentPeriod ? 'Projected' : 'Final Total',
          formatCurrencyShort(projectedSpend, currency),
          isCurrentPeriod ? `${totalDays - elapsedDays} days remaining` : `${totalDays} day period`,
          '#8b5cf6',
        )}
        {statCard(
          momChange >= 0
            ? <ArrowUpRight size={16} color="#ef4444" />
            : <ArrowDownRight size={16} color="#10b981" />,
          'vs Last Period',
          prevTotalSpent > 0 ? `${momChange >= 0 ? '+' : ''}${momChange.toFixed(1)}%` : '—',
          prevTotalSpent > 0
            ? `${formatCurrencyShort(prevTotalSpent, currency)} last period`
            : 'No previous data',
          momChange >= 0 ? '#ef4444' : '#10b981',
        )}
        {statCard(
          <Zap size={16} color="#10b981" />,
          'Net Balance',
          formatCurrencyShort(totalIncome - totalSpent, currency),
          totalIncome > 0
            ? `${Math.round(((totalIncome - totalSpent) / totalIncome) * 100)}% savings rate`
            : 'No income recorded',
          totalIncome - totalSpent >= 0 ? '#10b981' : '#ef4444',
        )}
      </div>

      {/* ── Daily Spend Tracker ────────────────────────────────────────── */}
      <div className="panel" style={{ marginBottom: 16 }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--bg-muted)' }}>
          <div style={{ fontSize: '0.9375rem', fontWeight: 700, color: 'var(--text-900)' }}>Daily Spend Tracker</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-400)', marginTop: 2 }}>Day-by-day spending across your financial period</div>
        </div>
        <div style={{ padding: '4px 0' }}>
          <DailySpendTracker />
        </div>
      </div>

      {/* ── Weekly Spend Breakdown ─────────────────────────────────────── */}
      <div className="panel" style={{ marginBottom: 16 }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--bg-muted)' }}>
          <div style={{ fontSize: '0.9375rem', fontWeight: 700, color: 'var(--text-900)' }}>Weekly Spend Tracker</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-400)', marginTop: 2 }}>Week-by-week spending across your financial period</div>
        </div>
        <div style={{ padding: '4px 0' }}>
          <WeeklySpendTracker />
        </div>
      </div>

      {/* ── Spending Pace: Cumulative Current vs Previous ──────────────── */}
      <div className="dark-card p-5" style={{ marginBottom: 16 }}>
        <div className="flex items-start justify-between mb-4 flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div style={{ width: 34, height: 34, borderRadius: 9, background: '#f0fdf4', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <TrendingUp size={15} color="#10b981" />
            </div>
            <div>
              <p className="card-header-label mb-0">Spending Pace</p>
              <p className="text-xs" style={{ color: '#9ca3af' }}>
                Cumulative spend: current period vs previous
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5">
              <div style={{ width: 14, height: 3, borderRadius: 2, background: '#6366f1' }} />
              <span style={{ fontSize: 10, color: '#9ca3af' }}>Current</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div style={{ width: 14, height: 3, borderRadius: 2, background: '#d1d5db' }} />
              <span style={{ fontSize: 10, color: '#9ca3af' }}>Previous</span>
            </div>
          </div>
        </div>

        {totalSpent === 0 && prevTotalSpent === 0 ? (
          <div style={{ padding: '40px 0', textAlign: 'center' }}>
            <p style={{ fontSize: 12, color: '#9ca3af' }}>No spending data to compare</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={cumulativeData} margin={{ top: 5, right: 10, left: -8, bottom: 0 }}>
              <defs>
                <linearGradient id="gradCurr" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
              <XAxis
                dataKey="day"
                tick={{ fontSize: 10, fill: '#9ca3af' }}
                tickLine={false} axisLine={false}
                tickFormatter={(v: number) => v % 5 === 0 || v === 1 ? `Day ${v}` : ''}
              />
              <YAxis
                tick={{ fontSize: 10, fill: '#9ca3af' }}
                tickLine={false} axisLine={false} width={50}
                tickFormatter={(v: number) => {
                  if (v === 0) return '';
                  if (v >= 100000) return `${sym}${(v / 100000).toFixed(0)}L`;
                  if (v >= 1000) return `${sym}${(v / 1000).toFixed(0)}k`;
                  return `${sym}${v}`;
                }}
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const d = payload[0]?.payload;
                  return (
                    <div style={{ background: '#fff', border: '1px solid #e8ecf0', borderRadius: 10, padding: '10px 14px', fontSize: 12, boxShadow: '0 4px 16px rgba(0,0,0,0.08)', minWidth: 160 }}>
                      <p style={{ fontWeight: 700, color: '#374151', marginBottom: 6 }}>Day {d?.day}</p>
                      <p style={{ color: '#6366f1', marginBottom: 2 }}>Current: {formatCurrency(d?.current ?? 0, currency)}</p>
                      <p style={{ color: '#9ca3af' }}>Previous: {formatCurrency(d?.previous ?? 0, currency)}</p>
                    </div>
                  );
                }}
              />
              <Area type="monotone" dataKey="previous" stroke="#d1d5db" strokeWidth={1.5} strokeDasharray="4 3" fill="none" />
              <Area type="monotone" dataKey="current" stroke="#6366f1" strokeWidth={2} fill="url(#gradCurr)" />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* ── Category Charts (2-col) ───────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 16, marginBottom: 16 }}>

        {/* Category Spending Bar Chart */}
        <div className="dark-card p-5">
          <div className="flex items-center gap-3 mb-4">
            <div style={{ width: 34, height: 34, borderRadius: 9, background: '#eef2ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <BarChart2 size={15} color="#6366f1" />
            </div>
            <div>
              <p className="card-header-label mb-0">Category Spending</p>
              <p className="text-xs" style={{ color: '#9ca3af' }}>Top categories by amount this period</p>
            </div>
          </div>

          {barData.length === 0 ? (
            <div style={{ padding: '48px 0', textAlign: 'center' }}>
              <p style={{ fontSize: 24, marginBottom: 6 }}>📊</p>
              <p style={{ fontSize: 12, color: '#9ca3af' }}>No spending data</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={barData.length * 40 + 20}>
              <BarChart data={barData} layout="vertical" margin={{ top: 0, right: 10, left: 0, bottom: 0 }} barGap={2}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" horizontal={false} />
                <XAxis
                  type="number" tick={{ fontSize: 10, fill: '#9ca3af' }}
                  tickLine={false} axisLine={false}
                  tickFormatter={(v: number) => {
                    if (v >= 100000) return `${sym}${(v / 100000).toFixed(0)}L`;
                    if (v >= 1000) return `${sym}${(v / 1000).toFixed(0)}k`;
                    return v > 0 ? `${sym}${v}` : '';
                  }}
                />
                <YAxis
                  type="category" dataKey="name" tick={{ fontSize: 11, fill: '#374151', fontWeight: 600 }}
                  tickLine={false} axisLine={false} width={90}
                />
                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const d = payload[0]?.payload;
                    const pct = totalSpent > 0 ? ((d.spent / totalSpent) * 100).toFixed(1) : '0';
                    const prevAmt = d.prev ?? 0;
                    const chg = prevAmt > 0 ? (((d.spent - prevAmt) / prevAmt) * 100).toFixed(0) : null;
                    return (
                      <div style={{ background: '#fff', border: '1px solid #e8ecf0', borderRadius: 10, padding: '10px 14px', fontSize: 12, boxShadow: '0 4px 16px rgba(0,0,0,0.08)', minWidth: 170 }}>
                        <p style={{ fontWeight: 700, color: '#111827', marginBottom: 4 }}>{d.icon} {d.fullName}</p>
                        <p style={{ color: '#6366f1' }}>Spent: {formatCurrency(d.spent, currency)}</p>
                        <p style={{ color: '#9ca3af' }}>{pct}% of total</p>
                        {chg !== null && (
                          <p style={{ color: parseFloat(chg) > 0 ? '#ef4444' : '#10b981', marginTop: 2, fontWeight: 600 }}>
                            {parseFloat(chg) > 0 ? '+' : ''}{chg}% vs last period
                          </p>
                        )}
                      </div>
                    );
                  }}
                />
                <Bar dataKey="spent" radius={[0, 6, 6, 0]} maxBarSize={24}>
                  {barData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Spending Distribution Donut */}
        <div className="dark-card p-5">
          <div className="flex items-center gap-3 mb-4">
            <div style={{ width: 34, height: 34, borderRadius: 9, background: '#fdf2f8', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Target size={15} color="#ec4899" />
            </div>
            <div>
              <p className="card-header-label mb-0">Spending Distribution</p>
              <p className="text-xs" style={{ color: '#9ca3af' }}>Proportional breakdown by category</p>
            </div>
          </div>

          {pieData.length === 0 ? (
            <div style={{ padding: '48px 0', textAlign: 'center' }}>
              <p style={{ fontSize: 24, marginBottom: 6 }}>📊</p>
              <p style={{ fontSize: 12, color: '#9ca3af' }}>No spending data</p>
            </div>
          ) : (
            <>
              <div style={{ position: 'relative' }}>
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie data={pieData} cx="50%" cy="50%" innerRadius={62} outerRadius={100} paddingAngle={2} dataKey="value">
                      {pieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                    </Pie>
                    <Tooltip
                      formatter={(value: number, name: string) => [
                        `${formatCurrency(value, currency)} (${((value / totalSpent) * 100).toFixed(1)}%)`, name
                      ]}
                      contentStyle={{ background: '#fff', border: '1px solid #e8ecf0', borderRadius: 10, fontSize: 12, boxShadow: '0 4px 16px rgba(0,0,0,0.08)' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', textAlign: 'center', pointerEvents: 'none' }}>
                  <p style={{ fontSize: 10, fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Total</p>
                  <p style={{ fontSize: 18, fontWeight: 800, color: '#111827', fontVariantNumeric: 'tabular-nums' }}>{formatCurrencyShort(totalSpent, currency)}</p>
                </div>
              </div>

              {/* Legend */}
              <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
                {pieData.slice(0, 6).map(item => {
                  const pct = totalSpent > 0 ? (item.value / totalSpent) * 100 : 0;
                  return (
                    <div key={item.id} className="flex items-center gap-3">
                      <span style={{ fontSize: 14, width: 20, textAlign: 'center', flexShrink: 0 }}>{item.icon}</span>
                      <span style={{ fontSize: 11, fontWeight: 600, color: '#374151', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name}</span>
                      <div style={{ width: 50, height: 5, borderRadius: 100, background: '#f3f4f6', flexShrink: 0 }}>
                        <div style={{ height: '100%', borderRadius: 100, background: item.color, width: `${Math.min(pct, 100)}%` }} />
                      </div>
                      <span style={{ fontSize: 10, fontWeight: 700, color: '#6b7280', width: 30, textAlign: 'right', flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>{pct.toFixed(0)}%</span>
                      <span style={{ fontSize: 10, color: '#9ca3af', width: 55, textAlign: 'right', flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>{formatCurrencyShort(item.value, currency)}</span>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── Bottom Analytics Grid (3-col) ─────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16, marginBottom: 16 }}>

        {/* Day-of-Week Patterns */}
        <div className="dark-card p-5">
          <div className="flex items-center gap-3 mb-4">
            <div style={{ width: 34, height: 34, borderRadius: 9, background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Calendar size={15} color="#3b82f6" />
            </div>
            <div>
              <p className="card-header-label mb-0">Day-of-Week Patterns</p>
              <p className="text-xs" style={{ color: '#9ca3af' }}>
                Peak: <span style={{ fontWeight: 700, color: '#374151' }}>{peakDow.day}</span>
                {peakDow.total > 0 && <> ({formatCurrencyShort(peakDow.total, currency)})</>}
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {dowData.map((d, i) => (
              <div key={d.day} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{
                  fontSize: 11, fontWeight: 700, width: 30, flexShrink: 0,
                  color: d.day === peakDow.day && d.total > 0 ? DOW_COLORS[i] : '#9ca3af',
                }}>{d.day}</span>
                <div style={{ flex: 1, height: 8, borderRadius: 100, background: '#f3f4f6', position: 'relative', overflow: 'hidden' }}>
                  <div style={{
                    height: '100%', borderRadius: 100,
                    background: d.day === peakDow.day && d.total > 0 ? DOW_COLORS[i] : '#c7d2fe',
                    width: `${d.pct}%`,
                    transition: 'width 0.4s ease',
                  }} />
                </div>
                <span style={{ fontSize: 10, fontWeight: 600, color: '#6b7280', width: 52, textAlign: 'right', flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>
                  {d.total > 0 ? formatCurrencyShort(d.total, currency) : '—'}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Top Expenses */}
        <div className="dark-card p-5">
          <div className="flex items-center gap-3 mb-4">
            <div style={{ width: 34, height: 34, borderRadius: 9, background: '#fef2f2', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Flame size={15} color="#ef4444" />
            </div>
            <div>
              <p className="card-header-label mb-0">Top Expenses</p>
              <p className="text-xs" style={{ color: '#9ca3af' }}>Biggest transactions this period</p>
            </div>
          </div>

          {topExpenses.length === 0 ? (
            <div style={{ padding: '32px 0', textAlign: 'center' }}>
              <p style={{ fontSize: 12, color: '#9ca3af' }}>No transactions yet</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {topExpenses.map((e, i) => {
                const cat = categories.find(c => c.id === e.category);
                return (
                  <div key={e.id} style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '8px 10px', borderRadius: 10,
                    background: i === 0 ? '#fef2f2' : 'transparent',
                  }}>
                    <span style={{ fontSize: 12, fontWeight: 800, color: i === 0 ? '#ef4444' : '#d1d5db', width: 18, textAlign: 'center', flexShrink: 0 }}>
                      {i + 1}
                    </span>
                    <div style={{
                      width: 28, height: 28, borderRadius: 7,
                      background: cat ? `${cat.color}1a` : '#f3f4f6',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 13, flexShrink: 0,
                    }}>
                      {cat?.icon ?? '📦'}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 11, fontWeight: 600, color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {e.description || 'Expense'}
                      </p>
                      <p style={{ fontSize: 9, color: '#9ca3af', marginTop: 1 }}>
                        {new Date(e.date + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                        {' · '}{cat?.name ?? 'Other'}
                      </p>
                    </div>
                    <span style={{
                      fontSize: 12, fontWeight: 700, color: i === 0 ? '#ef4444' : '#374151',
                      fontVariantNumeric: 'tabular-nums', flexShrink: 0,
                    }}>
                      {formatCurrency(e.amount, currency)}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Category Momentum */}
        <div className="dark-card p-5">
          <div className="flex items-center gap-3 mb-4">
            <div style={{ width: 34, height: 34, borderRadius: 9, background: '#f5f3ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Clock size={15} color="#8b5cf6" />
            </div>
            <div>
              <p className="card-header-label mb-0">Category Momentum</p>
              <p className="text-xs" style={{ color: '#9ca3af' }}>Change vs previous period</p>
            </div>
          </div>

          {categoryMomentum.length === 0 ? (
            <div style={{ padding: '32px 0', textAlign: 'center' }}>
              <p style={{ fontSize: 12, color: '#9ca3af' }}>No data to compare</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {categoryMomentum.map(c => {
                const isUp = c.change > 0;
                const isDown = c.change < 0;
                const isNew = c.prev === 0 && c.curr > 0;
                const Icon = isUp ? TrendingUp : isDown ? TrendingDown : Minus;
                const color = isNew ? '#3b82f6' : isUp ? '#ef4444' : isDown ? '#10b981' : '#9ca3af';

                return (
                  <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 14, width: 20, textAlign: 'center', flexShrink: 0 }}>{c.icon}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 11, fontWeight: 600, color: '#374151', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</p>
                      <p style={{ fontSize: 9, color: '#9ca3af', fontVariantNumeric: 'tabular-nums' }}>
                        {formatCurrencyShort(c.curr, currency)}
                        {c.prev > 0 && <> from {formatCurrencyShort(c.prev, currency)}</>}
                      </p>
                    </div>
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: 4,
                      fontSize: 10, fontWeight: 700, color,
                      background: `${color}12`, padding: '3px 8px', borderRadius: 100,
                      flexShrink: 0,
                    }}>
                      <Icon size={10} />
                      {isNew ? 'New' : `${isUp ? '+' : ''}${c.change.toFixed(0)}%`}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

    </div>
  );
}
