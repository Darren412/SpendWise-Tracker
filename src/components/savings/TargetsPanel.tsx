'use client';

import { useMemo, useState } from 'react';
import { CheckCircle2, AlertTriangle, XCircle, X } from 'lucide-react';
import { useBudgetStore } from '@/store/budgetStore';
import { useRegularExpenses } from '@/hooks/useRegularExpenses';
import { targetProgress, TargetPeriodHistory } from '@/lib/savingsTargets';
import { getFinancialMonthRange, todayLocalISO } from '@/utils/financialCycle';
import { formatCurrency } from '@/utils/currency';

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const STATUS_UI = {
  'on-track':    { label: 'On track',    color: 'var(--green-600)',  Icon: CheckCircle2 },
  'approaching': { label: 'Approaching', color: 'var(--amber-600)',  Icon: AlertTriangle },
  'over':        { label: 'Over target', color: 'var(--red-500)',    Icon: XCircle },
} as const;

/**
 * Live progress cards for each spending target — shown in the "Where Can I
 * Save?" tab above the opportunity list. Period spend matches the budget
 * alert numbers (label-filtered period expenses).
 */
export default function TargetsPanel() {
  const {
    spendingTargets, categories, currency,
    selectedMonth, selectedYear, financialCycleStart, alertThresholds,
    removeSpendingTarget, categoryBudgets,
  } = useBudgetStore();
  // Target progress measures REGULAR spend — a reserve-funded expense must
  // never worsen a target's status.
  const expenses = useRegularExpenses();
  const [removeFor, setRemoveFor] = useState<string | null>(null);
  const [alsoBudget, setAlsoBudget] = useState(false);

  const today = todayLocalISO();

  const rows = useMemo(() => {
    const entries = Object.entries(spendingTargets);
    if (entries.length === 0) return [];

    // Per-period label-filtered spend for the last 13 financial periods
    const periods: { key: string; label: string; start: string; end: string; isComplete: boolean; m: string; y: number }[] = [];
    let m = parseInt(selectedMonth, 10), y = selectedYear;
    for (let i = 0; i < 13; i++) {
      const mm = String(m).padStart(2, '0');
      const { start, end } = getFinancialMonthRange(mm, y, financialCycleStart);
      const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      periods.unshift({
        key: `${y}-${mm}`, label: `${MONTH_NAMES[m - 1]} '${String(y).slice(2)}`,
        start: iso(start), end: iso(end), isComplete: iso(end) < today, m: mm, y,
      });
      m -= 1; if (m < 1) { m = 12; y -= 1; }
    }
    const sel = periods[periods.length - 1];
    const elapsedDays = Math.max(1, Math.floor((new Date(today + 'T00:00:00').getTime() - new Date(sel.start + 'T00:00:00').getTime()) / 86400000) + 1);
    const totalDays = Math.floor((new Date(sel.end + 'T00:00:00').getTime() - new Date(sel.start + 'T00:00:00').getTime()) / 86400000) + 1;
    const elapsedFraction = sel.isComplete ? 1 : Math.min(1, elapsedDays / totalDays);
    const periodSpend = (mm: string, yy: number, catId: string) =>
      expenses.filter(e => e.month === mm && e.year === yy && e.category === catId)
        .reduce((s, e) => s + e.amount, 0);

    return entries.map(([catId, target]) => {
      const cat = categories.find(c => c.id === catId);
      const history: TargetPeriodHistory[] = periods.map(p => ({
        key: p.key, label: p.label, start: p.start,
        amount: periodSpend(p.m, p.y, catId), isComplete: p.isComplete,
      }));
      const prog = targetProgress(target, periodSpend(sel.m, sel.y, catId), elapsedFraction, history, alertThresholds.warning);
      return { catId, cat, target, prog };
    });
  }, [spendingTargets, expenses, categories, selectedMonth, selectedYear, financialCycleStart, alertThresholds.warning, today]);

  if (rows.length === 0) return null;

  return (
    <div className="panel" style={{ padding: '16px 18px', marginBottom: 14 }}>
      <div style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-400)', textTransform: 'uppercase', letterSpacing: '0.09em', marginBottom: 12 }}>
        Active savings targets
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {rows.map(({ catId, cat, target, prog }) => {
          const S = STATUS_UI[prog.status];
          return (
            <div key={catId}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ fontSize: '0.85rem' }}>{cat?.icon}</span>
                <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--text-900)', flex: 1, minWidth: 100 }}>
                  {cat?.name ?? catId}
                </span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '0.6875rem', fontWeight: 800, color: S.color }}>
                  <S.Icon size={11} /> {S.label}
                </span>
                <button
                  onClick={() => { setRemoveFor(catId); setAlsoBudget(false); }}
                  aria-label={`Remove savings target for ${cat?.name ?? catId}`}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-300)', padding: 2, display: 'flex' }}
                >
                  <X size={13} />
                </button>
              </div>
              <div style={{ display: 'flex', height: 6, borderRadius: 99, overflow: 'hidden', background: 'var(--bg-muted)', marginTop: 6 }}
                role="progressbar" aria-valuenow={Math.round(prog.usedPct)} aria-valuemin={0} aria-valuemax={100}
                aria-label={`${cat?.name ?? catId} target progress`}>
                <div style={{
                  width: `${Math.min(100, prog.usedPct)}%`,
                  background: prog.status === 'over' ? 'var(--red-500)' : prog.status === 'approaching' ? 'var(--amber-500)' : 'var(--green-500)',
                }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, marginTop: 4, flexWrap: 'wrap', fontSize: '0.7rem', color: 'var(--text-400)' }}>
                <span>
                  <strong style={{ color: 'var(--text-700)' }}>{formatCurrency(prog.spent, currency)}</strong> of {formatCurrency(target.target, currency)}
                  {' '}· {formatCurrency(prog.remaining, currency)} left
                  {' '}· projected {formatCurrency(prog.projected, currency)}
                </span>
                {prog.achievedSavings.length > 0 && (
                  <span style={{ color: 'var(--green-600)', fontWeight: 600 }}>
                    Saved vs your average: {formatCurrency(prog.totalAchieved, currency)}
                    {prog.achievedSavings.length > 1 ? ` across ${prog.achievedSavings.length} months` : ` in ${prog.achievedSavings[0].label}`}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Remove confirm */}
      {removeFor && (
        <div className="sw-overlay" onClick={e => { if (e.target === e.currentTarget) setRemoveFor(null); }}>
          <div className="sw-modal-box" role="dialog" aria-modal="true" aria-label="Remove savings target" style={{ maxWidth: 400 }}>
            <div style={{ padding: '20px 24px' }}>
              <h2 style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--text-900)', marginBottom: 8 }}>
                Remove savings target?
              </h2>
              <p style={{ fontSize: '0.8125rem', color: 'var(--text-500)', marginBottom: 12 }}>
                This removes the savings target for {categories.find(c => c.id === removeFor)?.name ?? removeFor}.
              </p>
              {(categoryBudgets[removeFor] ?? 0) > 0 && (
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.8125rem', color: 'var(--text-600)', cursor: 'pointer', marginBottom: 16 }}>
                  <input type="checkbox" checked={alsoBudget} onChange={e => setAlsoBudget(e.target.checked)} style={{ accentColor: 'var(--brand-600)' }} />
                  Also remove the category budget ({formatCurrency(categoryBudgets[removeFor], currency)})
                </label>
              )}
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button onClick={() => setRemoveFor(null)} className="ws-cta-btn">Cancel</button>
                <button
                  onClick={() => { removeSpendingTarget(removeFor, alsoBudget); setRemoveFor(null); }}
                  style={{ padding: '7px 16px', borderRadius: 'var(--r-sm)', border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.8125rem', fontWeight: 700, background: 'var(--red-500)', color: '#fff' }}
                >
                  Remove target
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
