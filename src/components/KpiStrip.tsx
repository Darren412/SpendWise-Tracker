'use client';

import { useMemo } from 'react';
import { useBudgetStore } from '@/store/budgetStore';
import { formatCurrencyShort, currencySymbol } from '@/utils/currency';
import { getFinancialMonthRange } from '@/utils/financialCycle';

export default function KpiStrip() {
  const {
    selectedMonth, selectedYear,
    getMonthlyTotal, getMonthlyIncome,
    financialCycleStart, currency,
  } = useBudgetStore();

  const totalExpenses = getMonthlyTotal(selectedMonth, selectedYear);
  const totalIncome   = getMonthlyIncome(selectedMonth, selectedYear);
  const netBalance    = totalIncome - totalExpenses;
  const savingsRate   = totalIncome > 0 ? Math.round((netBalance / totalIncome) * 100) : 0;
  const sym = currencySymbol(currency);

  // Avg daily spend
  const { start: periodStart } = getFinancialMonthRange(selectedMonth, selectedYear, financialCycleStart);
  const today = new Date();
  const daysElapsed = Math.max(1, Math.min(
    Math.ceil((today.getTime() - periodStart.getTime()) / (1000 * 60 * 60 * 24)),
    31,
  ));
  const avgDailySpend = totalExpenses / daysElapsed;

  // Health score
  const healthScore = useMemo(() => {
    if (totalIncome === 0) return 0;
    const srScore = Math.min(30, Math.max(0, savingsRate)) / 30 * 40;
    const cfScore = netBalance >= 0 ? 40 : Math.max(0, 40 + (netBalance / totalIncome) * 40);
    return Math.round(Math.min(100, srScore + cfScore + 20));
  }, [totalIncome, savingsRate, netBalance]);

  // Previous month
  const prevM = useMemo(() => {
    let m = parseInt(selectedMonth) - 1, y = selectedYear;
    if (m < 1) { m = 12; y -= 1; }
    return { month: m.toString().padStart(2, '0'), year: y };
  }, [selectedMonth, selectedYear]);
  const prevExpenses = getMonthlyTotal(prevM.month, prevM.year);
  const expChangePct = prevExpenses > 0 ? Math.round((totalExpenses - prevExpenses) / prevExpenses * 100) : 0;

  const healthLabel = healthScore >= 80 ? 'Excellent' : healthScore >= 65 ? 'Good' : healthScore >= 45 ? 'Fair' : 'Needs work';
  const healthColor = healthScore >= 80 ? '#10b981' : healthScore >= 65 ? '#3b82f6' : healthScore >= 45 ? '#f59e0b' : '#ef4444';

  const kpis = [
    {
      label: 'Total Income',
      value: formatCurrencyShort(totalIncome, currency),
      color: '#10b981',
      sub: 'This period',
      accent: '#ecfdf5',
    },
    {
      label: 'Total Expenses',
      value: formatCurrencyShort(totalExpenses, currency),
      color: '#ef4444',
      sub: prevExpenses > 0 ? `${expChangePct >= 0 ? '+' : ''}${expChangePct}% vs last` : 'This period',
      accent: '#fef2f2',
    },
    {
      label: 'Net Balance',
      value: `${netBalance >= 0 ? '+' : '−'}${sym}${Math.abs(netBalance).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`,
      color: netBalance >= 0 ? '#10b981' : '#ef4444',
      sub: netBalance >= 0 ? 'Positive cash flow' : 'Overspending',
      accent: netBalance >= 0 ? '#ecfdf5' : '#fef2f2',
    },
    {
      label: 'Savings Rate',
      value: `${savingsRate}%`,
      color: savingsRate >= 20 ? '#10b981' : savingsRate >= 0 ? '#f59e0b' : '#ef4444',
      sub: savingsRate >= 20 ? 'On target' : 'Below target',
      accent: '#fffbeb',
    },
    {
      label: 'Health Score',
      value: `${healthScore}`,
      color: healthColor,
      sub: healthLabel,
      accent: '#f0f9ff',
      suffix: '/100',
    },
    {
      label: 'Daily Avg Spend',
      value: formatCurrencyShort(avgDailySpend, currency),
      color: '#4f46e5',
      sub: `${daysElapsed} days elapsed`,
      accent: '#eef2ff',
    },
  ];

  return (
    <div className="sw-kpi-strip">
      {kpis.map((k) => (
        <div key={k.label} className="sw-kpi-glass">
          <div className="sw-kpi-glass-label">{k.label}</div>
          <div className="sw-kpi-glass-value" style={{ color: k.color }}>
            {k.value}
            {k.suffix && <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#d1d5db' }}>{k.suffix}</span>}
          </div>
          <div className="sw-kpi-glass-sub">{k.sub}</div>
        </div>
      ))}
    </div>
  );
}
