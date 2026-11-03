'use client';

import { useMemo, useState } from 'react';
import {
  Wallet, PiggyBank, ArrowDownToLine, ArrowUpFromLine, Plus,
  Pencil, Trash2, Layers, ShieldCheck,
} from 'lucide-react';
import { useBudgetStore, generateId } from '@/store/budgetStore';
import { useReserve } from '@/hooks/useReserve';
import { useBalanceLedger } from '@/hooks/useBalanceLedger';
import { fundingParts, ReserveTransfer } from '@/lib/reserve';
import { formatCurrency } from '@/utils/currency';
import OpeningBalanceModal from '@/components/balance/OpeningBalanceModal';
import { TransferModal } from '@/components/reserve/TransferModal';
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

export default function ReserveTab({ onNavigate }: { onNavigate?: (workspace: string, subTab?: string) => void }) {
  const {
    expenses, categories, currency,
    addCategory, deleteReserveTransfer, selectedYear, reserveTransfers,
  } = useBudgetStore();
  const {
    ledger, balance, usageThisPeriod, usageThisYear,
    coverage, unallocated, overallBalance, suggestedContribution,
  } = useReserve();
  const balanceLedger = useBalanceLedger();

  const [modal, setModal] = useState<'in' | 'out' | null>(null);
  const [prefill, setPrefill] = useState<number | undefined>(undefined);
  const [editing, setEditing] = useState<ReserveTransfer | null>(null);
  const [deleting, setDeleting] = useState<ReserveTransfer | null>(null);
  const [deleteError, setDeleteError] = useState('');
  const [balanceModal, setBalanceModal] = useState(false);
  const [catsAdded, setCatsAdded] = useState(false);

  // Major (reserve-funded) expenses for the selected label year, by category
  const majorByCat = useMemo(() => {
    const byCat = new Map<string, { total: number; count: number; items: Expense[] }>();
    for (const e of expenses) {
      if (e.year !== selectedYear) continue;
      const p = fundingParts(e);
      if (p.reserve <= 0) continue;
      const a = byCat.get(e.category) ?? { total: 0, count: 0, items: [] };
      a.total += p.reserve; a.count += 1; a.items.push(e);
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

  const history = [...ledger].reverse();
  const yearBalance = balanceLedger.find(y => y.year === selectedYear);

  return (
    <div>
      {/* ── Position strip — three separate concepts, never one number ── */}
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
              Reserve balance
            </span>
          </div>
          <p className="num-mono" style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--text-900)' }}>
            {formatCurrency(balance, currency)}
          </p>
          <p style={{ fontSize: '0.68rem', color: 'var(--amber-600)', marginTop: 4 }}>
            used {formatCurrency(usageThisPeriod.total, currency)} this month · {formatCurrency(usageThisYear.total, currency)} this year
          </p>
        </div>

        <div style={card}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
            <Layers size={13} style={{ color: 'var(--text-500)' }} />
            <span style={{ fontSize: '0.6875rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-500)' }}>
              Unallocated
            </span>
          </div>
          {unallocated !== null ? (
            <>
              <p className="num-mono" style={{ fontSize: '1.35rem', fontWeight: 800, color: unallocated < 0 ? 'var(--danger-text)' : 'var(--text-900)' }}>
                {formatCurrency(unallocated, currency)}
              </p>
              {unallocated < 0 && (
                <p style={{ fontSize: '0.68rem', color: 'var(--danger-text)', marginTop: 4, fontWeight: 600 }}>
                  Your reserve is larger than your actual balance — review allocations
                </p>
              )}
              <p style={{ fontSize: '0.68rem', color: 'var(--text-400)', marginTop: 4 }}>Overall balance − reserve</p>
            </>
          ) : (
            <p style={{ fontSize: '0.78rem', color: 'var(--text-400)', lineHeight: 1.5 }}>
              Set an opening balance to see how much of your money isn&apos;t reserved.
            </p>
          )}
        </div>
      </div>

      {/* ── Actions + health ── */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 16 }}>
        <button
          onClick={() => setModal('in')}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '9px 16px', borderRadius: 'var(--r-md)', border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.8125rem', fontWeight: 700, background: 'var(--brand-600)', color: '#fff' }}
        >
          <ArrowDownToLine size={14} /> Add to Reserve
        </button>
        <button
          onClick={() => setModal('out')}
          disabled={balance <= 0}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '9px 16px', borderRadius: 'var(--r-md)', border: '1px solid var(--border-default)', cursor: balance <= 0 ? 'default' : 'pointer', fontFamily: 'inherit', fontSize: '0.8125rem', fontWeight: 700, background: 'var(--bg-surface)', color: balance <= 0 ? 'var(--text-300)' : 'var(--text-700)' }}
        >
          <ArrowUpFromLine size={14} /> Release from Reserve
        </button>
        {suggestedContribution > 0 && (
          <button
            onClick={() => { setPrefill(suggestedContribution); setModal('in'); }}
            style={{ padding: '6px 12px', borderRadius: 99, border: '1px solid var(--green-200)', cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.72rem', fontWeight: 700, background: 'var(--green-50)', color: 'var(--success-text)' }}
          >
            Add this month&apos;s surplus ({formatCurrency(suggestedContribution, currency)})
          </button>
        )}

        {/* Reserve health */}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
          <ShieldCheck size={15} style={{ color: coverage.status === 'ok' ? 'var(--success-text)' : 'var(--text-300)', flexShrink: 0 }} />
          <div style={{ fontSize: '0.75rem', color: 'var(--text-600)' }}>
            {coverage.status === 'ok' ? (
              <>Reserve coverage: <span className="num-mono" style={{ fontWeight: 800, color: 'var(--text-900)' }}>{coverage.months} months</span></>
            ) : coverage.status === 'no-essential-spend' ? (
              'No essential spending recorded yet'
            ) : (
              'Coverage unlocks after 3 complete months of expense history'
            )}
          </div>
        </div>
      </div>
      <p style={{ fontSize: '0.68rem', color: 'var(--text-400)', marginTop: -10, marginBottom: 16 }}>
        Coverage = available reserve ÷ average essential monthly spending (last 3 complete months, essential categories only).
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 14 }}>
        {/* ── Reserve history ── */}
        <div style={card}>
          <p style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-400)', textTransform: 'uppercase', letterSpacing: '0.09em', marginBottom: 10 }}>
            Reserve history
          </p>
          {history.length === 0 ? (
            <p style={{ fontSize: '0.8125rem', color: 'var(--text-400)', padding: '12px 0' }}>
              Nothing yet — add money to your reserve or mark an expense as reserve-funded.
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2, maxHeight: 340, overflowY: 'auto' }}>
              {history.map(e => (
                <div key={`${e.kind}-${e.refId}`} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 6px', borderRadius: 'var(--r-sm)', fontSize: '0.8125rem' }}>
                  <span className="num-mono" style={{ fontSize: '0.7rem', color: 'var(--text-400)', width: 70, flexShrink: 0 }}>{e.date}</span>
                  <span style={{
                    fontSize: '0.625rem', fontWeight: 800, padding: '1px 7px', borderRadius: 99, flexShrink: 0,
                    background: e.kind === 'spend' ? 'var(--amber-50)' : e.kind === 'in' ? 'var(--green-50)' : 'var(--bg-muted)',
                    color: e.kind === 'spend' ? 'var(--warning-text)' : e.kind === 'in' ? 'var(--success-text)' : 'var(--text-500)',
                    border: `1px solid ${e.kind === 'spend' ? 'var(--amber-200)' : e.kind === 'in' ? 'var(--green-200)' : 'var(--border-default)'}`,
                  }}>
                    {e.kind === 'in' ? 'Added' : e.kind === 'out' ? 'Released' : 'Major expense'}
                  </span>
                  <span style={{ flex: 1, minWidth: 0, color: 'var(--text-700)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {e.label}
                  </span>
                  <span className="num-mono" style={{ fontWeight: 700, color: e.kind === 'in' ? 'var(--success-text)' : 'var(--danger-text)', flexShrink: 0 }}>
                    {e.kind === 'in' ? '+' : '−'}{formatCurrency(e.amount, currency)}
                  </span>
                  <span className="num-mono" style={{ fontSize: '0.7rem', color: 'var(--text-400)', width: 78, textAlign: 'right', flexShrink: 0 }}>
                    {formatCurrency(e.balanceAfter, currency)}
                  </span>
                  {e.kind === 'spend' ? (
                    onNavigate && (
                      <button
                        onClick={() => onNavigate('transactions', 'reserve')}
                        style={{ padding: '3px 8px', borderRadius: 'var(--r-sm)', border: '1px solid var(--border-default)', background: 'var(--bg-surface)', color: 'var(--brand-text)', fontSize: '0.68rem', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0 }}
                      >
                        View
                      </button>
                    )
                  ) : (
                    <span style={{ display: 'inline-flex', gap: 2, flexShrink: 0 }}>
                      <button
                        onClick={() => {
                          const tr = reserveTransfers.find(x => x.id === e.refId);
                          if (tr) setEditing(tr);
                        }}
                        aria-label={`Edit ${e.label}`}
                        style={{ width: 22, height: 22, borderRadius: 6, border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-400)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                      >
                        <Pencil size={11} />
                      </button>
                      <button
                        onClick={() => {
                          const tr = reserveTransfers.find(x => x.id === e.refId);
                          if (tr) { setDeleting(tr); setDeleteError(''); }
                        }}
                        aria-label={`Delete ${e.label}`}
                        style={{ width: 22, height: 22, borderRadius: 6, border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-400)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                      >
                        <Trash2 size={11} />
                      </button>
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Major expenses this year ── */}
        <div style={card}>
          <p style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-400)', textTransform: 'uppercase', letterSpacing: '0.09em', marginBottom: 10 }}>
            Major expenses · {selectedYear}
          </p>
          {majorByCat.length === 0 ? (
            <p style={{ fontSize: '0.8125rem', color: 'var(--text-400)', padding: '12px 0' }}>
              No reserve-funded expenses in {selectedYear} yet. Mark a big expense as paid from reserve to track it here.
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
            </div>
          )}

          <button
            onClick={addMajorCategories}
            disabled={catsAdded}
            style={{ marginTop: 14, display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 'var(--r-sm)', border: '1px dashed var(--border-default)', cursor: catsAdded ? 'default' : 'pointer', fontFamily: 'inherit', fontSize: '0.75rem', fontWeight: 700, background: 'none', color: catsAdded ? 'var(--text-300)' : 'var(--brand-text)' }}
          >
            <Plus size={12} /> {catsAdded ? 'Major-expense categories added' : 'Add major-expense categories'}
          </button>

          {/* Allocations info for the year */}
          {yearBalance && (yearBalance.reserveIn > 0 || yearBalance.reserveOut > 0) && (
            <p style={{ fontSize: '0.72rem', color: 'var(--text-400)', marginTop: 14 }}>
              {selectedYear} allocations (not income/expense): +{formatCurrency(yearBalance.reserveIn, currency)} to reserve, −{formatCurrency(yearBalance.reserveOut, currency)} released.
            </p>
          )}
        </div>
      </div>

      {/* ── Modals ── */}
      {modal && <TransferModal direction={modal} prefillAmount={prefill} onClose={() => { setModal(null); setPrefill(undefined); }} />}
      {editing && <TransferModal direction={editing.direction} initial={editing} onClose={() => setEditing(null)} />}
      {deleting && (
        <div className="sw-overlay" onClick={e => { if (e.target === e.currentTarget) setDeleting(null); }}>
          <div className="sw-modal-box" role="dialog" aria-modal="true" aria-label="Delete transfer" style={{ maxWidth: 400 }}>
            <div style={{ padding: '20px 24px' }}>
              <h2 style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--text-900)', marginBottom: 8 }}>
                Delete this transfer?
              </h2>
              <p style={{ fontSize: '0.8125rem', color: 'var(--text-500)', marginBottom: 8 }}>
                {deleting.direction === 'in' ? 'Added' : 'Released'} {formatCurrency(deleting.amount, currency)} on {deleting.date} — the reserve balance and history will update.
              </p>
              {deleteError && <div role="alert" style={{ fontSize: '0.75rem', color: 'var(--red-500)', fontWeight: 600, marginBottom: 8 }}>{deleteError}</div>}
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 12 }}>
                <button onClick={() => setDeleting(null)} className="ws-cta-btn">Cancel</button>
                <button
                  onClick={() => {
                    const err = deleteReserveTransfer(deleting.id);
                    if (err) { setDeleteError(err); return; }
                    setDeleting(null);
                  }}
                  style={{ padding: '7px 16px', borderRadius: 'var(--r-sm)', border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.8125rem', fontWeight: 700, background: 'var(--red-500)', color: '#fff' }}
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {balanceModal && <OpeningBalanceModal onClose={() => setBalanceModal(false)} />}
    </div>
  );
}
