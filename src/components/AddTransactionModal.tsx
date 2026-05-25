'use client';

import { useState, useEffect } from 'react';
import { X, Receipt, TrendingUp } from 'lucide-react';
import ExpenseForm from '@/components/ExpenseForm';
import IncomeForm from '@/components/IncomeForm';

interface AddTransactionModalProps {
  open:       boolean;
  defaultTab: 'expense' | 'income';
  onClose:    () => void;
}

export default function AddTransactionModal({ open, defaultTab, onClose }: AddTransactionModalProps) {
  const [tab, setTab] = useState<'expense' | 'income'>(defaultTab);

  useEffect(() => { if (open) setTab(defaultTab); }, [open, defaultTab]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="sw-overlay"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="sw-modal-box">

        {/* ── Header ── */}
        <div style={{ padding: '20px 24px 0' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{
                width: 36,
                height: 36,
                borderRadius: 'var(--r-lg)',
                background: tab === 'expense'
                  ? 'linear-gradient(135deg, var(--red-500), var(--red-600))'
                  : 'linear-gradient(135deg, var(--green-500), var(--green-600))',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: tab === 'expense' ? 'var(--shadow-red)' : 'var(--shadow-green)',
                transition: 'background 0.2s, box-shadow 0.2s',
              }}>
                {tab === 'expense'
                  ? <Receipt size={16} color="#fff" />
                  : <TrendingUp size={16} color="#fff" />
                }
              </div>
              <div>
                <h2 style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text-900)', letterSpacing: '-0.01em' }}>
                  {tab === 'expense' ? 'Add Expense' : 'Add Income'}
                </h2>
                <p style={{ fontSize: '0.72rem', color: 'var(--text-400)', marginTop: 1 }}>
                  {tab === 'expense' ? 'Record a new spending transaction' : 'Record income or inflow'}
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="sw-modal-close"
              aria-label="Close"
            >
              <X size={14} />
            </button>
          </div>

          {/* Tab switcher */}
          <div style={{ display: 'flex', gap: 3, background: 'var(--bg-muted)', padding: 4, borderRadius: 'var(--r-lg)', marginBottom: -1 }}>
            {(['expense', 'income'] as const).map(t => (
              <button
                key={t}
                onClick={() => setTab(t)}
                style={{
                  flex: 1,
                  padding: '8px 0',
                  borderRadius: 'var(--r-md)',
                  border: 'none',
                  fontWeight: 600,
                  fontSize: '0.8125rem',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  transition: 'all 0.15s',
                  background: tab === t ? 'var(--bg-surface)' : 'transparent',
                  color: tab === t
                    ? (t === 'expense' ? 'var(--red-500)' : 'var(--green-600)')
                    : 'var(--text-400)',
                  boxShadow: tab === t ? 'var(--shadow-xs)' : 'none',
                }}
              >
                {t === 'expense' ? '💸 Expense' : '💰 Income'}
              </button>
            ))}
          </div>
        </div>

        {/* ── Form body ── */}
        <div style={{ padding: '20px 24px 24px' }}>
          {tab === 'expense' ? <ExpenseForm /> : <IncomeForm />}
        </div>

      </div>
    </div>
  );
}
