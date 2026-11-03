'use client';

import { useMemo, useState } from 'react';
import { Wallet, PiggyBank, Plus, ShieldCheck } from 'lucide-react';
import { useBudgetStore, generateId } from '@/store/budgetStore';
import { useMajorExpenses } from '@/hooks/useMajorExpenses';
import { fundingParts } from '@/lib/funding';
import { formatCurrency } from '@/utils/currency';
import OpeningBalanceModal from '@/components/balance/OpeningBalanceModal';
import type { Expense } from '@/types';

const card: React.CSSProperties = {
  borderRadius: 'var(--r-lg)', padding: '14px 16px',
  background: 'var(--bg-subtle)', border: '1px solid var(--border-default)',
};

const MAJOR_CATEGORIES: { name: string; icon: string; color: string }[] = [
  { name: 'Vehicle Down Payment', icon: '🚗', color: '#0ea5e9' },
  { name: 'Home Down Payment', icon: '🏠', color: '#8b5cf6' },
  { name: 'Medical Emergency', icon: '🏥', color: '#ef4444' },
  { name: 'Home Renovation', icon: '🛠️', color: '#f59e0b' },
  { name: 'Education', icon: '🎓', color: '#6366f1' },
  { name: 'Major Purchase', icon: '🛍️', color: '#ec4899' },
  { name: 'Major Travel', icon: '✈️', color: '#14b8a6' },
  { name: 'Wedding / Family Event', icon: '💍', color: '#f43f5e' },
  { name: 'Asset Purchase', icon: '💼', color: '#84cc16' },
];

// ── Main tab ────────────────────────────────────────────────────────────────

export default function MajorExpensesTab({ onNavigate }: { onNavigate?: (workspace: string, subTab?: string) => void }) {
  const {
    expenses, categories, currency, addCategory, selectedYear,
  } = useBudgetStore();
  const {
    availableNow, usageThisPeriod, usageThisYear,
    coverage, overallBalance, hasBaseline,
  } = useMajorExpenses();

  const [balanceModal, setBalanceModal] = useState(false);
  const [catsAdded, setCatsAdded] = useState(false);

  // Major (balance-funded) expenses for the selected label year, by category
  const majorByCat = useMemo(() => {
    const byCat = new Map<string, { total: number; count: number; items: Expense[] }>();
    for (const e of expenses) {
      if (e.year !== selectedYear) continue;
      const p = fundingParts(e);
      if (p.balance <= 0) continue;
      const a = byCat.get(e.category) ?? { total: 0, count: 0, items: [] };
      a.total += p.balance; a.count += 1; a.items.push(e);
      byCat.set(e.category, a);
    }
    return [...byCat.entries()].sort((a, b) => b[1].total - a[1].total);
  }, [expenses, selectedYear]);

  const addMajorCategories = () => {
    const existing = new Set(categories.map(c => c.name.trim().toLowerCase()));
    for (const c of MAJOR_CATEGORIES) {
      if (existing.has(c.name.toLowerCase())) continue;
      addCategory({ id: generateId('cat'), name: c.name, icon: c.icon, color: c.color, type: 'expense' });
    }
    setCatsAdded(true);
  };

  return (
    <div>
      {/* ── Position strip — two separate concepts, never one number ── */}
      <div className="stagger-fade" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12, marginBottom: 16 }}>
        <div style={card}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
            <Wallet size={13} style={{ color: 'var(--text-500)' }} />
            <span style={{ fontSize: '0.6875rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-500)' }}>
              Overall balance
            </span>
          </div>
          {overallBalance !== null ? (
            <p className="num-mono" style={{ fontSize: '1.35rem', fontWeight: 800, color: overallBalance < 0 ? 'var(--danger-text)' : 'var(--text-900)' }}>
              {formatCurrency(overallBalance, currency)}
            </p>
          ) : (
            <button
              onClick={() => setBalanceModal(true)}
              style={{ padding: '6px 12px', borderRadius: 'var(--r-sm)', border: '1px solid var(--border-default)', cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.75rem', fontWeight: 700, background: 'var(--bg-surface)', color: 'var(--brand-text)' }}
            >
              Set opening balance
            </button>
          )}
          <p style={{ fontSize: '0.68rem', color: 'var(--text-400)', marginTop: 4 }}>Opening balance + income − all expenses</p>
        </div>

        <div style={{ ...card, background: 'var(--amber-50)', border: '1px solid var(--amber-200)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
            <PiggyBank size={13} style={{ color: 'var(--warning-text)' }} />
            <span style={{ fontSize: '0.6875rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--warning-text)' }}>
              Major expenses
            </span>
          </div>
          <p className="num-mono" style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--text-900)' }}>
            {formatCurrency(usageThisPeriod.total, currency)}
          </p>
          <p style={{ fontSize: '0.68rem', color: 'var(--amber-600)', marginTop: 4 }}>
            this month · {formatCurrency(usageThisYear.total, currency)} paid from your existing balance in {selectedYear}
          </p>
        </div>
      </div>

      {/* ── Balance coverage health ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        <ShieldCheck size={15} style={{ color: coverage.status === 'ok' ? 'var(--success-text)' : 'var(--text-300)', flexShrink: 0 }} />
        <div style={{ fontSize: '0.75rem', color: 'var(--text-600)' }}>
          {hasBaseline ? (
            coverage.status === 'ok' ? (
              <>Balance coverage: <span className="num-mono" style={{ fontWeight: 800, color: 'var(--text-900)' }}>{coverage.months} months</span></>
            ) : coverage.status === 'no-essential-spend' ? (
              'No essential spending recorded yet'
            ) : (
              'Coverage unlocks after 3 complete months of expense history'
            )
          ) : (
            <>Coverage unlocks once you{' '}
              <button type="button" onClick={() => setBalanceModal(true)} style={{ border: 'none', background: 'none', padding: 0, cursor: 'pointer', fontFamily: 'inherit', fontSize: 'inherit', color: 'var(--brand-600)', fontWeight: 700, textDecoration: 'underline' }}>
                set an opening balance
              </button>
            </>
          )}
        </div>
      </div>
      <p style={{ fontSize: '0.68rem', color: 'var(--text-400)', marginBottom: 16 }}>
        Coverage = available balance{availableNow !== null ? ` (${formatCurrency(availableNow, currency)})` : ''} ÷ average essential monthly spending (last 3 complete months, essential categories only).
      </p>

      {/* ── Major expenses this year ── */}
      <div style={card}>
        <p style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-400)', textTransform: 'uppercase', letterSpacing: '0.09em', marginBottom: 10 }}>
          Major expenses · {selectedYear}
        </p>
        {majorByCat.length === 0 ? (
          <p style={{ fontSize: '0.8125rem', color: 'var(--text-400)', padding: '12px 0' }}>
            No major expenses in {selectedYear} yet. Choose &apos;Existing balance&apos; as the funding source on a big expense to track it here.
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {majorByCat.map(([catId, a]) => {
              const cat = categories.find(c => c.id === catId);
              return (
                <div key={catId} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.8125rem' }}>
                  <span>{cat?.icon ?? '📦'}</span>
                  <span style={{ flex: 1, color: 'var(--text-700)' }}>{cat?.name ?? 'Unknown'}</span>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-400)' }}>{a.count} txn{a.count !== 1 ? 's' : ''}</span>
                  <span className="num-mono" style={{ fontWeight: 700, color: 'var(--warning-text)' }}>
                    {formatCurrency(a.total, currency)}
                  </span>
                </div>
              );
            })}
            {onNavigate && (
              <button
                onClick={() => onNavigate('transactions', 'balance')}
                style={{ alignSelf: 'flex-start', marginTop: 6, padding: '6px 12px', borderRadius: 'var(--r-sm)', border: '1px solid var(--border-default)', background: 'var(--bg-surface)', color: 'var(--brand-text)', fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}
              >
                View major expense transactions →
              </button>
            )}
          </div>
        )}

        <button
          onClick={addMajorCategories}
          disabled={catsAdded}
          style={{ marginTop: 14, display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 'var(--r-sm)', border: '1px dashed var(--border-default)', cursor: catsAdded ? 'default' : 'pointer', fontFamily: 'inherit', fontSize: '0.75rem', fontWeight: 700, background: 'none', color: catsAdded ? 'var(--text-300)' : 'var(--brand-text)' }}
        >
          <Plus size={12} /> {catsAdded ? 'Major-expense categories added' : 'Add major-expense categories'}
        </button>
      </div>

      {balanceModal && <OpeningBalanceModal onClose={() => setBalanceModal(false)} />}
    </div>
  );
}
