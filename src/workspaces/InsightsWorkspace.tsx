'use client';

import { useMemo } from 'react';
import { Brain, TrendingUp, TrendingDown, AlertTriangle, CheckCircle, Info, Sparkles } from 'lucide-react';
import { useBudgetStore } from '@/store/budgetStore';
import { formatCurrencyShort, currencySymbol } from '@/utils/currency';
import { getFinancialMonthRange } from '@/utils/financialCycle';

export default function InsightsWorkspace() {
  const {
    expenses, categories,
    selectedMonth, selectedYear, selectedCity,
    excludedCategoryIds,
    getMonthlyTotal, getMonthlyIncome,
    financialCycleStart, currency,
  } = useBudgetStore();

  const { start, end } = getFinancialMonthRange(selectedMonth, selectedYear, financialCycleStart);

  // Use the same financial period window (start/end) for totalExpenses as catBreakdown uses,
  // so the "High Category Concentration" percentage is calculated on the same dataset.
  const totalExpenses = useMemo(() =>
    expenses
      .filter(e => {
        const d = new Date(e.date);
        return d >= start && d <= end &&
          (selectedCity === 'Both' || !e.city || e.city === selectedCity);
      })
      .reduce((s, e) => s + e.amount, 0),
    [expenses, start, end, selectedCity]);

  const totalIncome   = getMonthlyIncome(selectedMonth, selectedYear);
  const netBalance    = totalIncome - totalExpenses;
  const savingsRate   = totalIncome > 0 ? Math.round((netBalance / totalIncome) * 100) : 0;
  const sym = currencySymbol(currency);

  const monthHistory = useMemo(() => Array.from({ length: 5 }, (_, i) => {
    let m = parseInt(selectedMonth) - i, y = selectedYear;
    while (m < 1) { m += 12; y -= 1; }
    const mStr = m.toString().padStart(2, '0');
    return {
      label: new Date(y, m - 1, 1).toLocaleDateString('en-IN', { month: 'short', year: '2-digit' }),
      expenses: getMonthlyTotal(mStr, y),
      income:   getMonthlyIncome(mStr, y),
    };
  }).reverse(), [selectedMonth, selectedYear, getMonthlyTotal, getMonthlyIncome]);

  const catBreakdown = useMemo(() => categories
    .filter(c => c.type !== 'income' && (excludedCategoryIds.length === 0 || !excludedCategoryIds.includes(c.id)))
    .map(c => {
      const spent = expenses
        .filter(e => {
          const d = new Date(e.date);
          const inPeriod = d >= start && d <= end;
          const inCity   = selectedCity === 'Both' || !e.city || e.city === selectedCity;
          const catMatch = e.category === c.id;
          return inPeriod && inCity && catMatch;
        })
        .reduce((s, e) => s + e.amount, 0);
      return { ...c, spent };
    })
    .filter(c => c.spent > 0)
    .sort((a, b) => b.spent - a.spent),
    [categories, expenses, start, end, selectedCity, excludedCategoryIds]);

  const recurringItems = useMemo(() => {
    const descCount: Record<string, number> = {};
    expenses.forEach(e => {
      const key = e.description.toLowerCase().trim();
      descCount[key] = (descCount[key] ?? 0) + 1;
    });
    return Object.entries(descCount)
      .filter(([, count]) => count >= 2)
      .map(([desc]) => {
        const latest = expenses
          .filter(e => e.description.toLowerCase().trim() === desc)
          .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
        return { desc, count: descCount[desc], amount: latest?.amount ?? 0 };
      })
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5);
  }, [expenses]);

  const insights = useMemo(() => {
    const cards: {
      type: 'warn' | 'success' | 'info' | 'neutral';
      Icon: React.ElementType;
      title: string;
      body: string;
    }[] = [];

    if (totalIncome > 0 && totalExpenses > totalIncome)
      cards.push({ type: 'warn', Icon: AlertTriangle, title: 'Overspending Alert', body: `You are spending ${sym}${Math.round(totalExpenses - totalIncome).toLocaleString('en-IN')} more than you earn this period. Review your top categories to identify cuts.` });

    if (savingsRate >= 20)
      cards.push({ type: 'success', Icon: CheckCircle, title: 'Healthy Savings Rate', body: `You're saving ${savingsRate}% of your income — above the recommended 20% threshold. Keep it up.` });
    else if (totalIncome > 0)
      cards.push({ type: 'warn', Icon: AlertTriangle, title: 'Low Savings Rate', body: `Your savings rate is ${savingsRate}%. Aim for at least 20% (${sym}${Math.round(totalIncome * 0.2).toLocaleString('en-IN')}/period) to build financial resilience.` });

    if (catBreakdown[0] && totalExpenses > 0) {
      const pct = Math.round(catBreakdown[0].spent / totalExpenses * 100);
      if (pct > 40)
        cards.push({ type: 'warn', Icon: TrendingUp, title: 'High Category Concentration', body: `${catBreakdown[0].icon} ${catBreakdown[0].name} accounts for ${pct}% of total spend (${formatCurrencyShort(catBreakdown[0].spent, currency)}). Consider diversifying or setting a limit.` });
      else
        cards.push({ type: 'info', Icon: Info, title: 'Top Spend Category', body: `Your biggest expense category is ${catBreakdown[0].icon} ${catBreakdown[0].name} at ${formatCurrencyShort(catBreakdown[0].spent, currency)} (${pct}% of total).` });
    }

    const trend = monthHistory.filter(m => m.expenses > 0);
    if (trend.length >= 3) {
      const avg = trend.slice(0, -1).reduce((s, m) => s + m.expenses, 0) / (trend.length - 1);
      const latest = trend[trend.length - 1].expenses;
      const diff = Math.round((latest - avg) / avg * 100);
      if (Math.abs(diff) >= 10)
        cards.push({
          type: diff > 0 ? 'warn' : 'success',
          Icon: diff > 0 ? TrendingUp : TrendingDown,
          title: diff > 0 ? 'Spending Increasing' : 'Spending Decreasing',
          body: `Your spending this period is ${diff > 0 ? '+' : ''}${diff}% compared to your recent average. ${diff > 0 ? 'Monitor your discretionary spending.' : 'Great trend — keep controlling costs.'}`,
        });
    }

    if (cards.length < 4)
      cards.push({ type: 'neutral', Icon: Brain, title: 'More Data Needed', body: 'Add more transactions across multiple periods to unlock deeper behavioral insights and trend analysis.' });

    return cards;
  }, [totalIncome, totalExpenses, savingsRate, catBreakdown, monthHistory, sym, currency]);

  const typeConfig = {
    warn:    { bg: '#fffbeb', border: '#fde68a', iconBg: 'var(--amber-100)', iconColor: 'var(--amber-600)' },
    success: { bg: 'var(--green-50)', border: 'var(--green-100)', iconBg: '#bbf7d0', iconColor: 'var(--green-700)' },
    info:    { bg: 'var(--blue-50)',  border: '#bfdbfe', iconBg: '#dbeafe', iconColor: 'var(--blue-600)' },
    neutral: { bg: 'var(--bg-subtle)', border: 'var(--border-default)', iconBg: 'var(--bg-muted)', iconColor: 'var(--text-500)' },
  };

  const maxSpend = Math.max(...monthHistory.map(m => m.expenses), 1);

  return (
    <div style={{ maxWidth: 1400 }}>

      {/* ── Header ── */}
      <div className="ws-header">
        <div>
          <h1 className="ws-title" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Sparkles size={20} style={{ color: 'var(--brand-600)' }} />
            AI Insights
          </h1>
          <p className="ws-subtitle">Smart observations · Behavioral analysis · Financial recommendations</p>
        </div>
      </div>

      {/* ── Insight cards ── */}
      <div className="ws-insights-grid">
        {insights.map((ins, i) => {
          const cfg = typeConfig[ins.type];
          return (
            <div
              key={i}
              className="ws-insight-card"
              style={{
                background: cfg.bg,
                borderColor: cfg.border,
                borderLeftColor: cfg.iconColor,
                borderLeftWidth: 4,
              }}
            >
              <div
                className="ws-insight-icon"
                style={{ background: cfg.iconBg, color: cfg.iconColor }}
              >
                <ins.Icon size={16} />
              </div>
              <div style={{ flex: 1 }}>
                <div className="ws-insight-title">{ins.title}</div>
                <div className="ws-insight-body">{ins.body}</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Recurring payments ── */}
      {recurringItems.length > 0 && (
        <div className="panel" style={{ marginBottom: 16 }}>
          <div className="ws-panel-header" style={{ borderBottom: '1px solid var(--bg-muted)', paddingBottom: 12 }}>
            <span style={{ fontSize: '0.875rem' }}>🔄</span>
            <span>Recurring Payments Detected</span>
            <span
              className="badge badge-blue"
              style={{ marginLeft: 'auto' }}
            >
              {recurringItems.length} found
            </span>
          </div>
          <div style={{ padding: '12px 0 4px', display: 'flex', flexDirection: 'column', gap: 4 }}>
            {recurringItems.map(item => (
              <div
                key={item.desc}
                className="ws-txn-row"
                style={{ padding: '10px 20px' }}
              >
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 'var(--r-md)',
                    background: 'var(--bg-muted)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '1rem',
                  }}
                >
                  🔁
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-900)', textTransform: 'capitalize' }}>{item.desc}</div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-400)' }}>Appears {item.count}× in history</div>
                </div>
                <div style={{ fontSize: '0.9375rem', fontWeight: 700, color: 'var(--red-500)', fontVariantNumeric: 'tabular-nums' }}>
                  {sym}{item.amount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── 5-Month spend trend ── */}
      <div className="panel">
        <div className="ws-panel-header" style={{ borderBottom: '1px solid var(--bg-muted)', paddingBottom: 12 }}>
          <span style={{ fontSize: '0.875rem' }}>📊</span>
          <span>5-Month Spend Trend</span>
        </div>
        <div style={{ padding: '16px 20px' }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', height: 88 }}>
            {monthHistory.map((m, i) => {
              const h = m.expenses > 0 ? Math.max(14, Math.round((m.expenses / maxSpend) * 76)) : 4;
              const isLatest = i === monthHistory.length - 1;
              return (
                <div key={m.label} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5 }}>
                  <div
                    style={{
                      width: '100%',
                      height: h,
                      background: isLatest
                        ? 'var(--brand-500)'
                        : m.expenses > 0 ? 'var(--brand-200)' : 'var(--bg-muted)',
                      borderRadius: 'var(--r-sm) var(--r-sm) 0 0',
                      transition: 'height 0.4s ease',
                      position: 'relative',
                    }}
                    title={`${m.label}: ${sym}${Math.round(m.expenses).toLocaleString('en-IN')}`}
                  />
                  <div style={{ fontSize: '0.6875rem', color: isLatest ? 'var(--brand-600)' : 'var(--text-400)', fontWeight: isLatest ? 700 : 400, whiteSpace: 'nowrap' }}>
                    {m.label}
                  </div>
                  {m.expenses > 0 && (
                    <div style={{ fontSize: '0.625rem', color: 'var(--text-400)', fontVariantNumeric: 'tabular-nums' }}>
                      {sym}{(m.expenses / 1000).toFixed(0)}k
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

    </div>
  );
}
