'use client';

import { useState, useMemo } from 'react';
import { useBudgetStore } from '@/store/budgetStore';
import { Expense, Category } from '@/types';
import { formatCurrency, currencySymbol } from '@/utils/currency';
import { getFinancialMonthRange } from '@/utils/financialCycle';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell,
} from 'recharts';
import { CalendarDays, TrendingUp, TrendingDown, Minus } from 'lucide-react';

// ── Week data shape ─────────────────────────────────────────────────────

interface WeekData {
  week: number;       // 1-4
  label: string;      // "Week 1", "Week 2", etc.
  dateRange: string;  // "Aug 25 – Aug 31"
  total: number;
  txnCount: number;
  avgPerDay: number;
  expenses: Expense[];
  startDate: Date;
  endDate: Date;
}

// ── Week colors ─────────────────────────────────────────────────────────

const weekColors = ['#6366f1', '#8b5cf6', '#ec4899', '#f59e0b'];
const weekColorsLight = ['#eef2ff', '#f5f3ff', '#fdf2f8', '#fffbeb'];

// ── Premium tooltip ─────────────────────────────────────────────────────

interface WeekTooltipProps {
  active?: boolean;
  payload?: Array<{ payload: WeekData; value: number }>;
  currency: string;
  totalSpent: number;
}

function WeekTooltip({ active, payload, currency, totalSpent }: WeekTooltipProps) {
  if (!active || !payload?.length) return null;
  const data = payload[0].payload;
  const sym = currencySymbol(currency);
  const pct = totalSpent > 0 ? ((data.total / totalSpent) * 100).toFixed(1) : '0.0';

  return (
    <div style={{
      background: '#fff',
      border: '1px solid #e8ecf0',
      borderRadius: 14,
      boxShadow: '0 12px 40px rgba(0,0,0,0.14)',
      minWidth: 220,
      overflow: 'hidden',
      pointerEvents: 'none',
      fontFamily: 'inherit',
    }}>
      <div style={{
        background: weekColorsLight[data.week - 1] ?? '#f8fafc',
        padding: '12px 16px 10px',
        borderBottom: '1px solid #f3f4f6',
      }}>
        <p style={{ fontSize: 11, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 }}>
          {data.label}
        </p>
        <p style={{ fontSize: 10, color: '#9ca3af' }}>{data.dateRange}</p>
        <p style={{
          fontSize: 22, fontWeight: 800, color: '#111827',
          fontVariantNumeric: 'tabular-nums', lineHeight: 1, marginTop: 6,
        }}>
          {sym}{data.total.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
        </p>
      </div>
      <div style={{ padding: '10px 16px', display: 'flex', flexDirection: 'column', gap: 4 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
          <span style={{ color: '#6b7280' }}>Transactions</span>
          <span style={{ fontWeight: 700, color: '#111827' }}>{data.txnCount}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
          <span style={{ color: '#6b7280' }}>Avg / day</span>
          <span style={{ fontWeight: 700, color: '#111827' }}>{formatCurrency(data.avgPerDay, currency)}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
          <span style={{ color: '#6b7280' }}>Share of month</span>
          <span style={{ fontWeight: 700, color: weekColors[data.week - 1] }}>{pct}%</span>
        </div>
      </div>
    </div>
  );
}

// ── Category breakdown for a week ───────────────────────────────────────

function WeekCategoryBreakdown({ expenses, categories, currency }: {
  expenses: Expense[];
  categories: Category[];
  currency: string;
}) {
  const catTotals = useMemo(() => {
    const map: Record<string, number> = {};
    for (const e of expenses) {
      map[e.category] = (map[e.category] ?? 0) + e.amount;
    }
    return Object.entries(map)
      .map(([id, total]) => ({ id, total, cat: categories.find(c => c.id === id) }))
      .sort((a, b) => b.total - a.total);
  }, [expenses, categories]);

  const weekTotal = expenses.reduce((s, e) => s + e.amount, 0);

  if (catTotals.length === 0) {
    return (
      <div style={{ padding: '20px 0', textAlign: 'center' }}>
        <p style={{ fontSize: 11, color: '#9ca3af' }}>No transactions this week</p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {catTotals.map(({ id, total, cat }) => {
        const pct = weekTotal > 0 ? (total / weekTotal) * 100 : 0;
        return (
          <div key={id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 28, height: 28, borderRadius: 8,
              background: cat ? `${cat.color}1a` : '#f3f4f6',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 13, flexShrink: 0,
            }}>
              {cat?.icon ?? '📦'}
            </div>
            <span style={{ fontSize: 11, fontWeight: 600, color: '#374151', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {cat?.name ?? 'Uncategorised'}
            </span>
            <div style={{ width: 60, height: 5, borderRadius: 100, background: '#f3f4f6', flexShrink: 0 }}>
              <div style={{
                height: '100%', borderRadius: 100,
                background: cat?.color ?? '#9ca3af',
                width: `${Math.min(pct, 100)}%`,
                transition: 'width 0.3s ease',
              }} />
            </div>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#111827', fontVariantNumeric: 'tabular-nums', flexShrink: 0, width: 56, textAlign: 'right' }}>
              {formatCurrency(total, currency)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────

export default function WeeklySpendTracker() {
  const {
    expenses, categories, excludedCategoryIds,
    selectedMonth, selectedYear, selectedCity, currency, financialCycleStart,
  } = useBudgetStore();
  const [expandedWeek, setExpandedWeek] = useState<number | null>(null);

  // Month + city filtered expenses
  const monthExpenses = useMemo(
    () => expenses.filter(e => {
      if (e.month !== selectedMonth || e.year !== selectedYear) return false;
      if (selectedCity !== 'Both' && (e.city ?? 'Bangalore') !== selectedCity) return false;
      return true;
    }),
    [expenses, selectedMonth, selectedYear, selectedCity],
  );

  // Further filtered by category exclusions
  const filteredExpenses = useMemo(
    () => excludedCategoryIds.length === 0
      ? monthExpenses
      : monthExpenses.filter(e => !excludedCategoryIds.includes(e.category)),
    [monthExpenses, excludedCategoryIds],
  );

  // Build week boundaries from the financial period
  const weeklyData: WeekData[] = useMemo(() => {
    const { start, end } = getFinancialMonthRange(selectedMonth, selectedYear, financialCycleStart);
    const startNorm = new Date(start);
    startNorm.setHours(0, 0, 0, 0);
    const endNorm = new Date(end);
    endNorm.setHours(23, 59, 59, 999);

    // Calculate total days in the period
    const totalDays = Math.round((endNorm.getTime() - startNorm.getTime()) / 86400000) + 1;
    const daysPerWeek = Math.ceil(totalDays / 4);

    const weeks: WeekData[] = [];

    for (let w = 0; w < 4; w++) {
      const weekStart = new Date(startNorm);
      weekStart.setDate(weekStart.getDate() + w * daysPerWeek);

      const weekEnd = new Date(startNorm);
      if (w < 3) {
        weekEnd.setDate(weekEnd.getDate() + (w + 1) * daysPerWeek - 1);
      } else {
        // Last week runs to the end of the period
        weekEnd.setTime(endNorm.getTime());
      }

      // Don't exceed the period end
      if (weekEnd > endNorm) weekEnd.setTime(endNorm.getTime());

      const weekStartStr = `${weekStart.getFullYear()}-${String(weekStart.getMonth() + 1).padStart(2, '0')}-${String(weekStart.getDate()).padStart(2, '0')}`;
      const weekEndStr = `${weekEnd.getFullYear()}-${String(weekEnd.getMonth() + 1).padStart(2, '0')}-${String(weekEnd.getDate()).padStart(2, '0')}`;

      const weekExpenses = filteredExpenses.filter(e => {
        if (!e.date) return false;
        const eDate = e.date.slice(0, 10);
        return eDate >= weekStartStr && eDate <= weekEndStr;
      });

      const daysInWeek = Math.round((weekEnd.getTime() - weekStart.getTime()) / 86400000) + 1;
      const total = weekExpenses.reduce((s, ex) => s + ex.amount, 0);

      const fmtDate = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

      weeks.push({
        week: w + 1,
        label: `Week ${w + 1}`,
        dateRange: `${fmtDate(weekStart)} - ${fmtDate(weekEnd)}`,
        total,
        txnCount: weekExpenses.length,
        avgPerDay: daysInWeek > 0 ? total / daysInWeek : 0,
        expenses: weekExpenses,
        startDate: weekStart,
        endDate: weekEnd,
      });
    }

    return weeks;
  }, [selectedMonth, selectedYear, financialCycleStart, filteredExpenses]);

  const totalSpent = useMemo(() => weeklyData.reduce((s, w) => s + w.total, 0), [weeklyData]);
  const avgWeekly = totalSpent / 4;
  const peakWeek = useMemo(() =>
    weeklyData.reduce((mx, w) => w.total > mx.total ? w : mx, weeklyData[0]),
    [weeklyData],
  );
  const sym = currencySymbol(currency);

  // Week-over-week trend indicators
  const getTrend = (weekIdx: number): { icon: typeof TrendingUp; color: string; label: string } => {
    if (weekIdx === 0) return { icon: Minus, color: '#9ca3af', label: 'Baseline' };
    const curr = weeklyData[weekIdx]?.total ?? 0;
    const prev = weeklyData[weekIdx - 1]?.total ?? 0;
    if (prev === 0 && curr === 0) return { icon: Minus, color: '#9ca3af', label: 'No activity' };
    if (prev === 0) return { icon: TrendingUp, color: '#ef4444', label: 'New spending' };
    const change = ((curr - prev) / prev) * 100;
    if (Math.abs(change) < 5) return { icon: Minus, color: '#9ca3af', label: `${change >= 0 ? '+' : ''}${change.toFixed(0)}%` };
    if (change > 0) return { icon: TrendingUp, color: '#ef4444', label: `+${change.toFixed(0)}%` };
    return { icon: TrendingDown, color: '#10b981', label: `${change.toFixed(0)}%` };
  };

  return (
    <div className="dark-card p-5">

      {/* ── Header ── */}
      <div className="flex items-start justify-between mb-5 flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <div className="icon-pill" style={{ background: '#f0fdf4' }}>
            <CalendarDays size={15} color="#10b981" />
          </div>
          <div>
            <p className="card-header-label mb-0">Weekly Spend Breakdown</p>
            <p className="text-xs" style={{ color: '#9ca3af' }}>
              Spending distribution across 4 weeks of your financial period
            </p>
          </div>
        </div>

        {/* Summary stats */}
        <div className="flex items-center gap-5 flex-wrap">
          <div className="text-right">
            <p className="text-xs" style={{ color: '#9ca3af' }}>Avg / week</p>
            <p className="text-sm font-bold num-mono" style={{ color: '#10b981' }}>{formatCurrency(avgWeekly, currency)}</p>
          </div>
          <div className="text-right">
            <p className="text-xs" style={{ color: '#9ca3af' }}>Peak week</p>
            <p className="text-sm font-bold num-mono" style={{ color: '#ef4444' }}>
              {peakWeek && peakWeek.total > 0 ? peakWeek.label : '—'}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs" style={{ color: '#9ca3af' }}>Total spent</p>
            <p className="text-sm font-bold num-mono" style={{ color: '#111827' }}>{formatCurrency(totalSpent, currency)}</p>
          </div>
        </div>
      </div>

      {/* ── Empty state ── */}
      {totalSpent === 0 ? (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', padding: '48px 24px', gap: 12,
          background: '#f8fafc', borderRadius: 16, border: '1.5px dashed #e8ecf0',
        }}>
          <div style={{
            width: 52, height: 52, borderRadius: '50%',
            background: '#f0fdf4', display: 'flex', alignItems: 'center',
            justifyContent: 'center',
          }}>
            <CalendarDays size={22} color="#86efac" />
          </div>
          <p style={{ fontSize: 14, fontWeight: 700, color: '#374151', textAlign: 'center' }}>
            No spending data this period
          </p>
          <p style={{ fontSize: 12, color: '#9ca3af', textAlign: 'center', maxWidth: 280 }}>
            Add expenses to see your weekly spending breakdown
          </p>
        </div>
      ) : (
        <>
          {/* ── Bar chart ── */}
          <ResponsiveContainer width="100%" height={220}>
            <BarChart
              data={weeklyData}
              margin={{ top: 10, right: 10, left: -8, bottom: 0 }}
              barCategoryGap="20%"
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />

              <XAxis
                dataKey="label"
                tick={{ fontSize: 11, fill: '#6b7280', fontWeight: 600 }}
                tickLine={false}
                axisLine={false}
              />

              <YAxis
                tick={{ fontSize: 10, fill: '#9ca3af' }}
                tickLine={false}
                axisLine={false}
                width={50}
                tickFormatter={(v: number) => {
                  if (v === 0) return '';
                  if (v >= 100000) return `${sym}${(v / 100000).toFixed(0)}L`;
                  if (v >= 1000) return `${sym}${(v / 1000).toFixed(0)}k`;
                  return `${sym}${v}`;
                }}
              />

              <Tooltip
                content={(props) => (
                  <WeekTooltip {...(props as WeekTooltipProps)} currency={currency} totalSpent={totalSpent} />
                )}
                cursor={{ fill: 'rgba(99,102,241,0.06)', radius: 6 }}
              />

              <Bar dataKey="total" radius={[8, 8, 0, 0]} maxBarSize={64}>
                {weeklyData.map((entry, i) => (
                  <Cell
                    key={i}
                    fill={weekColors[entry.week - 1]}
                    opacity={expandedWeek !== null && expandedWeek !== entry.week ? 0.35 : 1}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>

          {/* ── Week cards grid ── */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-5">
            {weeklyData.map((week) => {
              const isExpanded = expandedWeek === week.week;
              const pct = totalSpent > 0 ? ((week.total / totalSpent) * 100).toFixed(1) : '0.0';
              const trend = getTrend(week.week - 1);
              const TrendIcon = trend.icon;

              return (
                <div
                  key={week.week}
                  onClick={() => setExpandedWeek(isExpanded ? null : week.week)}
                  style={{
                    background: isExpanded ? weekColorsLight[week.week - 1] : '#fff',
                    border: `1.5px solid ${isExpanded ? weekColors[week.week - 1] + '40' : '#e8ecf0'}`,
                    borderRadius: 14,
                    padding: '14px 16px',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                  }}
                >
                  {/* Week header */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <div style={{
                        width: 8, height: 8, borderRadius: '50%',
                        background: weekColors[week.week - 1],
                      }} />
                      <span style={{ fontSize: 12, fontWeight: 700, color: '#374151' }}>
                        {week.label}
                      </span>
                    </div>
                    {week.week > 1 && (
                      <div style={{
                        display: 'flex', alignItems: 'center', gap: 3,
                        fontSize: 10, fontWeight: 700, color: trend.color,
                        background: `${trend.color}12`, padding: '2px 7px',
                        borderRadius: 100,
                      }}>
                        <TrendIcon size={10} />
                        {trend.label}
                      </div>
                    )}
                  </div>

                  {/* Amount */}
                  <p style={{
                    fontSize: 18, fontWeight: 800, color: '#111827',
                    fontVariantNumeric: 'tabular-nums', lineHeight: 1, marginBottom: 4,
                  }}>
                    {sym}{week.total.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                  </p>

                  {/* Meta row */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                    <span style={{ fontSize: 10, color: '#9ca3af' }}>
                      {week.txnCount} txn{week.txnCount !== 1 ? 's' : ''}
                    </span>
                    <span style={{ fontSize: 10, color: '#d1d5db' }}>|</span>
                    <span style={{ fontSize: 10, color: '#9ca3af' }}>
                      {pct}% of total
                    </span>
                  </div>

                  {/* Date range */}
                  <p style={{ fontSize: 10, color: '#b0b7c3' }}>
                    {week.dateRange}
                  </p>

                  {/* Progress bar */}
                  <div style={{
                    width: '100%', height: 4, borderRadius: 100,
                    background: '#f3f4f6', marginTop: 8,
                  }}>
                    <div style={{
                      height: '100%', borderRadius: 100,
                      background: weekColors[week.week - 1],
                      width: `${Math.min(parseFloat(pct), 100)}%`,
                      transition: 'width 0.4s ease',
                    }} />
                  </div>
                </div>
              );
            })}
          </div>

          {/* ── Expanded week detail panel ── */}
          {expandedWeek !== null && weeklyData[expandedWeek - 1] && (
            <div
              className="mt-4 rounded-2xl overflow-hidden"
              style={{
                border: `1.5px solid ${weekColors[expandedWeek - 1]}30`,
                boxShadow: '0 2px 12px rgba(0,0,0,0.05)',
                animation: 'txnSlideDown 0.25s ease forwards',
              }}
            >
              {/* Panel header */}
              <div style={{
                background: weekColorsLight[expandedWeek - 1],
                padding: '14px 18px',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                borderBottom: '1px solid #f0f2f5',
              }}>
                <div>
                  <p style={{ fontSize: 11, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3 }}>
                    {weeklyData[expandedWeek - 1].label} Detail
                  </p>
                  <p style={{ fontSize: 10, color: '#9ca3af' }}>
                    {weeklyData[expandedWeek - 1].dateRange}
                  </p>
                  <p style={{
                    fontSize: 22, fontWeight: 800, color: '#111827',
                    fontVariantNumeric: 'tabular-nums', lineHeight: 1, marginTop: 6,
                  }}>
                    {formatCurrency(weeklyData[expandedWeek - 1].total, currency)}
                  </p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  {/* Stats */}
                  <div style={{ textAlign: 'right' }}>
                    <p style={{ fontSize: 10, color: '#9ca3af' }}>Avg / day</p>
                    <p style={{ fontSize: 13, fontWeight: 700, color: '#10b981', fontVariantNumeric: 'tabular-nums' }}>
                      {formatCurrency(weeklyData[expandedWeek - 1].avgPerDay, currency)}
                    </p>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); setExpandedWeek(null); }}
                    style={{
                      fontSize: 11, color: '#9ca3af', background: '#f4f6f9',
                      border: '1px solid #e8ecf0', padding: '5px 12px',
                      borderRadius: 8, cursor: 'pointer', fontWeight: 600,
                    }}
                  >
                    Close
                  </button>
                </div>
              </div>

              {/* Category breakdown */}
              <div style={{ padding: '16px 18px', background: '#fff' }}>
                <p style={{ fontSize: 11, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>
                  Category Breakdown
                </p>
                <WeekCategoryBreakdown
                  expenses={weeklyData[expandedWeek - 1].expenses}
                  categories={categories}
                  currency={currency}
                />
              </div>

              {/* Footer */}
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '10px 18px',
                background: '#f8fafc', borderTop: '1px solid #f0f2f5',
              }}>
                <span style={{ fontSize: 12, color: '#6b7280' }}>
                  {weeklyData[expandedWeek - 1].txnCount} transaction{weeklyData[expandedWeek - 1].txnCount !== 1 ? 's' : ''}
                </span>
                <div style={{ textAlign: 'right' }}>
                  <span style={{ fontSize: 10, color: '#9ca3af', marginRight: 8 }}>
                    vs avg {sym}{Math.round(avgWeekly).toLocaleString('en-IN')}
                  </span>
                  <span style={{
                    fontSize: 15, fontWeight: 800, color: '#111827',
                    fontVariantNumeric: 'tabular-nums',
                  }}>
                    {formatCurrency(weeklyData[expandedWeek - 1].total, currency)}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* ── Legend ── */}
          <div className="flex items-center gap-4 mt-4 flex-wrap">
            {weeklyData.map((week) => (
              <div key={week.week} className="flex items-center gap-1.5">
                <div style={{ width: 10, height: 10, borderRadius: 3, background: weekColors[week.week - 1] }} />
                <span style={{ fontSize: 10, color: '#9ca3af' }}>{week.label}</span>
              </div>
            ))}
            {!expandedWeek && (
              <span style={{ fontSize: 10, color: '#c4c9d4', marginLeft: 'auto' }}>Click a week card for details</span>
            )}
          </div>
        </>
      )}
    </div>
  );
}
