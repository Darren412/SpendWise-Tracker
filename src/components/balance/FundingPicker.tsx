'use client';

import { X } from 'lucide-react';
import { useBudgetStore } from '@/store/budgetStore';
import { useMajorExpenses } from '@/hooks/useMajorExpenses';
import { validateFunding } from '@/lib/funding';
import { formatCurrency } from '@/utils/currency';
import type { FundingSource } from '@/types';

export const FUNDING_OPTIONS: { value: FundingSource; label: string; helper: string }[] = [
  { value: 'budget', label: 'Monthly Budget', helper: 'Count this expense against this month\u2019s normal spending budget.' },
  { value: 'balance', label: 'Existing / Accumulated Balance', helper: 'Pay this from money you\u2019ve accumulated over time. It reduces your overall balance but doesn\u2019t count against this month\u2019s budget.' },
  { value: 'split', label: 'Split Between Budget & Balance', helper: 'Pay part from this month\u2019s budget and the rest from your existing balance.' },
];

interface FundingPickerProps {
  amount: number;                       // parsed total amount (NaN-safe)
  date: string;
  source: FundingSource;
  balanceAmount: string;                // split balance portion (raw input)
  onChange: (next: { source: FundingSource; balanceAmount: string }) => void;
  excludeExpenseId?: string;            // editing — the txn's own draw is excluded
  error?: string | null;                // external error display
  onError?: (msg: string | null) => void;
  onSetOpeningBalance?: () => void;     // link when no baseline exists
  compact?: boolean;
}

/**
 * "Pay from" radiogroup — Monthly Budget / Existing Balance / Split with live
 * portion split and the available balance on the transaction's date.
 */
export default function FundingPicker({
  amount, date, source, balanceAmount, onChange, excludeExpenseId, error, onError, onSetOpeningBalance, compact,
}: FundingPickerProps) {
  const { currency } = useBudgetStore();
  const { availableOn, hasBaseline } = useMajorExpenses();
  const avail = date ? availableOn(date, { excludeExpenseId }) : null;

  const balancePortion = source === 'balance' ? (Number.isFinite(amount) ? amount : 0)
    : source === 'split' ? (parseFloat(balanceAmount) || 0) : 0;
  const fundingErr = Number.isFinite(amount)
    ? validateFunding({ amount, source, balanceAmount: source === 'split' ? parseFloat(balanceAmount) : undefined })
    : null;
  const budgetPart = Number.isFinite(amount) ? amount - balancePortion : 0;

  return (
    <div>
      <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--text-500)', marginBottom: 6 }}>
        Pay from
      </label>
      <div role="radiogroup" aria-label="Pay from" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {FUNDING_OPTIONS.map(opt => {
          const sel = source === opt.value;
          return (
            <label
              key={opt.value}
              style={{
                display: 'flex', gap: 8, alignItems: 'flex-start', cursor: 'pointer',
                padding: compact ? '7px 10px' : '9px 12px',
                borderRadius: 'var(--r-md)',
                border: sel ? '1.5px solid var(--brand-300)' : '1.5px solid var(--border-default)',
                background: sel ? 'var(--brand-50)' : 'var(--bg-subtle)',
                transition: 'all 0.15s',
              }}
            >
              <input
                type="radio"
                name="funding-source"
                value={opt.value}
                checked={sel}
                onChange={() => { onChange({ source: opt.value, balanceAmount }); onError?.(null); }}
                style={{ marginTop: 2, accentColor: 'var(--brand-600)', flexShrink: 0 }}
              />
              <span style={{ minWidth: 0 }}>
                <span style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 700, color: sel ? 'var(--brand-text)' : 'var(--text-800)' }}>
                  {opt.label}
                </span>
                {!compact && (
                  <span style={{ display: 'block', fontSize: '0.6875rem', color: 'var(--text-400)', lineHeight: 1.45, marginTop: 2 }}>
                    {opt.helper}
                  </span>
                )}
              </span>
            </label>
          );
        })}
      </div>

      {source === 'split' && (
        <div style={{ marginTop: 8, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 120 }}>
            <label htmlFor="funding-balance-amount" style={{ display: 'block', fontSize: '0.6875rem', fontWeight: 700, color: 'var(--text-500)', marginBottom: 4 }}>
              From existing balance
            </label>
            <input
              id="funding-balance-amount"
              type="number" step="0.01" min="0"
              value={balanceAmount}
              onChange={e => { onChange({ source, balanceAmount: e.target.value }); onError?.(null); }}
              placeholder="0.00"
              style={{
                width: '100%', padding: '8px 10px', borderRadius: 'var(--r-sm)',
                border: `1.5px solid ${fundingErr ? 'var(--red-400)' : 'var(--border-default)'}`,
                background: 'var(--bg-surface)', color: 'var(--text-900)',
                fontSize: '0.8125rem', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box',
              }}
            />
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-500)', paddingTop: 18 }}>
            From monthly budget: <span className="num-mono" style={{ fontWeight: 700, color: 'var(--text-800)' }}>{formatCurrency(Math.max(0, budgetPart), currency)}</span>
          </div>
        </div>
      )}

      {(fundingErr || error) && (
        <div role="alert" style={{ fontSize: '0.72rem', color: 'var(--red-500)', marginTop: 6, fontWeight: 600 }}>
          {error || fundingErr}
        </div>
      )}

      {source !== 'budget' && (
        hasBaseline ? (
          <div style={{ fontSize: '0.72rem', color: 'var(--text-400)', marginTop: 6 }}>
            Available balance on {date}:{' '}
            <span className="num-mono" style={{ fontWeight: 700, color: (avail ?? 0) >= balancePortion ? 'var(--success-text)' : 'var(--danger-text)' }}>
              {formatCurrency(avail ?? 0, currency)}
            </span>
          </div>
        ) : (
          <div style={{ fontSize: '0.72rem', color: 'var(--text-400)', marginTop: 6 }}>
            Set an opening balance to see your available balance.{' '}
            {onSetOpeningBalance && (
              <button
                type="button"
                onClick={onSetOpeningBalance}
                style={{ border: 'none', background: 'none', padding: 0, cursor: 'pointer', fontFamily: 'inherit', fontSize: 'inherit', color: 'var(--brand-600)', fontWeight: 700, textDecoration: 'underline' }}
              >
                Set opening balance
              </button>
            )}
          </div>
        )
      )}
    </div>
  );
}

// ── Shortfall dialog ────────────────────────────────────────────────────────

interface ShortfallInfo {
  requested: number;   // balance portion the user tried to spend
  available: number;   // available balance on that date
  date: string;        // 'YYYY-MM-DD' — shown in the message
}

/**
 * Shown when the balance portion requested exceeds the available balance on
 * the transaction date. Only rendered when a baseline exists. Returns the
 * user's choice.
 */
export function BalanceShortfallDialog({
  shortfall,
  currency,
  onUseAvailable,   // () => void — split with balanceAmount = available (0 → budget)
  onChange,         // () => void — back to the form
  onCancel,         // () => void — discard
}: {
  shortfall: ShortfallInfo;
  currency: string;
  onUseAvailable: () => void;
  onChange: () => void;
  onCancel: () => void;
}) {
  const { requested, available, date } = shortfall;
  const budgetRest = Math.max(0, requested - available);
  return (
    <div className="sw-overlay" onClick={e => { if (e.target === e.currentTarget) onCancel(); }}>
      <div className="sw-modal-box" role="dialog" aria-modal="true" aria-label="Not enough in your balance" style={{ maxWidth: 440 }}>
        <div style={{ padding: '20px 24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <h2 style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--text-900)' }}>Not enough in your balance</h2>
            <button onClick={onCancel} className="sw-modal-close" aria-label="Close"><X size={14} /></button>
          </div>
          <p style={{ fontSize: '0.8125rem', color: 'var(--text-600)', lineHeight: 1.55, marginBottom: 16 }}>
            Your available balance on {date} is {formatCurrency(available, currency)}, which is {formatCurrency(requested - available, currency)} less than this expense.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <button
              onClick={onUseAvailable}
              style={{ padding: '10px 14px', borderRadius: 'var(--r-sm)', border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.8125rem', fontWeight: 700, background: 'var(--brand-600)', color: '#fff', textAlign: 'left', lineHeight: 1.4 }}
            >
              Use available balance ({formatCurrency(available, currency)}) and pay {formatCurrency(budgetRest, currency)} from monthly budget
            </button>
            <button
              onClick={onChange}
              style={{ padding: '9px 14px', borderRadius: 'var(--r-sm)', border: '1px solid var(--border-default)', cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.8125rem', fontWeight: 600, background: 'var(--bg-subtle)', color: 'var(--text-700)' }}
            >
              Change funding source
            </button>
            <button
              onClick={onCancel}
              style={{ padding: '9px 14px', borderRadius: 'var(--r-sm)', border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.8125rem', fontWeight: 600, background: 'none', color: 'var(--text-400)' }}
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
