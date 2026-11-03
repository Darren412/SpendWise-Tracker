'use client';

import { X } from 'lucide-react';
import { useBudgetStore } from '@/store/budgetStore';
import { useReserve } from '@/hooks/useReserve';
import { validateFunding } from '@/lib/reserve';
import { formatCurrency } from '@/utils/currency';
import type { FundingSource } from '@/types';

export const FUNDING_OPTIONS: { value: FundingSource; label: string; helper: string }[] = [
  { value: 'budget', label: 'Monthly Budget', helper: 'Count this expense against this month\u2019s normal spending budget.' },
  { value: 'reserve', label: 'Reserve / Saved Money', helper: 'Pay this expense from your accumulated savings. It will reduce your overall balance but will not affect your monthly budget.' },
  { value: 'split', label: 'Split Between Budget & Reserve', helper: 'Pay part of this expense from your monthly budget and the remaining amount from your reserve.' },
];

interface FundingPickerProps {
  amount: number;                       // parsed total amount (NaN-safe)
  date: string;
  source: FundingSource;
  reserveAmount: string;                // split reserve portion (raw input)
  onChange: (next: { source: FundingSource; reserveAmount: string }) => void;
  excludeExpenseId?: string;            // editing — the txn's own draw is excluded
  error?: string | null;                // external error display
  onError?: (msg: string | null) => void;
  compact?: boolean;
}

/**
 * "Pay from" radiogroup — Monthly Budget / Reserve / Split with live portion
 * split and the reserve available on the transaction's date.
 */
export default function FundingPicker({
  amount, date, source, reserveAmount, onChange, excludeExpenseId, error, onError, compact,
}: FundingPickerProps) {
  const { currency } = useBudgetStore();
  const { availableOn } = useReserve();
  const avail = date ? availableOn(date, { excludeExpenseId }) : 0;

  const reservePortion = source === 'reserve' ? (Number.isFinite(amount) ? amount : 0)
    : source === 'split' ? (parseFloat(reserveAmount) || 0) : 0;
  const fundingErr = Number.isFinite(amount)
    ? validateFunding({ amount, source, reserveAmount: source === 'split' ? parseFloat(reserveAmount) : undefined })
    : null;
  const budgetPart = Number.isFinite(amount) ? amount - reservePortion : 0;

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
                onChange={() => { onChange({ source: opt.value, reserveAmount }); onError?.(null); }}
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
            <label htmlFor="funding-reserve-amount" style={{ display: 'block', fontSize: '0.6875rem', fontWeight: 700, color: 'var(--text-500)', marginBottom: 4 }}>
              From reserve
            </label>
            <input
              id="funding-reserve-amount"
              type="number" step="0.01" min="0"
              value={reserveAmount}
              onChange={e => { onChange({ source, reserveAmount: e.target.value }); onError?.(null); }}
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
        <div style={{ fontSize: '0.72rem', color: 'var(--text-400)', marginTop: 6 }}>
          Reserve available on {date}: <span className="num-mono" style={{ fontWeight: 700, color: avail >= reservePortion ? 'var(--success-text)' : 'var(--danger-text)' }}>{formatCurrency(avail, currency)}</span>
        </div>
      )}
    </div>
  );
}

// ── Shortfall dialog ────────────────────────────────────────────────────────

interface ShortfallInfo {
  requested: number;   // reserve portion the user tried to spend
  available: number;   // reserve available on that date
}

/**
 * Shown when the reserve portion requested exceeds the reserve available.
 * Returns the user's choice.
 */
export function ReserveShortfallDialog({
  shortfall,
  currency,
  onUseAvailable,   // () => void — split with reserveAmount = available (0 → budget)
  onChange,         // () => void — back to the form
  onCancel,         // () => void — discard
}: {
  shortfall: ShortfallInfo;
  currency: string;
  onUseAvailable: () => void;
  onChange: () => void;
  onCancel: () => void;
}) {
  const { requested, available } = shortfall;
  const budgetRest = Math.max(0, requested - available);
  return (
    <div className="sw-overlay" onClick={e => { if (e.target === e.currentTarget) onCancel(); }}>
      <div className="sw-modal-box" role="dialog" aria-modal="true" aria-label="Not enough in reserve" style={{ maxWidth: 440 }}>
        <div style={{ padding: '20px 24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <h2 style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--text-900)' }}>Not enough in reserve</h2>
            <button onClick={onCancel} className="sw-modal-close" aria-label="Close"><X size={14} /></button>
          </div>
          <p style={{ fontSize: '0.8125rem', color: 'var(--text-600)', lineHeight: 1.55, marginBottom: 16 }}>
            Your available reserve is {formatCurrency(available, currency)}, which is {formatCurrency(requested - available, currency)} less than this expense.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <button
              onClick={onUseAvailable}
              style={{ padding: '10px 14px', borderRadius: 'var(--r-sm)', border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.8125rem', fontWeight: 700, background: 'var(--brand-600)', color: '#fff', textAlign: 'left', lineHeight: 1.4 }}
            >
              Use available reserve ({formatCurrency(available, currency)}) and pay {formatCurrency(budgetRest, currency)} from monthly budget
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
