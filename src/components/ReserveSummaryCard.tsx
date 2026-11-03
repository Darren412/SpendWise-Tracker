'use client';

import { useState } from 'react';
import { PiggyBank, ArrowDownToLine, ArrowRight } from 'lucide-react';
import { useBudgetStore } from '@/store/budgetStore';
import { useReserve } from '@/hooks/useReserve';
import { useRegularExpenses } from '@/hooks/useRegularExpenses';
import { buildPositionSummary, fundingParts } from '@/lib/reserve';
import { formatCurrency, formatCurrencyShort } from '@/utils/currency';
import { TransferModal } from '@/components/reserve/TransferModal';

/**
 * Compact Overview card for the three-concept position: monthly budget
 * performance, reserve usage, and the actual overall balance — each named
 * separately, never merged into one number.
 */
export default function ReserveSummaryCard({ onNavigate }: { onNavigate?: (workspace: string, subTab?: string) => void }) {
  const {
    currency, selectedMonth, selectedYear, expenses,
    getMonthlyBudget, getMonthlyIncome,
  } = useBudgetStore();
  const regularAll = useRegularExpenses();
  const { balance, usageThisPeriod, coverage, overallBalance } = useReserve();
  const [addOpen, setAddOpen] = useState(false);

  const periodExpenses = expenses.filter(e => e.month === selectedMonth && e.year === selectedYear);
  const majorCount = periodExpenses.filter(e => fundingParts(e).reserve > 0).length;
  const hasActivity = usageThisPeriod.total > 0 || balance !== 0 ||
    periodExpenses.some(e => fundingParts(e).reserve > 0) ||
    expenses.some(e => fundingParts(e).reserve > 0);

  if (!hasActivity) {
    return (
      <div className="ws-panel" style={{ marginBottom: 20, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <PiggyBank size={16} style={{ color: 'var(--amber-500)', flexShrink: 0 }} />
        <span style={{ flex: 1, minWidth: 200, fontSize: '0.8125rem', color: 'var(--text-600)' }}>
          Set aside a reserve for big expenses
        </span>
        {onNavigate && (
          <button
            onClick={() => onNavigate('planning', 'reserve')}
            style={{ padding: '7px 14px', borderRadius: 'var(--r-sm)', border: '1px solid var(--border-default)', background: 'var(--bg-surface)', color: 'var(--brand-text)', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}
          >
            Open reserve →
          </button>
        )}
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
    reserveUsed: usageThisPeriod.total,
    majorCount,
    reserveBalance: balance,
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
          Reserve / Major Expenses
        </span>
        <div style={{ display: 'flex', gap: 6 }}>
          <button
            onClick={() => setAddOpen(true)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '5px 10px', borderRadius: 'var(--r-sm)', border: 'none', background: 'var(--brand-600)', color: '#fff', fontSize: '0.7rem', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}
          >
            <ArrowDownToLine size={11} /> Add to reserve
          </button>
          {onNavigate && (
            <button
              onClick={() => onNavigate('planning', 'reserve')}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '5px 10px', borderRadius: 'var(--r-sm)', border: '1px solid var(--border-default)', background: 'var(--bg-surface)', color: 'var(--brand-text)', fontSize: '0.7rem', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}
            >
              View reserve <ArrowRight size={11} />
            </button>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', padding: '4px 0 10px' }}>
        {stat('Reserve available', formatCurrencyShort(balance, currency))}
        {stat('Used this month', formatCurrencyShort(usageThisPeriod.total, currency), `${usageThisPeriod.count} txn${usageThisPeriod.count === 1 ? '' : 's'}`)}
        {stat('Major expenses', String(majorCount), 'this month')}
        {stat('Coverage', coverage.status === 'ok' ? `${coverage.months} mo` : 'Not enough data')}
      </div>

      {lines.length > 0 && (
        <div style={{ borderTop: '1px dashed var(--border-default)', paddingTop: 10, display: 'flex', flexDirection: 'column', gap: 4 }}>
          {lines.map((l, i) => (
            <p key={i} style={{ fontSize: '0.78rem', color: 'var(--text-600)', lineHeight: 1.45, margin: 0 }}>{l}</p>
          ))}
        </div>
      )}

      {addOpen && <TransferModal direction="in" onClose={() => setAddOpen(false)} />}
    </div>
  );
}
