'use client';

import { useMemo, useState, useRef, useEffect } from 'react';
import {
  TrendingUp, TrendingDown, Zap, Activity,
  ArrowRight, ArrowUpRight, ArrowDownRight, Target,
  Settings2, Check, Wallet, AlertTriangle,
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
    monthlyBudgets, budgetCategoryIds,
    setMonthlyBudget, getMonthlyBudget, setBudgetCategoryIds,
    savingsTarget,
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
    const targetCap = savingsTarget > 0 ? savingsTarget : 20;
    const srScore = Math.min(targetCap, Math.max(0, savingsRate)) / targetCap * 40;
    const cfScore = netBalance >= 0 ? 40 : Math.max(0, 40 + (netBalance / totalIncome) * 40);
    return Math.round(Math.min(100, srScore + cfScore + 20));
  }, [totalIncome, savingsRate, savingsTarget, netBalance]);

  const healthLabel = healthScore >= 80 ? 'Excellent' : healthScore >= 65 ? 'Good' : healthScore >= 45 ? 'Fair' : 'Needs work';
  const healthColor = healthScore >= 80 ? 'var(--green-500)' : healthScore >= 65 ? 'var(--blue-500)' : healthScore >= 45 ? 'var(--amber-500)' : 'var(--red-500)';

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
    if (savingsRate >= savingsTarget)
      items.push({ icon: '✅', text: `${savingsRate}% savings rate — healthy trajectory`, color: 'var(--green-700)', bg: 'var(--green-50)' });
    if (topCats[0])
      items.push({ icon: topCats[0].icon, text: `Top spend: ${topCats[0].name} at ${formatCurrencyShort(topCats[0].spent, currency)}`, color: 'var(--text-700)', bg: 'var(--bg-muted)' });
    if (Math.abs(expChangePct) >= 5)
      items.push({ icon: expChangePct > 0 ? '📈' : '📉', text: `${expChangePct > 0 ? '+' : ''}${expChangePct}% expenses vs last period`, color: expChangePct > 0 ? 'var(--amber-600)' : 'var(--green-700)', bg: expChangePct > 0 ? 'var(--amber-50)' : 'var(--green-50)' });
    if (items.length === 0)
      items.push({ icon: '💡', text: 'Add transactions to unlock financial insights', color: 'var(--text-500)', bg: 'var(--bg-muted)' });
    return items.slice(0, 4);
  }, [totalIncome, globalTotalExpenses, savingsRate, savingsTarget, topCats, expChangePct, sym, currency]);

  const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const isCurrentPeriod = selectedMonth === currentPeriod.month && selectedYear === currentPeriod.year;
  const maxCatSpend = topCats[0]?.spent ?? 1;

  // ── Budget tracker ──────────────────────────────────────────────────────
  const [budgetConfigOpen, setBudgetConfigOpen] = useState(false);
  const [breakdownOpen, setBreakdownOpen] = useState(false);
  const currentMonthBudget = getMonthlyBudget(selectedMonth, selectedYear);
  const [budgetInput, setBudgetInput] = useState(currentMonthBudget > 0 ? String(currentMonthBudget) : '');
  const budgetConfigRef = useRef<HTMLDivElement>(null);

  // Sync budget input when month/year changes
  useEffect(() => {
    const b = getMonthlyBudget(selectedMonth, selectedYear);
    setBudgetInput(b > 0 ? String(b) : '');
  }, [selectedMonth, selectedYear, monthlyBudgets]); // eslint-disable-line react-hooks/exhaustive-deps

  // Close config panel on outside click
  useEffect(() => {
    if (!budgetConfigOpen) return;
    const handler = (e: MouseEvent) => {
      if (budgetConfigRef.current && !budgetConfigRef.current.contains(e.target as Node)) {
        setBudgetConfigOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [budgetConfigOpen]);

  // Expense categories only (for budget selection)
  const expenseCategories = useMemo(() =>
    categories.filter(c => c.type !== 'income'),
    [categories]);

  // Budget-tracked spending: only from selected budget categories
  const budgetTrackedSpending = useMemo(() => {
    if (budgetCategoryIds.length === 0) return 0;
    return allExpenses
      .filter(e =>
        e.month === selectedMonth &&
        e.year === selectedYear &&
        budgetCategoryIds.includes(e.category)
      )
      .reduce((sum, e) => sum + e.amount, 0);
  }, [allExpenses, selectedMonth, selectedYear, budgetCategoryIds]);

  // Per-category breakdown for budget — only categories with spending
  const budgetCategoryBreakdown = useMemo(() => {
    if (budgetCategoryIds.length === 0) return [];
    const totals: Record<string, number> = {};
    for (const e of allExpenses) {
      if (e.month === selectedMonth && e.year === selectedYear && budgetCategoryIds.includes(e.category)) {
        totals[e.category] = (totals[e.category] ?? 0) + e.amount;
      }
    }
    return categories
      .filter(c => budgetCategoryIds.includes(c.id))
      .map(c => ({ ...c, spent: totals[c.id] ?? 0 }))
      .filter(c => c.spent > 0)
      .sort((a, b) => b.spent - a.spent);
  }, [allExpenses, selectedMonth, selectedYear, budgetCategoryIds, categories]);

  const budgetRemaining = currentMonthBudget - budgetTrackedSpending;
  const budgetUsedPct = currentMonthBudget > 0 ? Math.round((budgetTrackedSpending / currentMonthBudget) * 100) : 0;
  const budgetConfigured = currentMonthBudget > 0 && budgetCategoryIds.length > 0;

  const toggleBudgetCategory = (id: string) => {
    setBudgetCategoryIds(
      budgetCategoryIds.includes(id)
        ? budgetCategoryIds.filter(x => x !== id)
        : [...budgetCategoryIds, id]
    );
  };

  const monthNames = months;

  return (
    <div style={{ maxWidth: 1400 }}>

      {/* ── Page header ── */}
      <div className="ws-header" style={{ marginBottom: 24 }}>
        <div>
          <h1 className="ws-title" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {months[parseInt(selectedMonth) - 1]} {selectedYear}
            {isCurrentPeriod && (
              <span style={{
                fontSize: '0.6875rem', fontWeight: 700, padding: '3px 10px', borderRadius: 99,
                background: 'var(--green-50)', color: 'var(--green-700)',
                border: '1px solid var(--green-100)',
              }}>
                Current
              </span>
            )}
          </h1>
          <p className="ws-subtitle">
            {periodRange}&nbsp;·&nbsp;
            {selectedCity !== 'Both' ? selectedCity : 'All locations'}
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
      <div className="ws-kpi-grid stagger-fade">

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
            {netBalance >= 0 ? <TrendingUp size={19} /> : <TrendingDown size={19} />}
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

      {/* ── Budget Tracker ── */}
      <div ref={budgetConfigRef} style={{
        background: 'var(--bg-surface)',
        border: '1px solid var(--border-default)',
        borderRadius: 'var(--r-xl)',
        marginBottom: 20,
        boxShadow: 'var(--shadow-xs)',
        overflow: 'visible',
        position: 'relative',
      }}>
        {/* Header */}
        <div style={{ padding: '16px 20px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{
              width: 30, height: 30, borderRadius: 8,
              background: 'linear-gradient(135deg, #4f46e5, #7c3aed)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Wallet size={14} color="#fff" />
            </div>
            <div>
              <div style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--text-900)' }}>
                Monthly Budget
              </div>
              <div style={{ fontSize: '0.6875rem', color: 'var(--text-400)', marginTop: 1 }}>
                {budgetConfigured
                  ? `${monthNames[parseInt(selectedMonth) - 1]} ${selectedYear} · ${budgetCategoryIds.length} categor${budgetCategoryIds.length === 1 ? 'y' : 'ies'} tracked`
                  : 'Set a budget to track your spending'}
              </div>
            </div>
          </div>
          <button
            onClick={() => { setBudgetConfigOpen(!budgetConfigOpen); if (!budgetConfigOpen) setBudgetInput(currentMonthBudget > 0 ? String(currentMonthBudget) : ''); }}
            style={{
              background: budgetConfigOpen ? 'var(--brand-50)' : 'var(--bg-muted)',
              border: `1px solid ${budgetConfigOpen ? 'var(--brand-200)' : 'var(--border-default)'}`,
              borderRadius: 8,
              padding: '6px 12px',
              fontSize: '0.72rem',
              fontWeight: 600,
              color: budgetConfigOpen ? 'var(--brand-700)' : 'var(--text-600)',
              cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 5,
              transition: 'all 0.15s',
            }}
          >
            <Settings2 size={12} />
            Configure
          </button>
        </div>

        {/* Config panel (expandable) */}
        {budgetConfigOpen && (
          <div style={{
            padding: '16px 20px',
            margin: '12px 16px 0',
            background: 'var(--bg-muted)',
            borderRadius: 12,
            border: '1px solid var(--border-default)',
          }}>
            {/* Budget amount input */}
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-500)', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginBottom: 6 }}>
                Budget for {monthNames[parseInt(selectedMonth) - 1]} {selectedYear}
              </label>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <div style={{
                  display: 'flex', alignItems: 'center',
                  background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: 8,
                  flex: 1, overflow: 'hidden',
                }}>
                  <span style={{ padding: '0 0 0 12px', fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-400)' }}>{sym}</span>
                  <input
                    type="number"
                    min="0"
                    step="100"
                    value={budgetInput}
                    onChange={e => setBudgetInput(e.target.value)}
                    placeholder="e.g. 50000"
                    style={{
                      flex: 1, border: 'none', outline: 'none', padding: '10px 12px 10px 4px',
                      fontSize: '0.875rem', fontWeight: 600, background: 'transparent',
                      color: 'var(--text-900)',
                    }}
                  />
                </div>
                <button
                  onClick={() => {
                    const val = parseFloat(budgetInput);
                    if (!isNaN(val) && val > 0) {
                      setMonthlyBudget(selectedMonth, selectedYear, val);
                    }
                  }}
                  style={{
                    background: 'linear-gradient(135deg, #4f46e5, #7c3aed)',
                    color: '#fff', border: 'none', borderRadius: 8,
                    padding: '10px 16px', fontSize: '0.78rem', fontWeight: 700,
                    cursor: 'pointer', whiteSpace: 'nowrap',
                    display: 'flex', alignItems: 'center', gap: 4,
                  }}
                >
                  <Check size={13} /> Set
                </button>
              </div>
            </div>

            {/* Category selector */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-500)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Categories to Track
                </label>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button
                    onClick={() => setBudgetCategoryIds(expenseCategories.map(c => c.id))}
                    style={{ fontSize: '0.65rem', fontWeight: 600, color: 'var(--brand-600)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}
                  >
                    Select all
                  </button>
                  <button
                    onClick={() => setBudgetCategoryIds([])}
                    style={{ fontSize: '0.65rem', fontWeight: 600, color: 'var(--text-400)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}
                  >
                    Clear
                  </button>
                </div>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {expenseCategories.map(cat => {
                  const active = budgetCategoryIds.includes(cat.id);
                  return (
                    <button
                      key={cat.id}
                      onClick={() => toggleBudgetCategory(cat.id)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 5,
                        padding: '5px 10px', borderRadius: 99,
                        fontSize: '0.72rem', fontWeight: 600,
                        background: active ? `${cat.color}18` : 'var(--bg-surface)',
                        border: `1.5px solid ${active ? cat.color : 'var(--border-default)'}`,
                        color: active ? cat.color : 'var(--text-400)',
                        cursor: 'pointer',
                        transition: 'all 0.15s',
                      }}
                    >
                      <span style={{ fontSize: '0.8rem' }}>{cat.icon}</span>
                      {cat.name}
                      {active && <Check size={11} strokeWidth={3} />}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Budget display */}
        {budgetConfigured ? (
          <div style={{ padding: '16px 20px 18px' }}>
            {/* Main progress */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 10 }}>
              <div>
                <div style={{
                  fontSize: '1.5rem', fontWeight: 800, letterSpacing: '-0.03em',
                  color: budgetUsedPct > 100 ? 'var(--red-500)' : 'var(--text-900)',
                  fontVariantNumeric: 'tabular-nums', lineHeight: 1,
                }}>
                  {sym}{Math.round(budgetTrackedSpending).toLocaleString('en-IN')}
                </div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-400)', marginTop: 4 }}>
                  of {sym}{Math.round(currentMonthBudget).toLocaleString('en-IN')} budget
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{
                  fontSize: '1.25rem', fontWeight: 800, letterSpacing: '-0.02em',
                  color: budgetRemaining >= 0 ? 'var(--green-600)' : 'var(--red-500)',
                  fontVariantNumeric: 'tabular-nums', lineHeight: 1,
                }}>
                  {budgetRemaining >= 0 ? '' : '-'}{sym}{Math.abs(Math.round(budgetRemaining)).toLocaleString('en-IN')}
                </div>
                <div style={{ fontSize: '0.72rem', color: budgetRemaining >= 0 ? 'var(--green-500)' : 'var(--red-400)', marginTop: 4, fontWeight: 600 }}>
                  {budgetRemaining >= 0 ? 'remaining' : 'over budget'}
                </div>
              </div>
            </div>

            {/* Progress bar */}
            <div style={{ height: 10, background: 'var(--bg-muted)', borderRadius: 99, overflow: 'hidden', position: 'relative' }}>
              <div style={{
                height: '100%',
                width: `${Math.min(100, budgetUsedPct)}%`,
                background: budgetUsedPct > 100
                  ? 'linear-gradient(90deg, #ef4444, #dc2626)'
                  : budgetUsedPct > 80
                    ? 'linear-gradient(90deg, #f59e0b, #d97706)'
                    : budgetUsedPct > 50
                      ? 'linear-gradient(90deg, #3b82f6, #2563eb)'
                      : 'linear-gradient(90deg, #10b981, #059669)',
                borderRadius: 99,
                transition: 'width 0.7s cubic-bezier(0.4,0,0.2,1)',
              }} />
              {/* 80% warning marker */}
              <div style={{
                position: 'absolute', left: '80%', top: 0, bottom: 0, width: 2,
                background: 'var(--text-300)', opacity: 0.4,
              }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 5 }}>
              <span style={{ fontSize: '0.65rem', color: 'var(--text-400)', fontVariantNumeric: 'tabular-nums' }}>
                {budgetUsedPct}% used
              </span>
              <span style={{ fontSize: '0.65rem', color: 'var(--text-300)' }}>80%</span>
            </div>

            {/* Over-budget warning */}
            {budgetUsedPct > 100 && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '8px 12px', marginTop: 10,
                background: '#fef2f2', borderRadius: 8,
                border: '1px solid #fecaca',
              }}>
                <AlertTriangle size={14} style={{ color: '#ef4444', flexShrink: 0 }} />
                <span style={{ fontSize: '0.72rem', fontWeight: 600, color: '#991b1b' }}>
                  You&apos;ve exceeded your budget by {sym}{Math.abs(Math.round(budgetRemaining)).toLocaleString('en-IN')}
                </span>
              </div>
            )}

            {/* Per-category breakdown — collapsible */}
            {budgetCategoryBreakdown.length > 0 && (
              <div style={{ marginTop: 12 }}>
                <button
                  onClick={() => setBreakdownOpen(!breakdownOpen)}
                  style={{
                    width: '100%', background: 'none', border: 'none', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '6px 0',
                  }}
                >
                  <span style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-400)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Category Breakdown ({budgetCategoryBreakdown.length})
                  </span>
                  <svg
                    width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="var(--text-400)" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"
                    style={{ transition: 'transform 0.2s', transform: breakdownOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}
                  >
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </button>
                {breakdownOpen && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, paddingTop: 6 }}>
                    {budgetCategoryBreakdown.map(cat => {
                      const catPct = currentMonthBudget > 0 ? (cat.spent / currentMonthBudget) * 100 : 0;
                      return (
                        <div key={cat.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontSize: '0.85rem', width: 22, textAlign: 'center', flexShrink: 0 }}>{cat.icon}</span>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                              <span style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-700)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {cat.name}
                              </span>
                              <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-900)', fontVariantNumeric: 'tabular-nums', flexShrink: 0, marginLeft: 8 }}>
                                {sym}{Math.round(cat.spent).toLocaleString('en-IN')}
                              </span>
                            </div>
                            <div style={{ height: 4, background: 'var(--bg-muted)', borderRadius: 99, overflow: 'hidden' }}>
                              <div style={{
                                height: '100%',
                                width: `${Math.min(100, catPct)}%`,
                                background: cat.color,
                                borderRadius: 99,
                                transition: 'width 0.5s ease',
                              }} />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          /* Empty state — prompt user to configure */
          <div style={{ padding: '20px 20px 24px', textAlign: 'center' }}>
            <div style={{ fontSize: '1.8rem', marginBottom: 8 }}>
              <Target size={28} style={{ color: 'var(--text-300)', margin: '0 auto' }} />
            </div>
            <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-600)', marginBottom: 4 }}>
              No budget configured yet
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-400)', maxWidth: 320, margin: '0 auto', lineHeight: 1.5 }}>
              Set a monthly spending budget and choose which categories to track.
              Exclude recurring fixed costs like rent or debt to focus on discretionary spending.
            </div>
            <button
              onClick={() => { setBudgetConfigOpen(true); setBudgetInput(''); }}
              style={{
                marginTop: 12,
                background: 'linear-gradient(135deg, #4f46e5, #7c3aed)',
                color: '#fff', border: 'none', borderRadius: 8,
                padding: '8px 20px', fontSize: '0.78rem', fontWeight: 700,
                cursor: 'pointer',
                display: 'inline-flex', alignItems: 'center', gap: 5,
              }}
            >
              <Settings2 size={13} /> Set Up Budget
            </button>
          </div>
        )}
      </div>

      {/* ── Lower row ── */}
      <div className="ws-lower-grid stagger-fade" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>

        {/* Financial Health — global */}
        <div className="ws-panel">
          <div className="ws-panel-header">
            <Activity size={14} style={{ color: healthColor }} />
            <span>Financial Health</span>
          </div>
          <div style={{ textAlign: 'center', padding: '20px 0 16px' }}>
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 92,
              height: 92,
              borderRadius: '50%',
              background: `conic-gradient(${healthColor} 0% ${healthScore}%, var(--bg-muted) ${healthScore}% 100%)`,
              marginBottom: 12,
              position: 'relative',
            }}>
              <div style={{
                width: 72,
                height: 72,
                borderRadius: '50%',
                background: 'var(--bg-surface)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexDirection: 'column',
              }}>
                <div style={{ fontSize: '1.75rem', fontWeight: 800, color: healthColor, lineHeight: 1, letterSpacing: '-0.03em' }}>
                  {healthScore}
                </div>
                <div style={{ fontSize: '0.5625rem', color: 'var(--text-400)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  / 100
                </div>
              </div>
            </div>
            <div style={{ fontSize: '0.875rem', fontWeight: 700, color: healthColor }}>{healthLabel}</div>
          </div>
        </div>

        {/* Savings rate — global */}
        <div className="ws-panel">
          <div className="ws-panel-header">
            <span style={{ fontSize: '0.8rem' }}>💰</span>
            <span>Savings Rate</span>
          </div>
          <div style={{ textAlign: 'center', padding: '20px 0 12px' }}>
            <div style={{
              fontSize: '2.5rem',
              fontWeight: 800,
              color: savingsRate >= savingsTarget ? 'var(--green-600)' : savingsRate >= savingsTarget / 2 ? 'var(--amber-500)' : 'var(--red-500)',
              lineHeight: 1,
              letterSpacing: '-0.03em',
            }}>
              {savingsRate}%
            </div>
            <div style={{
              fontSize: '0.75rem',
              color: savingsRate >= savingsTarget ? 'var(--green-600)' : 'var(--text-400)',
              fontWeight: 500,
              marginTop: 8,
            }}>
              {savingsRate >= savingsTarget ? 'Above target' : savingsRate >= savingsTarget / 2 ? 'Getting there' : totalIncome === 0 ? 'No income recorded' : `Below target — aim for ${savingsTarget}%`}
            </div>
          </div>
          {totalIncome > 0 && (
            <div style={{ marginTop: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5, fontSize: '0.72rem', color: 'var(--text-400)' }}>
                <span>Target: {savingsTarget}%</span>
                <span>{sym}{Math.round(totalIncome * savingsTarget / 100).toLocaleString('en-IN')}</span>
              </div>
              <div className="progress-track">
                <div
                  className="progress-fill"
                  style={{
                    width: `${Math.min(100, savingsRate / savingsTarget * 100)}%`,
                    background: savingsRate >= savingsTarget ? 'var(--green-500)' : savingsRate >= savingsTarget / 2 ? 'var(--amber-500)' : 'var(--red-500)',
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
            <div className="empty-state" style={{ padding: '28px 0' }}>
              <div className="empty-state-icon">📭</div>
              <div className="empty-state-title" style={{ fontSize: '0.875rem' }}>No expenses yet</div>
              <div className="empty-state-subtitle" style={{ fontSize: '0.78rem' }}>Add some transactions to see breakdown</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 6 }}>
              {topCats.map(cat => (
                <div key={cat.id}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 5 }}>
                    <div style={{
                      width: 34,
                      height: 34,
                      borderRadius: 'var(--r-md)',
                      background: `${cat.color}14`,
                      border: `1px solid ${cat.color}22`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '1rem',
                      flexShrink: 0,
                    }}>
                      {cat.icon}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
                        <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-900)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {cat.name}
                        </span>
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, flexShrink: 0 }}>
                          <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--text-900)', fontVariantNumeric: 'tabular-nums' }}>
                            {sym}{cat.spent.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                          </span>
                          {globalTotalExpenses > 0 && (
                            <span style={{ fontSize: '0.6875rem', fontWeight: 600, color: 'var(--text-400)' }}>
                              {Math.round((cat.spent / globalTotalExpenses) * 100)}%
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="progress-track" style={{ height: 5 }}>
                        <div
                          className="progress-fill"
                          style={{
                            width: `${(cat.spent / maxCatSpend) * 100}%`,
                            background: `linear-gradient(90deg, ${cat.color}cc, ${cat.color})`,
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
                  border: '1px solid transparent',
                  transition: 'border-color 0.15s',
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--border-default)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.borderColor = 'transparent'; }}
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
