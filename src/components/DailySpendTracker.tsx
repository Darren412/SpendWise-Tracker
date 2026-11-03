'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import { useBudgetStore } from '@/store/budgetStore';
import { useRegularExpenses } from '@/hooks/useRegularExpenses';
import { Expense, Category } from '@/types';
import { formatCurrency, currencySymbol } from '@/utils/currency';
import { getFinancialMonthRange } from '@/utils/financialCycle';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Cell,
} from 'recharts';
import { Activity, Filter, X } from 'lucide-react';

// ── Spend intensity color ─────────────────────────────────────────────────

function spendColor(total: number, avg: number): string {
  if (total === 0) return 'var(--bg-muted)';
  const ratio = avg > 0 ? total / avg : 1;
  if (ratio > 2.2) return '#ef4444';   // Very high
  if (ratio > 1.5) return '#f59e0b';   // High
  if (ratio > 0.6) return '#4f46e5';   // Normal
  return '#a5b4fc';                     // Low
}

// ── Day data shape ────────────────────────────────────────────────────────

interface DayData {
  day: number;      // 1-based sequence within the financial period
  date: Date;       // actual calendar date
  dateStr: string;  // YYYY-MM-DD
  label: string;    // e.g. "May 25"
  total: number;
  expenses: Expense[];
}

// ── Premium floating tooltip ──────────────────────────────────────────────

interface TooltipPassedProps {
  categories: Category[];
  currency: string;
  avgDaily: number;
}

interface DayTooltipProps extends TooltipPassedProps {
  active?: boolean;
  payload?: Array<{ payload: DayData; value: number; [key: string]: unknown }>;
}

function DayTooltip({ active, payload, categories, currency, avgDaily }: DayTooltipProps) {
  if (!active || !payload?.length) return null;
  const data = payload[0].payload;
  if (data.total === 0) return null;

  const { total, expenses } = data;
  const isHigh = total > avgDaily * 1.5;
  const sym = currencySymbol(currency);
  const dateLabel = (data as DayData).label ?? `Day ${data.day}`;
  const topExpenses = expenses.slice(0, 3);

  return (
    <div style={{
      background: 'var(--bg-surface)',
      border: '1px solid var(--border-default)',
      borderRadius: 14,
      boxShadow: '0 8px 28px rgba(0,0,0,0.12)',
      minWidth: 200,
      maxWidth: 260,
      overflow: 'hidden',
      pointerEvents: 'none',
      fontFamily: 'inherit',
    }}>
      {/* Header */}
      <div style={{
        background: isHigh
          ? 'linear-gradient(135deg, var(--red-50) 0%, var(--red-50) 100%)'
          : 'linear-gradient(135deg, var(--blue-50) 0%, var(--blue-50) 100%)',
        padding: '10px 14px 8px',
        borderBottom: '1px solid var(--border-default)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 3 }}>
          <p style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-500)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            {dateLabel}
          </p>
          {isHigh && (
            <span style={{ fontSize: 8, fontWeight: 700, color: 'var(--danger-text)', background: 'var(--red-50)', padding: '1px 6px', borderRadius: 100, border: '1px solid var(--red-200)' }}>
              High
            </span>
          )}
        </div>
        <p style={{ fontSize: 18, fontWeight: 800, color: isHigh ? 'var(--danger-text)' : 'var(--text-900)', fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>
          {sym}{total.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
        </p>
      </div>

      {/* Top transactions preview */}
      {topExpenses.length > 0 && (
        <div style={{ padding: '4px 0' }}>
          {topExpenses.map(e => {
            const cat = categories.find(c => c.id === e.category);
            return (
              <div key={e.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 12px' }}>
                <span style={{ fontSize: 12, flexShrink: 0 }}>{cat?.icon ?? '📦'}</span>
                <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-700)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {e.description || 'Expense'}
                </span>
                <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-700)', fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>
                  {sym}{e.amount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* Footer with click hint */}
      <div style={{
        padding: '6px 12px',
        background: 'var(--bg-subtle)',
        borderTop: '1px solid var(--border-default)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <span style={{ fontSize: 10, color: 'var(--text-400)' }}>
          {expenses.length} txn{expenses.length !== 1 ? 's' : ''}
        </span>
        <span style={{ fontSize: 9, fontWeight: 600, color: 'var(--brand-text)' }}>
          Click to pin details ↓
        </span>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────

export default function DailySpendTracker() {
  const {
    categories, excludedCategoryIds, setExcludedCategoryIds,
    selectedMonth, selectedYear, selectedCity, currency, financialCycleStart,
  } = useBudgetStore();
  // Daily spend tracks REGULAR spend — balance-funded outflows aren'tt behaviour
  const expenses = useRegularExpenses();
  const [pinnedDay, setPinnedDay] = useState<number | null>(null);

  // Reset pinned day whenever any filter or period changes
  useEffect(() => { setPinnedDay(null); }, [excludedCategoryIds, selectedCity, selectedMonth, selectedYear]);

  // Memoised: month + city filtered expenses
  const monthExpenses = useMemo(
    () => expenses.filter(e => {
      if (e.month !== selectedMonth || e.year !== selectedYear) return false;
      if (selectedCity !== 'Both' && (e.city ?? 'Bangalore') !== selectedCity) return false;
      return true;
    }),
    [expenses, selectedMonth, selectedYear, selectedCity],
  );

  // Memoised: further filtered by selected categories
  const filteredExpenses = useMemo(
    () => excludedCategoryIds.length === 0
      ? monthExpenses
      : monthExpenses.filter(e => !excludedCategoryIds.includes(e.category)),
    [monthExpenses, excludedCategoryIds],
  );

  // Memoised: financial period date list + analytics
  const { dates, effectiveDays } = useMemo(() => {
    const { start, end } = getFinancialMonthRange(selectedMonth, selectedYear, financialCycleStart);
    const ds: Date[] = [];
    const cursor = new Date(start);
    cursor.setHours(0, 0, 0, 0);
    const endNorm = new Date(end);
    endNorm.setHours(23, 59, 59, 999);
    while (cursor <= endNorm) { ds.push(new Date(cursor)); cursor.setDate(cursor.getDate() + 1); }
    const now = new Date();
    const isCurrentPeriod = now >= start && now <= endNorm;
    const effectiveDays = isCurrentPeriod
      ? Math.max(1, Math.ceil((now.getTime() - start.getTime()) / 86400000) + 1)
      : ds.length;
    return { dates: ds, start, endNorm, effectiveDays };
  }, [selectedMonth, selectedYear, financialCycleStart]);

  // Memoised: per-date bar data (re-runs on filter or period change)
  const dailyData: DayData[] = useMemo(() => dates.map((date, idx) => {
    const yyyy    = date.getFullYear();
    const mm      = String(date.getMonth() + 1).padStart(2, '0');
    const dd      = String(date.getDate()).padStart(2, '0');
    const dateStr = `${yyyy}-${mm}-${dd}`;
    const dayExpenses = filteredExpenses.filter(e => e.date?.startsWith(dateStr));
    return {
      day:      idx + 1,
      date,
      dateStr,
      label:    date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      total:    dayExpenses.reduce((s, ex) => s + ex.amount, 0),
      expenses: dayExpenses,
    };
  }), [dates, filteredExpenses]);

  const totalSpent  = useMemo(() => filteredExpenses.reduce((s, e) => s + e.amount, 0), [filteredExpenses]);
  const avgDaily    = effectiveDays > 0 ? totalSpent / effectiveDays : 0;
  const peakDay     = useMemo(() =>
    dailyData.reduce((mx, d) => d.total > mx.total ? d : mx,
      dailyData[0] ?? { day: 0, date: new Date(), dateStr: '', label: '', total: 0, expenses: [] }),
    [dailyData]);
  const activeDays  = useMemo(() => dailyData.filter(d => d.total > 0).length, [dailyData]);
  const sym = currencySymbol(currency);

  // Active filter category objects for display
  const activeFilterCats = useMemo(
    () => excludedCategoryIds.length > 0
      ? categories.filter(c => excludedCategoryIds.includes(c.id) && c.type !== 'income')
      : [],
    [categories, excludedCategoryIds],
  );
  const isCityFiltered = selectedCity !== 'Both';
  const isFiltered = activeFilterCats.length > 0 || isCityFiltered;

  const pinnedData = pinnedDay !== null ? dailyData[pinnedDay - 1] : null;

  // Stable tooltip factory
  const TooltipContent = useCallback((props: object) => (
    <DayTooltip
      {...(props as DayTooltipProps)}
      categories={categories}
      currency={currency}
      avgDaily={avgDaily}
    />
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ), [categories, currency, avgDaily]);

  return (
    <div className="dark-card p-5">

      {/* ── Header ── */}
      <div className="flex items-start justify-between mb-5 flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <div className="icon-pill" style={{ background: isFiltered ? 'var(--blue-50)' : 'var(--blue-50)' }}>
            <Activity size={15} color={isFiltered ? 'var(--brand-text)' : 'var(--info-text)'} />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <p className="card-header-label mb-0">Daily Spend Activity</p>
              {isFiltered && (
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                  fontSize: 9, fontWeight: 700, color: 'var(--brand-text)',
                  background: 'var(--brand-50)', padding: '2px 8px', borderRadius: 100,
                  border: '1px solid var(--brand-200)', textTransform: 'uppercase', letterSpacing: '0.04em',
                }}>
                  <Filter size={8} /> Filtered
                </span>
              )}
            </div>
            <p className="text-xs" style={{ color: 'var(--text-400)' }}>
              {filteredExpenses.length} transaction{filteredExpenses.length !== 1 ? 's' : ''} · {activeDays} active day{activeDays !== 1 ? 's' : ''}
            </p>
          </div>
        </div>

        {/* Summary stats */}
        <div className="flex items-center gap-5 flex-wrap">
          <div className="text-right">
            <p className="text-xs" style={{ color: 'var(--text-400)' }}>Avg / day</p>
            <p className="text-sm font-bold num-mono" style={{ color: 'var(--success-text)' }}>{formatCurrency(avgDaily, currency)}</p>
          </div>
          <div className="text-right">
            <p className="text-xs" style={{ color: 'var(--text-400)' }}>Peak day</p>
            <p className="text-sm font-bold num-mono" style={{ color: 'var(--danger-text)' }}>
              {peakDay && peakDay.total > 0 ? peakDay.label : '—'}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs" style={{ color: 'var(--text-400)' }}>Total spent</p>
            <p className="text-sm font-bold num-mono" style={{ color: 'var(--text-900)' }}>{formatCurrency(totalSpent, currency)}</p>
          </div>
        </div>
      </div>

      {/* ── Active filter pills ── */}
      {isFiltered && (
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          {/* City pill */}
          {isCityFiltered && (
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 5,
              fontSize: 11, fontWeight: 600, padding: '3px 10px 3px 8px',
              borderRadius: 100, border: '1px solid var(--border-strong)',
              background: 'var(--brand-50)', color: 'var(--brand-text)',
            }}>
              📍 {selectedCity}
            </span>
          )}
          {/* Category pills */}
          {activeFilterCats.map(cat => (
            <span key={cat.id} style={{
              display: 'inline-flex', alignItems: 'center', gap: 5,
              fontSize: 11, fontWeight: 600, padding: '3px 10px 3px 7px',
              borderRadius: 100, border: `1px solid ${cat.color}40`,
              background: `${cat.color}12`, color: cat.color,
            }}>
              <span style={{ fontSize: 13 }}>{cat.icon}</span>{cat.name}
            </span>
          ))}
          {activeFilterCats.length > 0 && (
            <button
              onClick={() => setExcludedCategoryIds([])}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 4,
                fontSize: 11, fontWeight: 600, padding: '3px 10px',
                borderRadius: 100, border: '1px solid var(--border-default)',
                background: 'var(--bg-muted)', color: 'var(--text-500)', cursor: 'pointer',
              }}
            >
              <X size={10} /> Clear categories
            </button>
          )}
        </div>
      )}

      {/* ── Empty state when filters active but no data ── */}
      {isFiltered && totalSpent === 0 ? (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', padding: '48px 24px', gap: 12,
          background: 'var(--bg-subtle)', borderRadius: 16, border: '1.5px dashed var(--border-default)',
        }}>
          <div style={{
            width: 52, height: 52, borderRadius: '50%',
            background: 'var(--blue-50)', display: 'flex', alignItems: 'center',
            justifyContent: 'center',
          }}>
            <Filter size={22} color="var(--info-text)" />
          </div>
          <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-700)', textAlign: 'center' }}>
            No spending activity found
          </p>
          <p style={{ fontSize: 12, color: 'var(--text-400)', textAlign: 'center', maxWidth: 280 }}>
            {[isCityFiltered && selectedCity, ...activeFilterCats.map(c => c.name)].filter(Boolean).join(' · ')} — no transactions this period.
          </p>
          {activeFilterCats.length > 0 && (
            <button
              onClick={() => setExcludedCategoryIds([])}
              style={{
                marginTop: 4, padding: '8px 20px', borderRadius: 10,
                background: '#4f46e5', color: '#fff', border: 'none',
                fontSize: 12, fontWeight: 700, cursor: 'pointer',
              }}
            >
              Clear category filter
            </button>
          )}
        </div>
      ) : (
      <>{/* ── Bar chart ── */}
      <ResponsiveContainer width="100%" height={240}>
        <BarChart
          data={dailyData}
          margin={{ top: 10, right: 10, left: -8, bottom: 0 }}
          onClick={(e) => {
            if (e?.activePayload?.[0]) {
              const d = e.activePayload[0].payload as DayData;
              setPinnedDay(prev => prev === d.day ? null : d.day);
            }
          }}
        >
          <defs>
            <filter id="barGlow">
              <feGaussianBlur stdDeviation="2" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          <CartesianGrid strokeDasharray="3 3" stroke="var(--border-default)" vertical={false} />

          <XAxis
            dataKey="day"
            tick={{ fontSize: 10, fill: 'var(--text-400)' }}
            tickLine={false}
            axisLine={false}
            interval="preserveStartEnd"
            tickFormatter={(v: number) => {
              const entry = dailyData[v - 1];
              if (!entry) return '';
              const isFirst = v === 1;
              const isLast  = v === dailyData.length;
              const isMonthStart = entry.date.getDate() === 1;
              const every5 = v % 5 === 0;
              if (isFirst || isLast || isMonthStart || every5) {
                return entry.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
              }
              return '';
            }}
          />

          <YAxis
            tick={{ fontSize: 10, fill: 'var(--text-400)' }}
            tickLine={false}
            axisLine={false}
            width={46}
            tickFormatter={(v: number) => {
              if (v === 0) return '';
              if (v >= 100000) return `${sym}${(v / 100000).toFixed(0)}L`;
              if (v >= 1000) return `${sym}${(v / 1000).toFixed(0)}k`;
              return `${sym}${v}`;
            }}
          />

          {avgDaily > 0 && (
            <ReferenceLine
              y={avgDaily}
              stroke="var(--green-500)"
              strokeDasharray="6 4"
              strokeWidth={1.5}
              label={{ value: 'avg', position: 'insideTopRight', fill: 'var(--success-text)', fontSize: 9 }}
            />
          )}

          <Tooltip
            content={TooltipContent}
            cursor={{ fill: 'rgba(79,70,229,0.05)', radius: 4 }}
          />

          <Bar dataKey="total" radius={[4, 4, 0, 0]} maxBarSize={22}>
            {dailyData.map((entry, i) => (
              <Cell
                key={i}
                fill={pinnedDay === entry.day ? 'var(--text-900)' : spendColor(entry.total, avgDaily)}
                opacity={pinnedDay !== null && pinnedDay !== entry.day ? 0.35 : 1}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      {/* ── Color legend ── */}
      <div className="flex items-center gap-4 mt-3 mb-1 flex-wrap">
        {[
          { color: 'var(--brand-300)', label: 'Low' },
          { color: 'var(--brand-text)', label: 'Normal' },
          { color: 'var(--warning-text)', label: 'High' },
          { color: 'var(--danger-text)', label: 'Very high' },
        ].map(({ color, label }) => (
          <div key={label} className="flex items-center gap-1.5">
            <div style={{ width: 10, height: 10, borderRadius: 2, background: color }} />
            <span style={{ fontSize: 10, color: 'var(--text-400)' }}>{label}</span>
          </div>
        ))}
        <div className="flex items-center gap-1.5">
          <svg width="16" height="8"><line x1="0" y1="4" x2="16" y2="4" stroke="var(--green-500)" strokeWidth="1.5" strokeDasharray="5 3" /></svg>
          <span style={{ fontSize: 10, color: 'var(--text-400)' }}>Avg line</span>
        </div>
        {!pinnedDay && (
          <span style={{ fontSize: 10, color: 'var(--text-300)', marginLeft: 'auto' }}>Click any bar to pin details ↓</span>
        )}
      </div>

      {/* ── Pinned day detail panel ── */}
      {pinnedData && (
        <div
          className="mt-5 rounded-2xl overflow-hidden"
          style={{ border: '1px solid var(--border-default)', boxShadow: '0 2px 12px rgba(0,0,0,0.05)' }}
        >
          {/* Panel header */}
          <div style={{
            background: pinnedData.total > avgDaily * 1.5
              ? 'linear-gradient(135deg, var(--red-50) 0%, var(--red-50) 100%)'
              : 'linear-gradient(135deg, var(--blue-50) 0%, var(--blue-50) 100%)',
            padding: '14px 18px',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            borderBottom: '1px solid var(--border-default)',
          }}>
            <div>
              <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-500)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3 }}>
                {pinnedData.label}
              </p>
              <p style={{
                fontSize: 22, fontWeight: 800,
                color: pinnedData.total > avgDaily * 1.5 ? 'var(--danger-text)' : 'var(--text-900)',
                fontVariantNumeric: 'tabular-nums', lineHeight: 1,
              }}>
                {sym}{pinnedData.total.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
              </p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {pinnedData.total > avgDaily * 1.5 && (
                <span style={{
                  fontSize: 10, fontWeight: 700, color: 'var(--danger-text)',
                  background: 'var(--red-50)', padding: '4px 12px', borderRadius: 100,
                  border: '1px solid var(--red-200)',
                }}>
                  ↑ High Spend Day
                </span>
              )}
              {pinnedData.total > 0 && pinnedData.total < avgDaily * 0.5 && (
                <span style={{
                  fontSize: 10, fontWeight: 700, color: 'var(--success-text)',
                  background: 'var(--green-50)', padding: '4px 12px', borderRadius: 100,
                  border: '1px solid var(--green-200)',
                }}>
                  ↓ Low Spend Day
                </span>
              )}
              <button
                onClick={() => setPinnedDay(null)}
                style={{
                  fontSize: 11, color: 'var(--text-400)', background: 'var(--bg-muted)',
                  border: '1px solid var(--border-default)', padding: '5px 12px',
                  borderRadius: 8, cursor: 'pointer', fontWeight: 600,
                }}
              >
                ✕ Close
              </button>
            </div>
          </div>

          {/* Transaction rows */}
          {pinnedData.expenses.length === 0 ? (
            <div style={{ padding: 28, textAlign: 'center' }}>
              <p style={{ fontSize: 28, marginBottom: 8 }}>✨</p>
              <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-500)' }}>No spending on this day</p>
              <p style={{ fontSize: 11, color: 'var(--text-400)', marginTop: 3 }}>A great day for your wallet!</p>
            </div>
          ) : (
            <>
              {pinnedData.expenses.map((e, idx) => {
                const cat = categories.find(c => c.id === e.category);
                return (
                  <div
                    key={e.id}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 14,
                      padding: '13px 18px',
                      borderBottom: idx < pinnedData.expenses.length - 1 ? '1px solid var(--bg-subtle)' : 'none',
                      background: 'var(--bg-surface)',
                    }}
                  >
                    <div style={{
                      width: 40, height: 40, borderRadius: 11,
                      background: cat ? `${cat.color}1a` : 'var(--bg-muted)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 18, flexShrink: 0,
                    }}>
                      {cat?.icon ?? '📦'}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-900)' }}>
                        {e.description || 'Expense'}
                      </p>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                        <span style={{
                          fontSize: 10, fontWeight: 600, color: cat?.color ?? 'var(--text-500)',
                          background: cat ? `${cat.color}15` : 'var(--bg-muted)',
                          padding: '1px 7px', borderRadius: 100,
                        }}>
                          {cat?.name ?? 'Uncategorised'}
                        </span>
                      </div>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <p style={{
                        fontSize: 14, fontWeight: 700, color: 'var(--text-900)',
                        fontVariantNumeric: 'tabular-nums',
                      }}>
                        {formatCurrency(e.amount, currency)}
                      </p>
                    </div>
                  </div>
                );
              })}

              {/* Panel footer */}
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '12px 18px',
                background: 'var(--bg-subtle)', borderTop: '1px solid var(--border-default)',
              }}>
                <span style={{ fontSize: 12, color: 'var(--text-500)' }}>
                  {pinnedData.expenses.length} transaction{pinnedData.expenses.length !== 1 ? 's' : ''}
                </span>
                <div style={{ textAlign: 'right' }}>
                  <span style={{ fontSize: 10, color: 'var(--text-400)', marginRight: 8 }}>
                    vs avg {sym}{Math.round(avgDaily).toLocaleString('en-IN')}
                  </span>
                  <span style={{
                    fontSize: 15, fontWeight: 800, color: 'var(--text-900)',
                    fontVariantNumeric: 'tabular-nums',
                  }}>
                    {formatCurrency(pinnedData.total, currency)}
                  </span>
                </div>
              </div>
            </>
          )}
        </div>
      )}
      </>)}
    </div>
  );
}
