'use client';

import { PiggyBank, ArrowRight } from 'lucide-react';
import { useBudgetStore } from '@/store/budgetStore';
import { useMajorExpenses } from '@/hooks/useMajorExpenses';
import { useRegularExpenses } from '@/hooks/useRegularExpenses';
import { buildPositionSummary, fundingParts } from '@/lib/funding';
import { formatCurrency, formatCurrencyShort } from '@/utils/currency';

/**
 * Compact Overview card "Major Expenses from Existing Balance": available
 * balance, major-expense usage, coverage, and the three-concept position
 * summary — each named separately, never merged into one number.
 */
export default function MajorExpensesCard({ onNavigate }: { onNavigate?: (workspace: string, subTab?: string) => void }) {
  const {
    currency, selectedMonth, selectedYear, expenses,
    getMonthlyBudget, getMonthlyIncome,
  } = useBudgetStore();
  const regularAll = useRegularExpenses();
  const { availableNow, usageThisPeriod, coverage, overallBalance, hasBaseline } = useMajorExpenses();

  const periodExpenses = expenses.filter(e => e.month === selectedMonth && e.year === selectedYear);
  const majorCount = periodExpenses.filter(e => fundingParts(e).balance > 0).length;
  const hasActivity = expenses.some(e => fundingParts(e).balance > 0);

  if (!hasActivity) {
    return (
      <div className="ws-panel" style={{ marginBottom: 20, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <PiggyBank size={16} style={{ color: 'var(--amber-500)', flexShrink: 0 }} />
        <span style={{ flex: 1, minWidth: 200, fontSize: '0.8125rem', color: 'var(--text-600)' }}>
          Paying for something big from your savings? Choose &apos;Existing balance&apos; when adding it.
        </span>
      </div>
    );
  }

  const totalIncome = getMonthlyIncome(selectedMonth, selectedYear);
  const regularSpend = regularAll
    .filter(e => e.month === selectedMonth && e.year === selectedYear)
    .reduce((s, e) => s + e.amount, 0);
  const monthlyBudget = getMonthlyBudget(selectedMonth, selectedYear);
  const lines = buildPositionSummary({
    monthlyBudget: monthlyBudget > 0 ? monthlyBudget : null,
    operatingSurplus: totalIncome - regularSpend,
    regularSpend,
    majorUsed: usageThisPeriod.total,
    majorCount,
    overallBalance,
    format: v => formatCurrency(v, currency),
  });

  const stat = (label: string, value: string, hint?: string) => (
    <div key={label} style={{ flex: 1, minWidth: 110 }}>
      <div style={{ fontSize: '0.625rem', fontWeight: 700, color: 'var(--text-400)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 }}>
        {label}
      </div>
      <div className="num-mono" style={{ fontSize: '0.9375rem', fontWeight: 800, color: 'var(--text-900)' }}>{value}</div>
      {hint && <div style={{ fontSize: '0.625rem', color: 'var(--text-400)', marginTop: 1 }}>{hint}</div>}
    </div>
  );

  return (
    <div className="ws-panel" style={{ marginBottom: 20 }}>
      <div className="ws-panel-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <PiggyBank size={14} style={{ color: 'var(--amber-500)' }} />
          Major Expenses from Existing Balance
        </span>
        {onNavigate && (
          <button
            onClick={() => onNavigate('planning', 'major')}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '5px 10px', borderRadius: 'var(--r-sm)', border: '1px solid var(--border-default)', background: 'var(--bg-surface)', color: 'var(--brand-text)', fontSize: '0.7rem', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}
          >
            View major expenses <ArrowRight size={11} />
          </button>
        )}
      </div>

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', padding: '4px 0 10px' }}>
        {hasBaseline
          ? stat('Available balance', formatCurrencyShort(availableNow ?? 0, currency))
          : stat('Available balance', '—', 'set an opening balance')}
        {stat('Major expenses', formatCurrencyShort(usageThisPeriod.total, currency), `${usageThisPeriod.count} txn${usageThisPeriod.count === 1 ? '' : 's'} this month`)}
        {stat('Coverage', coverage.status === 'ok' ? `${coverage.months} mo` : 'Not enough data')}
      </div>

      {lines.length > 0 && (
        <div style={{ borderTop: '1px dashed var(--border-default)', paddingTop: 10, display: 'flex', flexDirection: 'column', gap: 4 }}>
          {lines.map((l, i) => (
            <p key={i} style={{ fontSize: '0.78rem', color: 'var(--text-600)', lineHeight: 1.45, margin: 0 }}>{l}</p>
          ))}
        </div>
      )}
    </div>
  );
}
