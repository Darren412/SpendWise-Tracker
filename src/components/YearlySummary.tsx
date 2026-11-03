'use client';

import { Fragment, useEffect, useMemo, useState } from 'react';
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ReferenceLine,
} from 'recharts';
import { useBudgetStore } from '@/store/budgetStore';
import { useBalanceLedger } from '@/hooks/useBalanceLedger';
import { getYearBalance } from '@/lib/balance';
import { useChartTheme } from '@/components/charts/chartTheme';
import OpeningBalanceModal from '@/components/balance/OpeningBalanceModal';
import { formatCurrency } from '@/utils/currency';
import type { Expense } from '@/types';
import {
  Activity,
  ArrowDownRight,
  Award,
  BarChart3,
  Calendar,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Flame,
  Layers,
  PieChart,
  PiggyBank,
  Receipt,
  Sparkles,
  Target,
  TrendingDown,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const UNCATEGORIZED = { id: '__uncategorized__', name: 'Uncategorized', color: 'var(--text-400)', icon: '📦' };

// Category | Yearly Total | Share | Monthly Avg | Last Year | YoY | Txns | Peak
const BREAKDOWN_GRID =
  'minmax(160px,1.6fr) minmax(95px,1fr) minmax(120px,1.2fr) minmax(95px,1fr) minmax(95px,1fr) minmax(85px,0.9fr) minmax(55px,0.55fr) minmax(70px,0.7fr)';

// Category | Jan..Dec | Total
const HEATMAP_GRID = 'minmax(140px,1.5fr) repeat(12, minmax(48px,1fr)) minmax(64px,1fr)';

function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace('#', '');
  if (h.length !== 3 && h.length !== 6) return `rgba(148,163,184,${alpha})`;
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const n = parseInt(full, 16);
  if (Number.isNaN(n)) return `rgba(148,163,184,${alpha})`;
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
}

function compactAmount(v: number): string {
  return v >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(Math.round(v));
}

interface CategoryRow {
  key: string;
  name: string;
  icon: string;
  color: string;
  total: number;
  lastTotal: number;
  share: number;
  monthlyAvg: number;
  txns: number;
  peakIdx: number; // -1 when no spend this year
  yoyPct: number | null; // null => "New" (no spend last year)
  monthly: number[];
  top: Expense[];
}

interface Insight {
  Icon: LucideIcon;
  bg: string;
  border: string;
  color: string;
  text: string;
}

export default function YearlySummary() {
  const { expenses, income, categories, selectedYear, currency, savingsTarget, openingBalance } = useBudgetStore();
  const ledger = useBalanceLedger();
  const chartTheme = useChartTheme();

  const [year, setYear] = useState(selectedYear);
  const [showBreakdown, setShowBreakdown] = useState(false);
  const [showHeatmap, setShowHeatmap] = useState(false);
  const [sortKey, setSortKey] = useState<'amount' | 'yoy' | 'name'>('amount');
  const [expandedCat, setExpandedCat] = useState<string | null>(null);
  const [balanceModal, setBalanceModal] = useState(false);

  useEffect(() => {
    setYear(selectedYear);
  }, [selectedYear]);

  const availableYears = useMemo(() => {
    const set = new Set<number>();
    expenses.forEach((e) => set.add(e.year));
    income.forEach((i) => set.add(i.year));
    set.add(selectedYear);
    return [...set].sort((a, b) => a - b);
  }, [expenses, income, selectedYear]);

  const data = useMemo(() => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonthIdx = now.getMonth();
    const elapsed = year < currentYear ? 12 : year === currentYear ? currentMonthIdx + 1 : 0;
    const avgDivisor = year === currentYear ? Math.max(1, elapsed) : 12;

    const catById = new Map(categories.map((c) => [c.id, c]));

    const yearExpenses = expenses.filter((e) => e.year === year);
    const yearIncome = income.filter((i) => i.year === year);

    // Compare like-for-like: for an in-progress year, last year's figures only
    // cover the same elapsed months; for past years the full year is used.
    const compareMonths = year === currentYear ? elapsed : 12;
    const compareLabel =
      year === currentYear ? `Jan–${MONTH_NAMES[elapsed - 1]} ${year - 1}` : String(year - 1);
    const inCompareWindow = (m: string) => parseInt(m, 10) <= compareMonths;
    const prevExpenses = expenses.filter((e) => e.year === year - 1 && inCompareWindow(e.month));
    const prevIncome = income.filter((i) => i.year === year - 1 && inCompareWindow(i.month));

    const totalSpent = yearExpenses.reduce((s, e) => s + e.amount, 0);
    const totalIncome = yearIncome.reduce((s, i) => s + i.amount, 0);
    const totalSavings = totalIncome - totalSpent;
    const savingsRate = totalIncome > 0 ? (totalSavings / totalIncome) * 100 : 0;

    const prevSpent = prevExpenses.reduce((s, e) => s + e.amount, 0);
    const prevIncomeTotal = prevIncome.reduce((s, i) => s + i.amount, 0);
    const prevSavings = prevIncomeTotal - prevSpent;
    const prevRate = prevIncomeTotal > 0 ? (prevSavings / prevIncomeTotal) * 100 : 0;

    const monthlyData = Array.from({ length: 12 }, (_, i) => {
      const m = String(i + 1).padStart(2, '0');
      const mExp = yearExpenses.filter((e) => e.month === m);
      const mInc = yearIncome.filter((x) => x.month === m);
      const expense = mExp.reduce((s, e) => s + e.amount, 0);
      const inc = mInc.reduce((s, x) => s + x.amount, 0);
      return { name: MONTH_NAMES[i], income: inc, expense, savings: inc - expense, txns: mExp.length };
    });

    const activeExpenseMonths = monthlyData.filter((m) => m.expense > 0).length;
    const activeIncomeMonths = monthlyData.filter((m) => m.income > 0).length;
    const activeMonths = monthlyData.filter((m) => m.income > 0 || m.expense > 0).length;
    const maxBar = Math.max(...monthlyData.map((m) => Math.max(m.income, m.expense)), 1);

    // ── Per-category aggregation (this year + last year) ──────────────────
    interface CatAcc {
      name: string;
      icon: string;
      color: string;
      total: number;
      lastTotal: number;
      txns: number;
      monthly: number[];
      exps: Expense[];
    }
    const acc = new Map<string, CatAcc>();
    const bucketFor = (catId: string): CatAcc => {
      const meta = catById.get(catId);
      const key = meta ? meta.id : UNCATEGORIZED.id;
      let a = acc.get(key);
      if (!a) {
        a = {
          name: meta?.name ?? UNCATEGORIZED.name,
          icon: meta?.icon ?? UNCATEGORIZED.icon,
          color: meta?.color ?? UNCATEGORIZED.color,
          total: 0,
          lastTotal: 0,
          txns: 0,
          monthly: Array(12).fill(0),
          exps: [],
        };
        acc.set(key, a);
      }
      return a;
    };
    yearExpenses.forEach((e) => {
      const a = bucketFor(e.category);
      const mi = parseInt(e.month, 10) - 1;
      a.total += e.amount;
      a.txns += 1;
      if (mi >= 0 && mi <= 11) a.monthly[mi] += e.amount;
      a.exps.push(e);
    });
    prevExpenses.forEach((e) => {
      bucketFor(e.category).lastTotal += e.amount;
    });

    const categoryRows: CategoryRow[] = [...acc.entries()].map(([key, a]) => ({
      key,
      name: a.name,
      icon: a.icon,
      color: a.color,
      total: a.total,
      lastTotal: a.lastTotal,
      share: totalSpent > 0 ? (a.total / totalSpent) * 100 : 0,
      monthlyAvg: a.total / avgDivisor,
      txns: a.txns,
      peakIdx: a.total > 0 ? a.monthly.indexOf(Math.max(...a.monthly)) : -1,
      yoyPct: a.lastTotal > 0 ? ((a.total - a.lastTotal) / a.lastTotal) * 100 : null,
      monthly: a.monthly,
      top: [...a.exps].sort((x, y) => y.amount - x.amount).slice(0, 3),
    }));
    const spendRows = categoryRows.filter((r) => r.total > 0).sort((a, b) => b.total - a.total);

    // ── Heatmap ───────────────────────────────────────────────────────────
    const heatmapRows = spendRows;
    const maxCell = Math.max(1, ...spendRows.flatMap((r) => r.monthly));

    // ── Income sources ────────────────────────────────────────────────────
    const sourceAcc = new Map<string, { name: string; total: number; count: number }>();
    yearIncome.forEach((i) => {
      const trimmed = i.source.trim();
      const key = (trimmed || 'other').toLowerCase();
      const s = sourceAcc.get(key);
      if (s) {
        s.total += i.amount;
        s.count += 1;
      } else {
        sourceAcc.set(key, { name: trimmed || 'Other', total: i.amount, count: 1 });
      }
    });
    const incomeSources = [...sourceAcc.values()]
      .sort((a, b) => b.total - a.total)
      .map((s) => ({ ...s, share: totalIncome > 0 ? (s.total / totalIncome) * 100 : 0 }));

    // ── Secondary KPIs ────────────────────────────────────────────────────
    const avgMonthlySpend = activeExpenseMonths > 0 ? totalSpent / activeExpenseMonths : 0;
    const avgMonthlyIncome = activeIncomeMonths > 0 ? totalIncome / activeIncomeMonths : 0;
    const txnsPerMonth = activeExpenseMonths > 0 ? yearExpenses.length / activeExpenseMonths : 0;
    const projectedSpend = elapsed > 0 ? (totalSpent / elapsed) * 12 : 0;

    const expenseMonths = monthlyData.filter((m) => m.expense > 0);
    const highestMonth = expenseMonths.length
      ? expenseMonths.reduce((a, b) => (b.expense > a.expense ? b : a))
      : null;
    const lowestMonth = expenseMonths.length
      ? expenseMonths.reduce((a, b) => (b.expense < a.expense ? b : a))
      : null;

    const incomeMonths = monthlyData.filter((m) => m.income > 0);
    const bestSavingsMonth = incomeMonths.length
      ? incomeMonths.reduce((a, b) => (b.savings / b.income > a.savings / a.income ? b : a))
      : null;
    const targetHitCount = incomeMonths.filter(
      (m) => (m.savings / m.income) * 100 >= savingsTarget
    ).length;

    // ── Insights ──────────────────────────────────────────────────────────
    const insights: Insight[] = [];

    if (highestMonth) {
      insights.push({
        Icon: Flame,
        bg: 'var(--red-50)',
        border: 'var(--red-200)',
        color: 'var(--danger-text)',
        text: `${highestMonth.name} was your most expensive month — ${formatCurrency(highestMonth.expense, currency)} spent.`,
      });
    }
    if (lowestMonth && highestMonth && lowestMonth.name !== highestMonth.name) {
      insights.push({
        Icon: ArrowDownRight,
        bg: 'var(--green-50)',
        border: 'var(--green-200)',
        color: 'var(--success-text)',
        text: `${lowestMonth.name} was your lightest month — ${formatCurrency(lowestMonth.expense, currency)} spent.`,
      });
    }
    if (bestSavingsMonth) {
      insights.push({
        Icon: Award,
        bg: 'var(--brand-50)',
        border: 'var(--brand-200)',
        color: 'var(--brand-text)',
        text: `${bestSavingsMonth.name} had your best savings rate — ${((bestSavingsMonth.savings / bestSavingsMonth.income) * 100).toFixed(1)}% of income saved.`,
      });
    }
    if (incomeMonths.length > 0) {
      insights.push({
        Icon: Target,
        bg: 'var(--brand-50)',
        border: 'var(--brand-200)',
        color: 'var(--brand-text)',
        text: `${targetHitCount} of ${incomeMonths.length} months hit your ${savingsTarget}% savings target.`,
      });
    }
    if (spendRows.length > 0) {
      const top = spendRows[0];
      insights.push({
        Icon: PieChart,
        bg: 'var(--amber-50)',
        border: 'var(--amber-200)',
        color: 'var(--warning-text)',
        text: `${top.icon} ${top.name} was ${top.share.toFixed(1)}% of your spending.`,
      });
    }
    if (spendRows.length >= 2) {
      const n = Math.min(3, spendRows.length);
      const combined = spendRows.slice(0, n).reduce((s, r) => s + r.share, 0);
      insights.push({
        Icon: Layers,
        bg: 'var(--purple-50)',
        border: 'var(--purple-200)',
        color: 'var(--purple-text)',
        text: `Your top ${n} categories combined were ${combined.toFixed(1)}% of spending.`,
      });
    }

    const yoyRows = categoryRows.filter((r) => r.lastTotal > 0 && r.yoyPct !== null);
    const biggestIncrease = yoyRows.length
      ? yoyRows.reduce((a, b) => ((b.yoyPct ?? 0) > (a.yoyPct ?? 0) ? b : a))
      : null;
    const biggestDecrease = yoyRows.length
      ? yoyRows.reduce((a, b) => ((b.yoyPct ?? 0) < (a.yoyPct ?? 0) ? b : a))
      : null;
    if (biggestIncrease && (biggestIncrease.yoyPct ?? 0) > 0) {
      insights.push({
        Icon: TrendingUp,
        bg: 'var(--red-50)',
        border: 'var(--red-200)',
        color: 'var(--danger-text)',
        text: `${biggestIncrease.icon} ${biggestIncrease.name} rose ${(biggestIncrease.yoyPct ?? 0).toFixed(1)}% vs ${compareLabel} (+${formatCurrency(biggestIncrease.total - biggestIncrease.lastTotal, currency)}).`,
      });
    }
    if (biggestDecrease && (biggestDecrease.yoyPct ?? 0) < 0) {
      insights.push({
        Icon: TrendingDown,
        bg: 'var(--green-50)',
        border: 'var(--green-200)',
        color: 'var(--success-text)',
        text: `${biggestDecrease.icon} ${biggestDecrease.name} fell ${Math.abs(biggestDecrease.yoyPct ?? 0).toFixed(1)}% vs ${compareLabel} (−${formatCurrency(biggestDecrease.lastTotal - biggestDecrease.total, currency)}).`,
      });
    }

    const activeIdxs = monthlyData
      .map((m, i) => ({ m, i }))
      .filter((x) => x.m.expense > 0)
      .map((x) => x.i);
    if (activeIdxs.length >= 4) {
      const half = Math.floor(activeIdxs.length / 2);
      const first = activeIdxs.slice(0, half);
      const second = activeIdxs.slice(activeIdxs.length - half);
      const avg1 = first.reduce((s, i) => s + monthlyData[i].expense, 0) / first.length;
      const avg2 = second.reduce((s, i) => s + monthlyData[i].expense, 0) / second.length;
      if (avg1 > 0) {
        const pct = ((avg2 - avg1) / avg1) * 100;
        const rising = pct >= 0;
        insights.push({
          Icon: Activity,
          bg: rising ? 'var(--amber-50)' : 'var(--green-50)',
          border: rising ? 'var(--amber-200)' : 'var(--green-200)',
          color: rising ? 'var(--warning-text)' : 'var(--success-text)',
          text: `Spending is ${rising ? 'rising' : 'falling'} — recent active months average ${Math.abs(pct).toFixed(1)}% ${rising ? 'more' : 'less'} than earlier ones.`,
        });
      }
    }

    if (year === currentYear && elapsed > 0 && totalIncome > 0) {
      const projectedIncome = (totalIncome / elapsed) * 12;
      const projectedYearEndSavings = projectedIncome - projectedSpend;
      insights.push({
        Icon: Sparkles,
        bg: projectedYearEndSavings >= 0 ? 'var(--green-50)' : 'var(--red-50)',
        border: projectedYearEndSavings >= 0 ? 'var(--green-200)' : 'var(--red-200)',
        color: projectedYearEndSavings >= 0 ? 'var(--success-text)' : 'var(--danger-text)',
        text:
          projectedYearEndSavings >= 0
            ? `At this pace you could save about ${formatCurrency(projectedYearEndSavings, currency)} by year end.`
            : `At this pace you may overspend your income by ${formatCurrency(Math.abs(projectedYearEndSavings), currency)} this year.`,
      });
    }

    return {
      currentYear,
      currentMonthIdx,
      elapsed,
      yearExpenses,
      yearIncome,
      totalSpent,
      totalIncome,
      totalSavings,
      savingsRate,
      prevSpent,
      prevIncomeTotal,
      prevSavings,
      prevRate,
      compareLabel,
      monthlyData,
      activeExpenseMonths,
      activeIncomeMonths,
      activeMonths,
      maxBar,
      categoryRows,
      heatmapRows,
      maxCell,
      incomeSources,
      avgMonthlySpend,
      avgMonthlyIncome,
      txnsPerMonth,
      projectedSpend,
      highestMonth,
      insights,
      isEmpty: yearExpenses.length === 0 && yearIncome.length === 0,
    };
  }, [expenses, income, categories, year, savingsTarget, currency]);

  const sortedRows = useMemo(() => {
    const rows = [...data.categoryRows];
    if (sortKey === 'name') rows.sort((a, b) => a.name.localeCompare(b.name));
    else if (sortKey === 'yoy')
      rows.sort((a, b) => {
        if (a.yoyPct === null && b.yoyPct === null) return b.total - a.total;
        if (a.yoyPct === null) return -1;
        if (b.yoyPct === null) return 1;
        return b.yoyPct - a.yoyPct;
      });
    else rows.sort((a, b) => b.total - a.total);
    return rows;
  }, [data.categoryRows, sortKey]);

  const yearIdx = availableYears.indexOf(year);
  const canPrev = yearIdx > 0;
  const canNext = yearIdx >= 0 && yearIdx < availableYears.length - 1;

  const {
    currentYear,
    currentMonthIdx,
    elapsed,
    yearExpenses,
    totalSpent,
    totalIncome,
    totalSavings,
    savingsRate,
    prevSpent,
    prevIncomeTotal,
    prevSavings,
    prevRate,
    compareLabel,
    monthlyData,
    activeExpenseMonths,
    activeIncomeMonths,
    activeMonths,
    maxBar,
    heatmapRows,
    maxCell,
    incomeSources,
    avgMonthlySpend,
    avgMonthlyIncome,
    txnsPerMonth,
    projectedSpend,
    highestMonth,
    insights,
    isEmpty,
  } = data;

  // YoY sub-lines (previous year must have a comparable value)
  const incomeYoY = prevIncomeTotal > 0 ? ((totalIncome - prevIncomeTotal) / prevIncomeTotal) * 100 : null;
  const spentYoY = prevSpent > 0 ? ((totalSpent - prevSpent) / prevSpent) * 100 : null;
  const savingsYoY = prevSavings !== 0 ? ((totalSavings - prevSavings) / Math.abs(prevSavings)) * 100 : null;
  const rateDiff = prevIncomeTotal > 0 ? savingsRate - prevRate : null;

  const renderYoY = (pct: number | null, goodWhenUp: boolean) => {
    if (pct === null) return null;
    const up = pct >= 0;
    const good = up === goodWhenUp;
    return (
      <p className="num-mono mt-1" style={{ fontSize: '0.6875rem', fontWeight: 700, color: good ? 'var(--success-text)' : 'var(--danger-text)' }}>
        {up ? '▲' : '▼'} {Math.abs(pct).toFixed(1)}% vs {compareLabel}
      </p>
    );
  };

  const subtitle =
    year === currentYear
      ? `Jan – ${MONTH_NAMES[currentMonthIdx]} ${year} · ${elapsed} of 12 months (year in progress)`
      : `Full year · ${activeMonths} active months`;

  const isCurrentYear = year === currentYear;
  const rateOnTarget = savingsRate >= savingsTarget;

  // ── Running balance (derived ledger) ──────────────────────────────────────
  const yearBalance = getYearBalance(ledger, year);
  const monthBalanceAt = (idx: number) => yearBalance?.months[idx] ?? null;

  const trendPoints = useMemo(() => {
    if (!yearBalance) return [];
    const pts: { name: string; balance: number; mb?: typeof yearBalance.months[number] }[] = [
      { name: 'Opening', balance: yearBalance.opening },
    ];
    for (const m of yearBalance.months) {
      if (m.beforeBaseline || m.isFuture || m.closing === null) continue;
      pts.push({ name: m.label.slice(0, 3), balance: m.closing, mb: m });
    }
    pts.push({ name: 'Closing', balance: yearBalance.closing });
    return pts;
  }, [yearBalance]);

  const BalanceTooltip = ({ active, label, payload }: {
    active?: boolean; label?: string;
    payload?: { payload?: { mb?: { opening: number | null; income: number; expenses: number; closing: number | null } }; value?: number }[];
  }) => {
    if (!active || !payload?.length) return null;
    const mb = payload[0].payload?.mb;
    return (
      <div style={{
        background: chartTheme.tooltipBg, border: `1px solid ${chartTheme.tooltipBorder}`,
        borderRadius: 8, padding: '8px 12px', fontSize: '0.72rem', minWidth: 150,
      }}>
        <div style={{ fontWeight: 700, color: chartTheme.tooltipText, marginBottom: 4 }}>{label}</div>
        {mb ? (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 14, color: chartTheme.textMuted }}>
              <span>Opening</span><span className="num-mono" style={{ color: chartTheme.tooltipText }}>{formatCurrency(mb.opening ?? 0, currency)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 14, color: chartTheme.textMuted }}>
              <span>+ Income</span><span className="num-mono" style={{ color: 'var(--success-text)' }}>+{formatCurrency(mb.income, currency)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 14, color: chartTheme.textMuted }}>
              <span>− Expenses</span><span className="num-mono" style={{ color: 'var(--danger-text)' }}>−{formatCurrency(mb.expenses, currency)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 14, fontWeight: 800, color: chartTheme.tooltipText, borderTop: `1px solid ${chartTheme.tooltipBorder}`, marginTop: 4, paddingTop: 4 }}>
              <span>Closing</span><span className="num-mono">{formatCurrency(mb.closing ?? 0, currency)}</span>
            </div>
          </>
        ) : (
          <div style={{ fontWeight: 800, color: chartTheme.tooltipText }} className="num-mono">
            {formatCurrency(payload[0].value ?? 0, currency)}
          </div>
        )}
      </div>
    );
  };

  const balanceSection = openingBalance === null ? (
    /* ── No baseline: CTA ── */
    <div className="rounded-xl p-4 mb-6" style={{ background: 'var(--brand-50)', border: '1px solid var(--brand-200)', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
      <Wallet size={18} style={{ color: 'var(--brand-text)', flexShrink: 0 }} />
      <span style={{ flex: 1, minWidth: 180, fontSize: '0.8125rem', color: 'var(--text-700)' }}>
        Track your running balance — set an opening balance
      </span>
      <button
        onClick={() => setBalanceModal(true)}
        style={{ padding: '7px 14px', borderRadius: 'var(--r-sm)', border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.8125rem', fontWeight: 700, background: 'var(--brand-600)', color: '#fff' }}
      >
        Set opening balance
      </button>
    </div>
  ) : !yearBalance ? (
    /* ── Before startYear ── */
    <div className="rounded-xl p-4 mb-6" style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border-default)', fontSize: '0.8125rem', color: 'var(--text-500)' }}>
      Before your opening balance (set from {openingBalance.startYear}).{' '}
      <button onClick={() => setBalanceModal(true)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.8125rem', fontWeight: 700, color: 'var(--brand-text)', padding: 0 }}>
        Edit baseline
      </button>
    </div>
  ) : (
    /* ── Statement + trend + YoY table ── */
    <div className="mb-6">
      <div className="rounded-xl p-4 md:p-5" style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border-default)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
          <span className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text-500)' }}>
            Balance
          </span>
          <button
            onClick={() => setBalanceModal(true)}
            className="flex items-center gap-1"
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.75rem', fontWeight: 700, color: 'var(--brand-text)', padding: '2px 4px' }}
          >
            Edit
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16 }}>
          {/* Statement */}
          <div className="num-mono" style={{ fontSize: '0.85rem' }}>
            {[
              { l: 'Opening balance', v: yearBalance.opening, sub: year > openingBalance.startYear ? `Carried forward from ${year - 1}` : 'Baseline' },
              { l: '+ Total income', v: yearBalance.income },
              yearBalance.reserveExpenses > 0
                ? { l: '− Regular expenses', v: -yearBalance.regularExpenses, sub: 'monthly budget' }
                : { l: '− Total expenses', v: -yearBalance.expenses },
              ...(yearBalance.reserveExpenses > 0
                ? [{ l: '− Reserve expenses', v: -yearBalance.reserveExpenses, sub: 'paid from reserve' }]
                : []),
            ].map((r, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '5px 0', color: 'var(--text-700)' }}>
                <span>
                  {r.l}
                  {'sub' in r && r.sub && <span style={{ display: 'block', fontSize: '0.625rem', fontFamily: 'inherit', color: 'var(--text-400)' }}>{r.sub}</span>}
                </span>
                <span style={{ fontWeight: 700 }}>{formatCurrency(r.v, currency)}</span>
              </div>
            ))}
            {yearBalance.reserveExpenses > 0 && (
              <div style={{ textAlign: 'right', fontSize: '0.68rem', color: 'var(--text-400)', marginTop: 2 }}>
                Total actual expenses: {formatCurrency(yearBalance.expenses, currency)}
              </div>
            )}
            {(yearBalance.reserveIn > 0 || yearBalance.reserveOut > 0) && (
              <p style={{ fontSize: '0.72rem', color: 'var(--text-400)', marginTop: 8, fontFamily: 'inherit' }}>
                Allocations (not income/expense): +{formatCurrency(yearBalance.reserveIn, currency)} to reserve, −{formatCurrency(yearBalance.reserveOut, currency)} released.
              </p>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '7px 0 2px', borderTop: '2px solid var(--border-strong)', color: 'var(--text-900)' }}>
              <span style={{ fontWeight: 800 }}>
                Closing balance{isCurrentYear ? ' (to date)' : ''}
              </span>
              <span style={{ fontWeight: 800, fontSize: '1rem', color: yearBalance.closing < 0 ? 'var(--danger-text)' : 'var(--text-900)' }}>
                {formatCurrency(yearBalance.closing, currency)}
              </span>
            </div>
            {yearBalance.opening !== 0 && (
              <div style={{ textAlign: 'right', fontSize: '0.72rem', marginTop: 2, color: yearBalance.net >= 0 ? 'var(--success-text)' : 'var(--danger-text)', fontWeight: 700 }}>
                {yearBalance.net >= 0 ? '+' : '−'}{formatCurrency(Math.abs(yearBalance.net), currency)} this year
                {' '}({((yearBalance.net / Math.abs(yearBalance.opening)) * 100).toFixed(1)}% of opening)
              </div>
            )}
            {yearBalance.excludedBeforeEffective.count > 0 && (
              <p style={{ fontSize: '0.72rem', color: 'var(--text-400)', marginTop: 10, fontFamily: 'inherit' }}>
                {yearBalance.excludedBeforeEffective.count} transaction{yearBalance.excludedBeforeEffective.count === 1 ? '' : 's'} before {openingBalance.effectiveDate} aren&apos;t included in the balance
                (income {formatCurrency(yearBalance.excludedBeforeEffective.income, currency)}, expenses {formatCurrency(yearBalance.excludedBeforeEffective.expenses, currency)}).
              </p>
            )}
          </div>

          {/* Balance trend */}
          <div role="img" aria-label={`Running balance trend for ${year}: opens at ${formatCurrency(yearBalance.opening, currency)} and closes at ${formatCurrency(yearBalance.closing, currency)}`} style={{ height: 190, minWidth: 0 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trendPoints} margin={{ top: 8, right: 8, left: -14, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.grid} vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 9, fill: chartTheme.axis }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 9, fill: chartTheme.axis }} tickLine={false} axisLine={false} />
                <Tooltip content={<BalanceTooltip />} />
                {trendPoints.some(p => p.balance < 0) && (
                  <ReferenceLine y={0} stroke={chartTheme.expenses} strokeDasharray="4 3" />
                )}
                <Area type="monotone" dataKey="balance" name="Balance" stroke={chartTheme.savings} strokeWidth={2}
                  fill={chartTheme.savings} fillOpacity={0.12} dot={{ r: 2, fill: chartTheme.savings }} />
              </AreaChart>
            </ResponsiveContainer>
            <span className="sr-only">
              {yearBalance.months.filter(m => !m.beforeBaseline && !m.isFuture).map(m => `${m.label} closes at ${Math.round(m.closing ?? 0)}`).join('; ')}.
            </span>
          </div>
        </div>
      </div>

      {/* Year-over-year balance */}
      {ledger.length > 1 && (
        <div className="mt-3">
          <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--text-400)' }}>
            Year-over-year balance
          </p>
          <div style={{ overflowX: 'auto' }}>
            <div role="table" aria-label="Year-over-year balance" style={{ minWidth: 560 }}>
              <div role="row" style={{ display: 'grid', gridTemplateColumns: '70px 1fr 1fr 1fr 1fr 1fr', gap: 8, padding: '6px 10px', fontSize: '0.625rem', fontWeight: 800, color: 'var(--text-400)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                <span role="columnheader">Year</span>
                <span role="columnheader" style={{ textAlign: 'right' }}>Opening</span>
                <span role="columnheader" style={{ textAlign: 'right' }}>Income</span>
                <span role="columnheader" style={{ textAlign: 'right' }}>Expenses</span>
                <span role="columnheader" style={{ textAlign: 'right' }}>Net</span>
                <span role="columnheader" style={{ textAlign: 'right' }}>Closing</span>
              </div>
              {ledger.map(yb => {
                const sel = yb.year === year;
                return (
                  <button
                    key={yb.year}
                    role="row"
                    aria-current={sel || undefined}
                    onClick={() => setYear(yb.year)}
                    className="w-full text-left rounded-lg num-mono"
                    style={{
                      display: 'grid', gridTemplateColumns: '70px 1fr 1fr 1fr 1fr 1fr', gap: 8,
                      padding: '8px 10px', border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                      fontSize: '0.8125rem',
                      background: sel ? 'var(--brand-50)' : 'transparent',
                      color: 'var(--text-700)',
                      outline: sel ? '1.5px solid var(--brand-300)' : 'none',
                    }}
                  >
                    <span role="cell" style={{ fontWeight: sel ? 800 : 600 }}>{yb.year}</span>
                    <span role="cell" style={{ textAlign: 'right' }}>{formatCurrency(yb.opening, currency)}</span>
                    <span role="cell" style={{ textAlign: 'right', color: 'var(--success-text)' }}>{formatCurrency(yb.income, currency)}</span>
                    <span role="cell" style={{ textAlign: 'right', color: 'var(--danger-text)' }}>{formatCurrency(yb.expenses, currency)}</span>
                    <span role="cell" style={{ textAlign: 'right', color: yb.net >= 0 ? 'var(--success-text)' : 'var(--danger-text)' }}>
                      {yb.net >= 0 ? '+' : '−'}{formatCurrency(Math.abs(yb.net), currency)}
                    </span>
                    <span role="cell" style={{ textAlign: 'right', fontWeight: 800, color: yb.closing < 0 ? 'var(--danger-text)' : 'var(--text-900)' }}>
                      {formatCurrency(yb.closing, currency)}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
          <p style={{ fontSize: '0.68rem', color: 'var(--text-300)', marginTop: 6 }}>
            Each year&apos;s opening = previous year&apos;s closing.
          </p>
        </div>
      )}
    </div>
  );

  const header = (
    <>
      <div className="flex items-center gap-3">
        <div className="w-1 h-7 rounded-full" style={{ background: 'linear-gradient(180deg, #6366f1, #4f46e5)' }} />
        <h2 className="graffiti-font text-3xl" style={{ color: 'var(--text-800)' }}>YEARLY OVERVIEW</h2>
        <div className="ml-auto flex items-center gap-1">
          <button
            onClick={() => canPrev && setYear(availableYears[yearIdx - 1])}
            disabled={!canPrev}
            aria-label="Previous year"
            className="w-7 h-7 rounded-full flex items-center justify-center transition-colors"
            style={{
              background: canPrev ? 'var(--brand-50)' : 'var(--bg-subtle)',
              color: canPrev ? 'var(--brand-text)' : 'var(--text-300)',
              cursor: canPrev ? 'pointer' : 'default',
            }}
          >
            <ChevronLeft size={15} />
          </button>
          <span
            className="text-sm font-bold px-3 py-1 rounded-full num-mono"
            style={{ background: 'var(--brand-50)', color: 'var(--brand-text)', minWidth: 64, textAlign: 'center' }}
          >
            {year}
          </span>
          <button
            onClick={() => canNext && setYear(availableYears[yearIdx + 1])}
            disabled={!canNext}
            aria-label="Next year"
            className="w-7 h-7 rounded-full flex items-center justify-center transition-colors"
            style={{
              background: canNext ? 'var(--brand-50)' : 'var(--bg-subtle)',
              color: canNext ? 'var(--brand-text)' : 'var(--text-300)',
              cursor: canNext ? 'pointer' : 'default',
            }}
          >
            <ChevronRight size={15} />
          </button>
        </div>
      </div>
      <p className="text-xs mb-6 mt-1.5" style={{ color: 'var(--text-400)', paddingLeft: 16 }}>
        {subtitle}
      </p>
    </>
  );

  if (isEmpty) {
    return (
      <div className="dark-card p-7" style={{ border: '1px solid rgba(99,102,241,0.15)' }}>
        {header}
        {balanceSection}
        <p className="text-center py-8 text-sm" style={{ color: 'var(--text-400)' }}>
          No data for {year}
        </p>
        {balanceModal && <OpeningBalanceModal onClose={() => setBalanceModal(false)} />}
      </div>
    );
  }

  return (
    <div className="dark-card p-7" style={{ border: '1px solid rgba(99,102,241,0.15)' }}>
      {header}

      {/* ── Balance ── */}
      {balanceSection}

      {/* ── Top Stats Row ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
        <div className="rounded-xl p-4" style={{ background: 'var(--green-50)', border: '1px solid var(--green-100)' }}>
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp size={14} color="var(--success-text)" />
            <span className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--success-text)' }}>Total Income</span>
          </div>
          <p className="text-xl font-bold num-mono" style={{ color: 'var(--success-text)' }}>{formatCurrency(totalIncome, currency)}</p>
          {renderYoY(incomeYoY, true)}
        </div>
        <div className="rounded-xl p-4" style={{ background: 'var(--red-50)', border: '1px solid var(--red-200)' }}>
          <div className="flex items-center gap-2 mb-2">
            <TrendingDown size={14} color="var(--danger-text)" />
            <span className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--danger-text)' }}>Total Spent</span>
          </div>
          <p className="text-xl font-bold num-mono" style={{ color: 'var(--danger-text)' }}>{formatCurrency(totalSpent, currency)}</p>
          {renderYoY(spentYoY, false)}
        </div>
        <div
          className="rounded-xl p-4"
          style={{
            background: totalSavings >= 0 ? 'var(--green-50)' : 'var(--red-50)',
            border: `1px solid ${totalSavings >= 0 ? 'var(--green-200)' : 'var(--red-200)'}`,
          }}
        >
          <div className="flex items-center gap-2 mb-2">
            <PiggyBank size={14} color={totalSavings >= 0 ? 'var(--success-text)' : 'var(--danger-text)'} />
            <span
              className="text-xs font-bold uppercase tracking-wider"
              style={{ color: totalSavings >= 0 ? 'var(--success-text)' : 'var(--danger-text)' }}
            >
              Total Savings
            </span>
          </div>
          <p className="text-xl font-bold num-mono" style={{ color: totalSavings >= 0 ? 'var(--success-text)' : 'var(--danger-text)' }}>
            {totalSavings >= 0 ? '+' : ''}
            {formatCurrency(totalSavings, currency)}
          </p>
          {renderYoY(savingsYoY, true)}
        </div>
        <div className="rounded-xl p-4" style={{ background: 'var(--brand-50)', border: '1px solid var(--brand-200)' }}>
          <div className="flex items-center gap-2 mb-2">
            <Calendar size={14} color="var(--brand-text)" />
            <span className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--brand-text)' }}>Savings Rate</span>
          </div>
          <p className="text-xl font-bold num-mono" style={{ color: rateOnTarget ? 'var(--success-text)' : 'var(--warning-text)' }}>
            {savingsRate.toFixed(1)}%
          </p>
          <p className="num-mono mt-1" style={{ fontSize: '0.6875rem', fontWeight: 700, color: 'var(--text-500)' }}>
            Target {savingsTarget}%
          </p>
          {rateDiff !== null && (
            <p
              className="num-mono"
              style={{ fontSize: '0.6875rem', fontWeight: 700, color: rateDiff >= 0 ? 'var(--success-text)' : 'var(--danger-text)' }}
            >
              {rateDiff >= 0 ? '+' : '−'}
              {Math.abs(rateDiff).toFixed(1)} pts vs {compareLabel}
            </p>
          )}
        </div>
      </div>

      {/* ── Secondary Stats Row ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="rounded-xl p-3" style={{ background: 'var(--bg-subtle)', border: '1px solid var(--bg-muted)' }}>
          <div className="flex items-center gap-2 mb-1.5">
            <BarChart3 size={13} color="var(--text-500)" />
            <span style={{ fontSize: '0.6875rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-500)' }}>
              Avg Monthly Spend
            </span>
          </div>
          <p className="text-base font-bold num-mono" style={{ color: 'var(--text-800)' }}>
            {formatCurrency(avgMonthlySpend, currency)}
          </p>
          <p style={{ fontSize: '0.6875rem', color: 'var(--text-400)' }}>
            across {activeExpenseMonths} month{activeExpenseMonths === 1 ? '' : 's'}
          </p>
        </div>
        <div className="rounded-xl p-3" style={{ background: 'var(--bg-subtle)', border: '1px solid var(--bg-muted)' }}>
          <div className="flex items-center gap-2 mb-1.5">
            <Wallet size={13} color="var(--text-500)" />
            <span style={{ fontSize: '0.6875rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-500)' }}>
              Avg Monthly Income
            </span>
          </div>
          <p className="text-base font-bold num-mono" style={{ color: 'var(--text-800)' }}>
            {formatCurrency(avgMonthlyIncome, currency)}
          </p>
          <p style={{ fontSize: '0.6875rem', color: 'var(--text-400)' }}>
            across {activeIncomeMonths} month{activeIncomeMonths === 1 ? '' : 's'}
          </p>
        </div>
        <div className="rounded-xl p-3" style={{ background: 'var(--bg-subtle)', border: '1px solid var(--bg-muted)' }}>
          <div className="flex items-center gap-2 mb-1.5">
            <Receipt size={13} color="var(--text-500)" />
            <span style={{ fontSize: '0.6875rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-500)' }}>
              Transactions
            </span>
          </div>
          <p className="text-base font-bold num-mono" style={{ color: 'var(--text-800)' }}>{yearExpenses.length}</p>
          <p style={{ fontSize: '0.6875rem', color: 'var(--text-400)' }}>
            {txnsPerMonth.toFixed(1)}/month avg
          </p>
        </div>
        <div className="rounded-xl p-3" style={{ background: 'var(--bg-subtle)', border: '1px solid var(--bg-muted)' }}>
          {isCurrentYear && elapsed > 0 ? (
            <>
              <div className="flex items-center gap-2 mb-1.5">
                <Sparkles size={13} color="var(--brand-text)" />
                <span style={{ fontSize: '0.6875rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--brand-text)' }}>
                  Projected Year-End Spend
                </span>
              </div>
              <p className="text-base font-bold num-mono" style={{ color: 'var(--brand-text)' }}>
                {formatCurrency(projectedSpend, currency)}
              </p>
              <p style={{ fontSize: '0.6875rem', color: 'var(--text-400)' }}>at current pace</p>
            </>
          ) : (
            <>
              <div className="flex items-center gap-2 mb-1.5">
                <Flame size={13} color="var(--warning-text)" />
                <span style={{ fontSize: '0.6875rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--warning-text)' }}>
                  Highest Month
                </span>
              </div>
              <p className="text-base font-bold num-mono" style={{ color: 'var(--warning-text)' }}>
                {highestMonth ? formatCurrency(highestMonth.expense, currency) : '—'}
              </p>
              <p style={{ fontSize: '0.6875rem', color: 'var(--text-400)' }}>
                {highestMonth ? `${highestMonth.name} ${year}` : 'No expenses'}
              </p>
            </>
          )}
        </div>
      </div>

      {/* ── Category Breakdown ── */}
      <div className="mb-6">
        <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
          <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-400)' }}>
            Category Breakdown · {data.categoryRows.length}{' '}
            {data.categoryRows.length === 1 ? 'category' : 'categories'}
          </p>
          <div className="flex items-center gap-1 rounded-full p-0.5" style={{ background: 'var(--bg-muted)' }}>
            {(
              [
                ['amount', 'Amount'],
                ['yoy', 'YoY change'],
                ['name', 'Name'],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setSortKey(key)}
                className="rounded-full font-semibold"
                style={{
                  fontSize: '0.6875rem',
                  padding: '4px 10px',
                  background: sortKey === key ? 'var(--bg-surface)' : 'transparent',
                  color: sortKey === key ? 'var(--brand-text)' : 'var(--text-500)',
                  boxShadow: sortKey === key ? '0 1px 2px rgba(15,23,42,0.08)' : 'none',
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {data.categoryRows.length === 0 ? (
          <p className="text-center py-4 text-sm" style={{ color: 'var(--text-400)' }}>
            No expenses recorded for {year}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <div style={{ minWidth: 880 }}>
              {/* Header */}
              <div
                className="px-2 pb-2"
                style={{
                  display: 'grid',
                  gridTemplateColumns: BREAKDOWN_GRID,
                  columnGap: 8,
                  alignItems: 'center',
                }}
              >
                {['Category', 'Yearly Total', 'Share', 'Monthly Avg', isCurrentYear ? compareLabel : 'Last Year', 'YoY', 'Txns', 'Peak'].map(
                  (h, i) => (
                    <span
                      key={h}
                      style={{
                        fontSize: '0.625rem',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        letterSpacing: '0.06em',
                        color: 'var(--text-400)',
                        textAlign: i === 0 ? 'left' : 'right',
                      }}
                    >
                      {h}
                    </span>
                  )
                )}
              </div>

              {/* Rows */}
              {sortedRows.map((row) => {
                const open = expandedCat === row.key;
                const catMax = Math.max(...row.monthly);
                const yoy =
                  row.total === 0
                    ? { text: '−100%', color: 'var(--success-text)' }
                    : row.yoyPct === null
                      ? { text: 'New', color: 'var(--brand-text)' }
                      : row.yoyPct >= 0
                        ? { text: `▲ ${row.yoyPct.toFixed(1)}%`, color: 'var(--danger-text)' }
                        : { text: `▼ ${Math.abs(row.yoyPct).toFixed(1)}%`, color: 'var(--success-text)' };
                return (
                  <div key={row.key} style={{ borderTop: '1px solid var(--bg-muted)' }}>
                    <button
                      onClick={() => setExpandedCat(open ? null : row.key)}
                      className="w-full text-left px-2 py-2.5 hover:bg-slate-50 transition-colors"
                      style={{
                        display: 'grid',
                        gridTemplateColumns: BREAKDOWN_GRID,
                        columnGap: 8,
                        alignItems: 'center',
                      }}
                    >
                      <span className="flex items-center gap-2 min-w-0">
                        <span style={{ fontSize: 14, flexShrink: 0 }}>{row.icon}</span>
                        <span className="text-xs font-bold truncate" style={{ color: 'var(--text-700)' }}>
                          {row.name}
                        </span>
                        <ChevronDown
                          size={12}
                          style={{
                            color: 'var(--text-300)',
                            flexShrink: 0,
                            transform: open ? 'rotate(180deg)' : 'none',
                            transition: 'transform 0.2s',
                          }}
                        />
                      </span>
                      <span className="text-xs font-bold num-mono text-right" style={{ color: 'var(--text-800)' }}>
                        {formatCurrency(row.total, currency)}
                      </span>
                      <span>
                        <span
                          className="block text-right num-mono mb-1"
                          style={{ fontSize: '0.6875rem', color: 'var(--text-500)' }}
                        >
                          {row.share.toFixed(1)}%
                        </span>
                        <span className="block w-full rounded-full h-1.5" style={{ background: 'var(--bg-muted)' }}>
                          <span
                            className="block h-1.5 rounded-full"
                            style={{ width: `${Math.min(100, row.share)}%`, background: row.color }}
                          />
                        </span>
                      </span>
                      <span className="text-xs num-mono text-right" style={{ color: 'var(--text-600)' }}>
                        {formatCurrency(row.monthlyAvg, currency)}
                      </span>
                      <span className="text-xs num-mono text-right" style={{ color: 'var(--text-400)' }}>
                        {row.lastTotal > 0 ? formatCurrency(row.lastTotal, currency) : '—'}
                      </span>
                      <span
                        className="num-mono text-right"
                        style={{ fontSize: '0.6875rem', fontWeight: 700, color: yoy.color }}
                      >
                        {yoy.text}
                      </span>
                      <span className="text-xs num-mono text-right" style={{ color: 'var(--text-500)' }}>
                        {row.txns}
                      </span>
                      <span className="text-xs text-right" style={{ color: 'var(--text-500)' }}>
                        {row.peakIdx >= 0 ? MONTH_NAMES[row.peakIdx] : '—'}
                      </span>
                    </button>

                    {open && (
                      <div
                        className="grid md:grid-cols-2 gap-4 px-3 py-3"
                        style={{ background: 'var(--bg-subtle)', borderTop: '1px dashed var(--border-default)' }}
                      >
                        <div>
                          <p
                            className="font-bold uppercase tracking-wider mb-2"
                            style={{ fontSize: '0.625rem', color: 'var(--text-400)' }}
                          >
                            Monthly spend
                          </p>
                          <div className="flex items-end gap-1" style={{ height: 48 }}>
                            {row.monthly.map((v, mi) => {
                              const isFuture =
                                year > currentYear || (year === currentYear && mi > currentMonthIdx);
                              return (
                                <div
                                  key={mi}
                                  className="flex-1"
                                  title={`${MONTH_NAMES[mi]}: ${formatCurrency(v, currency)}`}
                                  style={{
                                    height:
                                      v > 0 && catMax > 0 ? `${Math.max(8, (v / catMax) * 100)}%` : 4,
                                    borderRadius: 3,
                                    background: v > 0 ? (isFuture ? 'var(--border-strong)' : row.color) : 'var(--bg-muted)',
                                  }}
                                />
                              );
                            })}
                          </div>
                          <div className="flex gap-1 mt-1">
                            {MONTH_NAMES.map((m, mi) => {
                              const isFuture =
                                year > currentYear || (year === currentYear && mi > currentMonthIdx);
                              return (
                                <span
                                  key={m}
                                  className="flex-1 text-center"
                                  style={{ fontSize: '0.5625rem', color: isFuture ? 'var(--text-300)' : 'var(--text-400)' }}
                                >
                                  {m}
                                </span>
                              );
                            })}
                          </div>
                        </div>
                        <div>
                          <p
                            className="font-bold uppercase tracking-wider mb-2"
                            style={{ fontSize: '0.625rem', color: 'var(--text-400)' }}
                          >
                            Top transactions
                          </p>
                          {row.top.length === 0 ? (
                            <p className="text-xs" style={{ color: 'var(--text-400)' }}>
                              No transactions this year
                            </p>
                          ) : (
                            <div className="space-y-1.5">
                              {row.top.map((t) => (
                                <div key={t.id} className="flex items-center justify-between gap-3 text-xs">
                                  <span className="truncate" style={{ color: 'var(--text-600)' }}>
                                    {t.description || 'Expense'} ·{' '}
                                    {new Date(t.date + 'T12:00:00').toLocaleDateString('en-IN', {
                                      day: 'numeric',
                                      month: 'short',
                                    })}
                                  </span>
                                  <span className="num-mono font-semibold" style={{ color: 'var(--text-700)' }}>
                                    {formatCurrency(t.amount, currency)}
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Footer total */}
              <div
                className="px-2 py-2.5"
                style={{
                  display: 'grid',
                  gridTemplateColumns: BREAKDOWN_GRID,
                  columnGap: 8,
                  alignItems: 'center',
                  borderTop: '2px solid var(--border-default)',
                }}
              >
                <span className="text-xs font-bold" style={{ color: 'var(--text-800)' }}>
                  Total
                </span>
                <span className="text-xs font-bold num-mono text-right" style={{ color: 'var(--text-800)' }}>
                  {formatCurrency(totalSpent, currency)}
                </span>
                <span>
                  <span
                    className="block text-right num-mono mb-1"
                    style={{ fontSize: '0.6875rem', fontWeight: 700, color: 'var(--text-700)' }}
                  >
                    100%
                  </span>
                  <span className="block w-full rounded-full h-1.5" style={{ background: 'var(--bg-muted)' }}>
                    <span className="block h-1.5 rounded-full" style={{ width: '100%', background: '#6366f1' }} />
                  </span>
                </span>
                <span className="text-xs font-bold num-mono text-right" style={{ color: 'var(--text-700)' }}>
                  {formatCurrency(data.categoryRows.reduce((s, r) => s + r.monthlyAvg, 0), currency)}
                </span>
                <span className="text-xs font-bold num-mono text-right" style={{ color: 'var(--text-400)' }}>
                  {prevSpent > 0 ? formatCurrency(prevSpent, currency) : '—'}
                </span>
                <span />
                <span className="text-xs font-bold num-mono text-right" style={{ color: 'var(--text-700)' }}>
                  {yearExpenses.length}
                </span>
                <span />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Category × Month Heatmap (collapsible) ── */}
      {heatmapRows.length > 0 && (
        <div className="mb-6">
          <button
            onClick={() => setShowHeatmap(!showHeatmap)}
            className="flex items-center justify-between w-full py-3 px-1"
          >
            <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-400)' }}>
              Category × Month Heatmap
            </p>
            <ChevronDown
              size={18}
              style={{ color: 'var(--text-400)' }}
              className={`transition-transform duration-300 ${showHeatmap ? 'rotate-180' : ''}`}
            />
          </button>
          {showHeatmap && (
            <div className="overflow-x-auto mt-1">
              <div style={{ minWidth: 920 }}>
                <div style={{ display: 'grid', gridTemplateColumns: HEATMAP_GRID, gap: 2 }}>
                  <div />
                  {MONTH_NAMES.map((m) => (
                    <div
                      key={m}
                      className="text-center"
                      style={{
                        fontSize: '0.625rem',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        color: 'var(--text-400)',
                        padding: '4px 0',
                      }}
                    >
                      {m}
                    </div>
                  ))}
                  <div
                    className="text-center"
                    style={{
                      fontSize: '0.625rem',
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      color: 'var(--text-400)',
                      padding: '4px 0',
                    }}
                  >
                    Total
                  </div>

                  {heatmapRows.map((r) => (
                    <Fragment key={r.key}>
                      <div
                        className="flex items-center gap-1.5 min-w-0"
                        style={{ padding: '0 6px' }}
                        title={r.name}
                      >
                        <span style={{ fontSize: 12, flexShrink: 0 }}>{r.icon}</span>
                        <span className="truncate" style={{ fontSize: '0.6875rem', fontWeight: 600, color: 'var(--text-700)' }}>
                          {r.name}
                        </span>
                      </div>
                      {r.monthly.map((v, mi) => {
                        const alpha = v > 0 ? 0.12 + 0.78 * (v / maxCell) : 0;
                        return (
                          <div
                            key={mi}
                            title={`${r.name} · ${MONTH_NAMES[mi]}: ${formatCurrency(v, currency)}`}
                            className="num-mono text-center"
                            style={{
                              fontSize: '0.625rem',
                              fontWeight: 600,
                              padding: '6px 0',
                              borderRadius: 4,
                              background: v > 0 ? hexToRgba(r.color, alpha) : 'var(--bg-subtle)',
                              color: alpha > 0.55 ? '#ffffff' : 'var(--text-600)',
                            }}
                          >
                            {v > 0 ? compactAmount(v) : ''}
                          </div>
                        );
                      })}
                      <div
                        className="num-mono text-center"
                        style={{
                          fontSize: '0.625rem',
                          fontWeight: 700,
                          padding: '6px 0',
                          borderRadius: 4,
                          background: 'var(--bg-muted)',
                          color: 'var(--text-700)',
                        }}
                        title={`${r.name} · Total: ${formatCurrency(r.total, currency)}`}
                      >
                        {compactAmount(r.total)}
                      </div>
                    </Fragment>
                  ))}

                  {/* Column totals */}
                  <div
                    className="flex items-center"
                    style={{ padding: '0 6px', fontSize: '0.6875rem', fontWeight: 700, color: 'var(--text-800)' }}
                  >
                    Total
                  </div>
                  {monthlyData.map((m, mi) => (
                    <div
                      key={mi}
                      className="num-mono text-center"
                      style={{
                        fontSize: '0.625rem',
                        fontWeight: 700,
                        padding: '6px 0',
                        borderRadius: 4,
                        background: 'var(--brand-50)',
                        color: 'var(--brand-text)',
                      }}
                      title={`${MONTH_NAMES[mi]} total: ${formatCurrency(m.expense, currency)}`}
                    >
                      {m.expense > 0 ? compactAmount(m.expense) : ''}
                    </div>
                  ))}
                  <div
                    className="num-mono text-center"
                    style={{
                      fontSize: '0.625rem',
                      fontWeight: 800,
                      padding: '6px 0',
                      borderRadius: 4,
                      background: 'var(--brand-100)',
                      color: 'var(--brand-text)',
                    }}
                    title={`Year total: ${formatCurrency(totalSpent, currency)}`}
                  >
                    {compactAmount(totalSpent)}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Key Insights ── */}
      {insights.length > 0 && (
        <div className="mb-6">
          <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--text-400)' }}>
            Key Insights
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
            {insights.map((ins, i) => (
              <div
                key={i}
                className="rounded-lg p-3 flex items-start gap-2.5"
                style={{ background: ins.bg, border: `1px solid ${ins.border}` }}
              >
                <ins.Icon size={14} style={{ color: ins.color, marginTop: 1, flexShrink: 0 }} />
                <p className="text-xs" style={{ color: 'var(--text-700)', lineHeight: 1.5 }}>
                  {ins.text}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Income Sources ── */}
      {incomeSources.length > 0 && (
        <div className="mb-6">
          <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--text-400)' }}>
            Income Sources
          </p>
          <div className="space-y-2">
            {incomeSources.map((s) => (
              <div
                key={s.name}
                className="rounded-lg p-3"
                style={{ background: 'var(--bg-subtle)', border: '1px solid var(--bg-muted)' }}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-bold" style={{ color: 'var(--text-700)' }}>
                    {s.name}{' '}
                    <span style={{ color: 'var(--text-400)', fontWeight: 500 }}>
                      · {s.count} txn{s.count === 1 ? '' : 's'}
                    </span>
                  </span>
                  <span className="text-xs num-mono font-semibold" style={{ color: 'var(--success-text)' }}>
                    +{formatCurrency(s.total, currency)} · {s.share.toFixed(1)}%
                  </span>
                </div>
                <div className="w-full rounded-full h-1.5" style={{ background: 'var(--border-default)' }}>
                  <div
                    className="h-1.5 rounded-full"
                    style={{
                      width: `${Math.min(100, s.share)}%`,
                      background: 'linear-gradient(90deg, #34d399, #059669)',
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Monthly Breakdown (collapsible) ── */}
      <div>
        <button
          onClick={() => setShowBreakdown(!showBreakdown)}
          className="flex items-center justify-between w-full py-3 px-1"
        >
          <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-400)' }}>
            Monthly Breakdown
          </p>
          <ChevronDown
            size={18}
            style={{ color: 'var(--text-400)' }}
            className={`transition-transform duration-300 ${showBreakdown ? 'rotate-180' : ''}`}
          />
        </button>
        {showBreakdown && (
          <div className="space-y-2 mt-1">
            {monthlyData.map((m, mi) => {
              const hasData = m.income > 0 || m.expense > 0;
              const mb = monthBalanceAt(mi);
              const hasBalance = !!mb && !mb.beforeBaseline && !mb.isFuture;
              if (!hasData && !hasBalance) return null;
              const incomeWidth = (m.income / maxBar) * 100;
              const expenseWidth = (m.expense / maxBar) * 100;
              const monthlySavings = m.savings;
              return (
                <div
                  key={m.name}
                  className="rounded-lg p-3"
                  style={{ background: 'var(--bg-subtle)', border: '1px solid var(--bg-muted)' }}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold w-8" style={{ color: 'var(--text-700)' }}>
                      {m.name}
                    </span>
                    <div className="flex items-center gap-4 text-xs num-mono">
                      {hasBalance && (
                        <span style={{ color: 'var(--text-400)', fontSize: '0.6875rem' }}>
                          {formatCurrency(mb!.opening ?? 0, currency)} → <span style={{ fontWeight: 700, color: 'var(--text-700)' }}>{formatCurrency(mb!.closing ?? 0, currency)}</span>
                        </span>
                      )}
                      <span style={{ color: 'var(--success-text)' }}>+{formatCurrency(m.income, currency)}</span>
                      <span style={{ color: 'var(--danger-text)' }}>-{formatCurrency(m.expense, currency)}</span>
                      <span
                        className="font-bold"
                        style={{ color: monthlySavings >= 0 ? 'var(--success-text)' : 'var(--danger-text)' }}
                      >
                        {monthlySavings >= 0 ? '+' : ''}
                        {formatCurrency(monthlySavings, currency)}
                      </span>
                      {m.income > 0 && (
                        <span style={{ color: 'var(--text-400)' }}>
                          ({((m.savings / m.income) * 100).toFixed(1)}%)
                        </span>
                      )}
                    </div>
                  </div>
                  {hasBalance && mb!.reserveExpenses > 0 && (
                    <div className="num-mono" style={{ fontSize: '0.6875rem', color: 'var(--text-400)', marginBottom: 6 }}>
                      Regular {formatCurrency(mb!.regularExpenses, currency)} · Reserve {formatCurrency(mb!.reserveExpenses, currency)}
                    </div>
                  )}
                  <div className="space-y-1">
                    <div className="w-full rounded-full h-1.5" style={{ background: 'var(--border-default)' }}>
                      <div
                        className="h-1.5 rounded-full"
                        style={{
                          width: `${incomeWidth}%`,
                          background: 'linear-gradient(90deg, #34d399, #059669)',
                        }}
                      />
                    </div>
                    <div className="w-full rounded-full h-1.5" style={{ background: 'var(--border-default)' }}>
                      <div
                        className="h-1.5 rounded-full"
                        style={{
                          width: `${expenseWidth}%`,
                          background: 'linear-gradient(90deg, #fb7185, #dc2626)',
                        }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
            {activeMonths === 0 && (
              <p className="text-center py-4 text-sm" style={{ color: 'var(--text-400)' }}>
                No data for {year}
              </p>
            )}

            {/* Legend */}
            <div className="flex items-center justify-center gap-6 pt-2">
              <div className="flex items-center gap-1.5">
                <div
                  className="w-3 h-1.5 rounded-full"
                  style={{ background: 'linear-gradient(90deg, #34d399, #059669)' }}
                />
                <span className="text-xs" style={{ color: 'var(--text-500)' }}>
                  Income
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <div
                  className="w-3 h-1.5 rounded-full"
                  style={{ background: 'linear-gradient(90deg, #fb7185, #dc2626)' }}
                />
                <span className="text-xs" style={{ color: 'var(--text-500)' }}>
                  Expenses
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {balanceModal && <OpeningBalanceModal onClose={() => setBalanceModal(false)} />}
    </div>
  );
}
