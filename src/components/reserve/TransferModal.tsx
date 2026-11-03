'use client';

import { useState } from 'react';
import { X } from 'lucide-react';
import { useBudgetStore } from '@/store/budgetStore';
import { useReserve } from '@/hooks/useReserve';
import { ReserveTransfer } from '@/lib/reserve';
import { formatCurrency } from '@/utils/currency';
import { todayLocalISO } from '@/utils/financialCycle';
import DateInput from '@/components/DateInput';

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '9px 12px', borderRadius: 'var(--r-sm)',
  border: '1.5px solid var(--border-default)', background: 'var(--bg-surface)',
  color: 'var(--text-900)', fontSize: '0.8125rem', fontFamily: 'inherit', outline: 'none',
  boxSizing: 'border-box',
};
const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: '0.6875rem', fontWeight: 700, color: 'var(--text-400)',
  textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 5,
};


export function TransferModal({
  direction, initial, prefillAmount, onClose,
}: {
  direction: 'in' | 'out';
  initial?: ReserveTransfer;
  prefillAmount?: number;
  onClose: () => void;
}) {
  const { addReserveTransfer, updateReserveTransfer, currency, openingBalance } = useBudgetStore();
  const { availableOn, unallocated } = useReserve();
  const editing = !!initial;
  const dir = initial?.direction ?? direction;

  const [date, setDate] = useState(initial?.date ?? todayLocalISO());
  const [amount, setAmount] = useState(initial ? String(initial.amount) : prefillAmount ? String(prefillAmount) : '');
  const [note, setNote] = useState(initial?.note ?? '');
  const [error, setError] = useState('');

  const save = () => {
    const amt = parseFloat(amount);
    if (!date || !Number.isFinite(amt) || amt <= 0) {
      setError('Enter a date and an amount greater than 0.');
      return;
    }
    // 'in' allocations are bounded by the unallocated balance — with no
    // baseline there's nothing to bound against, so it's allowed with a note
    if (dir === 'in' && openingBalance && unallocated !== null) {
      const headroom = unallocated + (editing && initial!.direction === 'in' ? initial!.amount : 0);
      if (amt > headroom) {
        setError(`Only ${formatCurrency(Math.max(0, headroom), currency)} is unallocated and available to move into the reserve.`);
        return;
      }
    }
    const err = editing && initial
      ? updateReserveTransfer(initial.id, { date, amount: amt, note: note.trim() || undefined })
      : addReserveTransfer({ date, amount: amt, direction: dir, note: note.trim() || undefined });
    if (err) { setError(err); return; }
    onClose();
  };

  return (
    <div className="sw-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="sw-modal-box" role="dialog" aria-modal="true"
        aria-label={editing ? 'Edit transfer' : dir === 'in' ? 'Add to reserve' : 'Release from reserve'}
        style={{ maxWidth: 420 }}>
        <div style={{ padding: '20px 24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <h2 style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--text-900)' }}>
              {editing ? 'Edit transfer' : dir === 'in' ? 'Add to Reserve' : 'Release from Reserve'}
            </h2>
            <button onClick={onClose} className="sw-modal-close" aria-label="Close"><X size={14} /></button>
          </div>

          <p style={{ fontSize: '0.75rem', color: 'var(--text-500)', marginBottom: 14, lineHeight: 1.5 }}>
            {dir === 'in'
              ? 'Moving money into your reserve is an allocation of money you already have — it isn\u2019t income or an expense.'
              : 'Releasing money from your reserve makes it part of your regular balance again — it isn\u2019t income or an expense.'}
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
            <div>
              <label style={labelStyle}>Date</label>
              <DateInput value={date} onChange={setDate} style={inputStyle} />
            </div>
            <div>
              <label htmlFor="rt-amount" style={labelStyle}>Amount</label>
              <input
                id="rt-amount" type="number" step="0.01" min="0" autoFocus
                value={amount} onChange={e => { setAmount(e.target.value); setError(''); }}
                onKeyDown={e => { if (e.key === 'Enter') save(); }}
                placeholder="0.00" style={inputStyle}
              />
            </div>
          </div>
          <div style={{ marginBottom: 8 }}>
            <label htmlFor="rt-note" style={labelStyle}>Note <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(optional)</span></label>
            <input
              id="rt-note" type="text" value={note} onChange={e => setNote(e.target.value)}
              placeholder="e.g., Saving for a car" style={inputStyle}
            />
          </div>

          {dir === 'out' && !editing && (
            <div style={{ fontSize: '0.72rem', color: 'var(--text-400)', marginBottom: 6 }}>
              Available to release on {date}: <span className="num-mono" style={{ fontWeight: 700, color: 'var(--text-800)' }}>{formatCurrency(availableOn(date), currency)}</span>
            </div>
          )}
          {dir === 'in' && !openingBalance && (
            <div style={{ fontSize: '0.72rem', color: 'var(--text-400)', marginBottom: 6 }}>
              No opening balance set — amounts can&apos;t be checked against your actual balance.
            </div>
          )}

          {error && <div role="alert" style={{ fontSize: '0.75rem', color: 'var(--red-500)', fontWeight: 600, marginBottom: 8 }}>{error}</div>}

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 10 }}>
            <button onClick={onClose} className="ws-cta-btn">Cancel</button>
            <button
              onClick={save}
              style={{ padding: '8px 18px', borderRadius: 'var(--r-sm)', border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.8125rem', fontWeight: 700, background: 'var(--brand-600)', color: '#fff' }}
            >
              {editing ? 'Save' : dir === 'in' ? 'Add to reserve' : 'Release'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

