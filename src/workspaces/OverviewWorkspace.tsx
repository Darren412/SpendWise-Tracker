'use client';

import { useMemo } from 'react';
import {
  TrendingUp, TrendingDown, Minus, Zap, Activity,
  ArrowRight, ArrowUpRight, ArrowDownRight,
} from 'lucide-react';
import { useBudgetStore } from '@/store/budgetStore';
import { formatCurrencyShort, currencySymbol } from '@/utils/currency';
import { getFinancialMonthRange, formatFinancialPeriodRange, getCurrentFinancialPeriod } from '@/utils/financialCycle';

interface OverviewWorkspaceProps {
  onNavigate: (workspace: string) => void;
}

export default function OverviewWorkspace({ onNavigate }: OverviewWorkspaceProps) {
  const {
    selectedMonth, selectedYear,
    expenses: allExpenses,
    getMonthlyIncome,
    categories,
    financialCycleStart, currency, selectedCity,
    excludedCategoryIds,
  } = useBudgetStore();

  const sym = currencySymbol(currency);

  // ── Global (all-city) expenses for this period ────────────────────────────
  // Used for: Health Score, Savings Rate, Net Balance, Top Categories,
  //           Quick Insights, and MoM comparison baseline.
  const globalExpensesThisPeriod = useMemo(() =>
    allExpenses.filter(e => e.month === selectedMonth && e.year === selectedYear),
    [allExpenses, selectedMonth, selectedYear]);

  const globalTotalExpenses = useMemo(() =>
    globalExpensesThisPeriod.reduce((sum, e) => sum + e.amount, 0),
    [globalExpensesThisPeriod]);

  // ── City-scoped expenses ── used ONLY for "Total Expenses" + "Daily Avg Spend"
  const cityTotalExpenses = useMemo(() => {
    return allExpenses
      .filter(e => {
        const inPeriod = e.month === selectedMonth && e.year === selectedYear;
        const inCity   = selectedCity === 'Both' || (e.city ?? 'Bangalore') === selectedCity;
        const inCat    = excludedCategoryIds.length === 0 || !excludedCategoryIds.includes(e.category);
        return inPeriod && inCity && inCat;
      })
      .reduce((sum, e) => sum + e.amount, 0);
  }, [allExpenses, selectedMonth, selectedYear, selectedCity, excludedCategoryIds]);

  // ── Income (always global — income records carry no city field) ───────────
  const totalIncome = getMonthlyIncome(selectedMonth, selectedYear);

  // ── Global financial metrics ───────────────────────────────────────────────
  const netBalance  = totalIncome - globalTotalExpenses;
  const savingsRate = totalIncome > 0 ? Math.round((netBalance / totalIncome) * 100) : 0;

  // ── Period timing ──────────────────────────────────────────────────────────
  const { start: periodStart } = getFinancialMonthRange(selectedMonth, selectedYear, financialCycleStart);
  const today = new Date();
  const daysElapsed = Math.max(1, Math.min(Math.ceil((today.getTime() - periodStart.getTime()) / 86400000), 31));

  // City-scoped daily average spend
  const avgDailySpend = cityTotalExpenses / daysElapsed;

  const periodRange   = formatFinancialPeriodRange(selectedMonth, selectedYear, financialCycleStart);
  const currentPeriod = getCurrentFinancialPeriod(financialCycleStart);

  // ── Previous period — global, for fair MoM comparison ────────────────────
  const prevM = useMemo(() => {
    let m = parseInt(selectedMonth) - 1, y = selectedYear;
    if (m < 1) { m = 12; y -= 1; }
    return { month: m.toString().padStart(2, '0'), year: y };
  }, [selectedMonth, selectedYear]);

  const prevExpenses = useMemo(() =>
    allExpenses
      .filter(e => e.month === prevM.month && e.year === prevM.year)
      .reduce((sum, e) => sum + e.amount, 0),
    [allExpenses, prevM]);

  const prevIncome = getMonthlyIncome(prevM.month, prevM.year);

  // MoM deltas compare global vs global for a fair apples-to-apples comparison
  const expChangePct = prevExpenses > 0 ? Math.round((globalTotalExpenses - prevExpenses) / prevExpenses * 100) : 0;
  const incChangePct = prevIncome   > 0 ? Math.round((totalIncome         - prevIncome)   / prevIncome   * 100) : 0;

  // ── Health score (global) ─────────────────────────────────────────────────
  const healthScore = useMemo(() => {
    if (totalIncome === 0) return 0;
    const srScore = Math.min(30, Math.max(0, savingsRate)) / 30 * 40;
    const cfScore = netBalance >= 0 ? 40 : Math.max(0, 40 + (netBalance / totalIncome) * 40);
    return Math.round(Math.min(100, srScore + cfScore + 20));
  }, [totalIncome, savingsRate, netBalance]);

  const healthLabel = healthScore >= 80 ? 'Excellent' : healthScore >= 65 ? 'Good' : healthScore >= 45 ? 'Fair' : 'Needs work';
  const healthColor = healthScore >= 80 ? 'var(--green-500)' : healthScore >= 65 ? 'var(--blue-500)' : healthScore >= 45 ? 'var(--amber-500)' : 'var(--red-500)';
  const healthBg    = healthScore >= 80 ? 'var(--green-50)' : healthScore >= 65 ? 'var(--blue-50)' : healthScore >= 45 ? 'var(--amber-50)' : 'var(--red-50)';

  // ── Top categories (global — all cities combined) ─────────────────────────
  const topCats = useMemo(() => {
    const totals: Record<string, number> = {};
    for (const e of globalExpensesThisPeriod) {
      if (excludedCategoryIds.length === 0 || !excludedCategoryIds.includes(e.category)) {
        totals[e.category] = (totals[e.category] ?? 0) + e.amount;
      }
    }
    return categories
      .filter(c => c.type !== 'income' && (excludedCategoryIds.length === 0 || !excludedCategoryIds.includes(c.id)))
      .map(c => ({ ...c, spent: totals[c.id] ?? 0 }))
      .filter(c => c.spent > 0)
      .sort((a, b) => b.spent - a.spent)
      .slice(0, 5);
  }, [categories, globalExpensesThisPeriod, excludedCategoryIds]);

  // ── Quick Insights (global) ────────────────────────────────────────────────
  const insights = useMemo(() => {
    const items: { icon: string; text: string; color: string; bg: string }[] = [];
    if (totalIncome > 0 && globalTotalExpenses > totalIncome)
      items.push({ icon: '⚠️', text: `Overspending by ${sym}${Math.round(globalTotalExpenses - totalIncome).toLocaleString('en-IN')} this period`, color: 'var(--red-600)', bg: 'var(--red-50)' });
    if (savingsRate >= 20)
      items.push({ icon: '✅', text: `${savingsRate}% savings rate — healthy trajectory`, color: 'var(--green-700)', bg: 'var(--green-50)' });
    if (topCats[0])
      items.push({ icon: topCats[0].icon, text: `Top spend: ${topCats[0].name} at ${formatCurrencyShort(topCats[0].spent, currency)}`, color: 'var(--text-700)', bg: 'var(--bg-muted)' });
    if (Math.abs(expChangePct) >= 5)
      items.push({ icon: expChangePct > 0 ? '📈' : '📉', text: `${expChangePct > 0 ? '+' : ''}${expChangePct}% expenses vs last period`, color: expChangePct > 0 ? 'var(--amber-600)' : 'var(--green-700)', bg: expChangePct > 0 ? 'var(--amber-50)' : 'var(--green-50)' });
    if (items.length === 0)
      items.push({ icon: '💡', text: 'Add transactions to unlock financial insights', color: 'var(--text-500)', bg: 'var(--bg-muted)' });
    return items.slice(0, 4);
  }, [totalIncome, globalTotalExpenses, savingsRate, topCats, expChangePct, sym, currency]);

  const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const isCurrentPeriod = selectedMonth === currentPeriod.month && selectedYear === currentPeriod.year;
  const maxCatSpend = topCats[0]?.spent ?? 1;

  return (
    <div style={{ maxWidth: 1400 }}>

      {/* ── Page header ── */}
      <div className="ws-header">
        <div>
          <h1 className="ws-title">{months[parseInt(selectedMonth) - 1]} {selectedYear}</h1>
          <p className="ws-subtitle">
            {periodRange}&nbsp;·&nbsp;
            {selectedCity !== 'Both' ? selectedCity : 'All locations'}
            {isCurrentPeriod ? ' · Current period' : ''}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => onNavigate('analytics')} className="ws-cta-btn">
            View Analytics <ArrowRight size={12} />
          </button>
          <button onClick={() => onNavigate('transactions')} className="ws-cta-btn">
            Transactions <ArrowRight size={12} />
          </button>
        </div>
      </div>

      {/* ── KPI cards ── */}
      <div className="ws-kpi-grid">

        {/* Income — always global */}
        <div className="ws-kpi-card ws-kpi-income">
          <div className="ws-kpi-icon">
            <TrendingUp size={19} />
          </div>
          <div className="ws-kpi-body">
            <div className="ws-kpi-label">Total Income</div>
            <div className="ws-kpi-value">{formatCurrencyShort(totalIncome, currency)}</div>
            {prevIncome > 0 && (
              <div className="ws-kpi-delta" style={{ color: incChangePct >= 0 ? 'var(--green-600)' : 'var(--red-500)', display: 'flex', alignItems: 'center', gap: 3 }}>
                {incChangePct >= 0 ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
                {incChangePct >= 0 ? '+' : ''}{incChangePct}% vs last period
              </div>
            )}
          </div>
        </div>

        {/* Expenses — city-scoped */}
        <div className="ws-kpi-card ws-kpi-expense">
          <div className="ws-kpi-icon">
            <TrendingDown size={19} />
          </div>
          <div className="ws-kpi-body">
            <div className="ws-kpi-label">
              Total Expenses
              {selectedCity !== 'Both' && (
                <span style={{ fontSize: '0.65rem', fontWeight: 500, color: 'var(--text-400)', marginLeft: 5 }}>
                  · {selectedCity}
                </span>
              )}
            </div>
            <div className="ws-kpi-value">{formatCurrencyShort(cityTotalExpenses, currency)}</div>
            {prevExpenses > 0 && (
              <div className="ws-kpi-delta" style={{ color: expChangePct <= 0 ? 'var(--green-600)' : 'var(--red-500)', display: 'flex', alignItems: 'center', gap: 3 }}>
                {expChangePct > 0 ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
                {expChangePct >= 0 ? '+' : ''}{expChangePct}% vs last period
              </div>
            )}
          </div>
        </div>

        {/* Net balance — global */}
        <div className={`ws-kpi-card ${netBalance >= 0 ? 'ws-kpi-positive' : 'ws-kpi-negative'}`}>
          <div className="ws-kpi-icon">
            <Minus size={19} />
          </div>
          <div className="ws-kpi-body">
            <div className="ws-kpi-label">Net Balance</div>
            <div className="ws-kpi-value" style={{ color: netBalance >= 0 ? 'var(--green-600)' : 'var(--red-500)' }}>
              {netBalance >= 0 ? '+' : '−'}{sym}{Math.abs(netBalance).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
            </div>
            <div className="ws-kpi-delta" style={{ color: netBalance >= 0 ? 'var(--green-500)' : 'var(--red-400)' }}>
              {netBalance >= 0 ? 'Cash flow positive' : 'Overspending'}
            </div>
          </div>
        </div>

        {/* Daily avg — city-scoped */}
        <div className="ws-kpi-card ws-kpi-neutral">
          <div className="ws-kpi-icon">
            <Zap size={19} />
          </div>
          <div className="ws-kpi-body">
            <div className="ws-kpi-label">
              Daily Avg Spend
              {selectedCity !== 'Both' && (
                <span style={{ fontSize: '0.65rem', fontWeight: 500, color: 'var(--text-400)', marginLeft: 5 }}>
                  · {selectedCity}
                </span>
              )}
            </div>
            <div className="ws-kpi-value">{formatCurrencyShort(avgDailySpend, currency)}</div>
            <div className="ws-kpi-delta" style={{ color: 'var(--text-400)' }}>
              {daysElapsed} days elapsed
            </div>
          </div>
        </div>

      </div>

      {/* ── Lower row ── */}
      <div className="ws-lower-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>

        {/* Financial Health — global */}
        <div className="ws-panel">
          <div className="ws-panel-header">
            <Activity size={14} />
            <span>Financial Health</span>
          </div>
          <div style={{ textAlign: 'center', padding: '16px 0 12px' }}>
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 88,
              height: 88,
              borderRadius: '50%',
              background: healthBg,
              border: `3px solid ${healthColor}`,
              marginBottom: 10,
            }}>
              <div>
                <div style={{ fontSize: '2rem', fontWeight: 800, color: healthColor, lineHeight: 1, letterSpacing: '-0.03em' }}>
                  {healthScore}
                </div>
                <div style={{ fontSize: '0.625rem', color: healthColor, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  score
                </div>
              </div>
            </div>
            <div style={{ fontSize: '0.875rem', fontWeight: 700, color: healthColor }}>{healthLabel}</div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-400)', marginTop: 2 }}>out of 100</div>
          </div>
          <div style={{ background: 'var(--bg-muted)', borderRadius: 99, height: 7, overflow: 'hidden', marginTop: 6 }}>
            <div style={{
              height: '100%',
              width: `${healthScore}%`,
              background: `linear-gradient(90deg, ${healthColor}88, ${healthColor})`,
              borderRadius: 99,
              transition: 'width 0.7s cubic-bezier(0.4,0,0.2,1)',
            }} />
          </div>
        </div>

        {/* Savings rate — global */}
        <div className="ws-panel">
          <div className="ws-panel-header">
            <span style={{ fontSize: '0.8rem' }}>💰</span>
            <span>Savings Rate</span>
          </div>
          <div style={{ textAlign: 'center', padding: '14px 0 8px' }}>
            <div style={{
              fontSize: '2.5rem',
              fontWeight: 800,
              color: savingsRate >= 20 ? 'var(--green-600)' : savingsRate >= 10 ? 'var(--amber-500)' : 'var(--red-500)',
              lineHeight: 1,
              letterSpacing: '-0.03em',
            }}>
              {savingsRate}%
            </div>
            <div style={{
              fontSize: '0.75rem',
              color: savingsRate >= 20 ? 'var(--green-600)' : 'var(--text-400)',
              fontWeight: 500,
              marginTop: 6,
            }}>
              {savingsRate >= 20 ? 'Above target ✓' : savingsRate >= 10 ? 'Getting there' : totalIncome === 0 ? 'No income recorded' : 'Below target — aim for 20%'}
            </div>
          </div>
          {totalIncome > 0 && (
            <div style={{ marginTop: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5, fontSize: '0.72rem', color: 'var(--text-400)' }}>
                <span>Target: 20%</span>
                <span>{sym}{Math.round(totalIncome * 0.2).toLocaleString('en-IN')}</span>
              </div>
              <div className="progress-track">
                <div
                  className="progress-fill"
                  style={{
                    width: `${Math.min(100, savingsRate / 20 * 100)}%`,
                    background: savingsRate >= 20 ? 'var(--green-500)' : savingsRate >= 10 ? 'var(--amber-500)' : 'var(--red-500)',
                  }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Top categories — global */}
        <div className="ws-panel" style={{ gridColumn: topCats.length > 0 ? 'span 2' : undefined }}>
          <div className="ws-panel-header">
            <span style={{ fontSize: '0.8rem' }}>📊</span>
            <span>Top Spending Categories</span>
            <button
              onClick={() => onNavigate('analytics')}
              style={{ marginLeft: 'auto', fontSize: '0.72rem', color: 'var(--brand-600)', fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 3 }}
            >
              Full view <ArrowRight size={10} />
            </button>
          </div>
          {topCats.length === 0 ? (
            <div className="empty-state" style={{ padding: '24px 0' }}>
              <div className="empty-state-icon">📭</div>
              <div className="empty-state-title" style={{ fontSize: '0.875rem' }}>No expenses yet</div>
              <div className="empty-state-subtitle" style={{ fontSize: '0.78rem' }}>Add some transactions to see breakdown</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 4 }}>
              {topCats.map(cat => (
                <div key={cat.id}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 5 }}>
                    <div style={{
                      width: 32,
                      height: 32,
                      borderRadius: 'var(--r-md)',
                      background: `${cat.color}18`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '1rem',
                      flexShrink: 0,
                    }}>
                      {cat.icon}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                        <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-900)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {cat.name}
                        </span>
                        <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--text-900)', flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>
                          {sym}{cat.spent.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                        </span>
                      </div>
                      <div className="progress-track" style={{ marginTop: 4 }}>
                        <div
                          className="progress-fill"
                          style={{
                            width: `${(cat.spent / maxCatSpend) * 100}%`,
                            background: cat.color,
                            opacity: 0.85,
                          }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Quick Insights — global */}
        <div className="ws-panel">
          <div className="ws-panel-header">
            <span style={{ fontSize: '0.8rem' }}>💡</span>
            <span>Quick Insights</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 4 }}>
            {insights.map((ins, i) => (
              <div
                key={i}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 10,
                  padding: '10px 12px',
                  background: ins.bg,
                  borderRadius: 'var(--r-md)',
                }}
              >
                <span style={{ fontSize: '0.875rem', flexShrink: 0 }}>{ins.icon}</span>
                <p style={{ fontSize: '0.78rem', color: ins.color, fontWeight: 500, lineHeight: 1.4 }}>{ins.text}</p>
              </div>
            ))}
          </div>
        </div>

      </div>

    </div>
  );
}
