'use client';

import { useMemo, useState } from 'react';
import { X, Wallet, AlertTriangle } from 'lucide-react';
import { useBudgetStore } from '@/store/budgetStore';
import { defaultEffectiveDate, validateBaseline, BaselineErrors } from '@/lib/balance';
import { currencySymbol } from '@/utils/currency';
import { getCurrentFinancialPeriod } from '@/utils/financialCycle';
import DateInput from '@/components/DateInput';

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '9px 12px', borderRadius: 'var(--r-sm)',
  border: '1.5px solid var(--border-default)', background: 'var(--bg-surface)',
  color: 'var(--text-900)', fontSize: '0.875rem', fontFamily: 'inherit', outline: 'none',
  boxSizing: 'border-box',
};

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: '0.6875rem', fontWeight: 700, color: 'var(--text-400)',
  textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 5,
};

/**
 * Set/edit the annual opening balance. The effective date re-defaults to the
 * January financial-period start whenever the year changes, unless the user
 * already picked a custom date.
 */
export default function OpeningBalanceModal({ onClose }: { onClose: () => void }) {
  const {
    openingBalance, setOpeningBalance, clearOpeningBalance,
    expenses, income, financialCycleStart, currency,
  } = useBudgetStore();
  const isEdit = !!openingBalance;
  const sym = currencySymbol(currency);

  const yearOptions = useMemo(() => {
    const set = new Set<number>();
    expenses.forEach(e => set.add(e.year));
    income.forEach(i => set.add(i.year));
    set.add(getCurrentFinancialPeriod(financialCycleStart).year);
    if (openingBalance) set.add(openingBalance.startYear);
    return [...set].sort((a, b) => b - a);
  }, [expenses, income, financialCycleStart, openingBalance]);

  const [startYear, setStartYear] = useState(
    openingBalance?.startYear ?? getCurrentFinancialPeriod(financialCycleStart).year
  );
  const [amountStr, setAmountStr] = useState(openingBalance ? String(openingBalance.amount) : '');
  const [effectiveDate, setEffectiveDate] = useState(
    openingBalance?.effectiveDate ?? defaultEffectiveDate(startYear, financialCycleStart)
  );
  const [dateTouched, setDateTouched] = useState(isEdit);
  const [errors, setErrors] = useState<BaselineErrors>({});
  const [confirmRemove, setConfirmRemove] = useState(false);

  const amount = parseFloat(amountStr);

  const changeYear = (y: number) => {
    setStartYear(y);
    if (!dateTouched) setEffectiveDate(defaultEffectiveDate(y, financialCycleStart));
  };
  const changeDate = (iso: string) => { setEffectiveDate(iso); setDateTouched(true); };

  const save = () => {
    const input = { startYear, amount, effectiveDate };
    const errs = validateBaseline(input, financialCycleStart);
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;
    setOpeningBalance(input);
    onClose();
  };

  return (
    <div className="sw-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="sw-modal-box" role="dialog" aria-modal="true" aria-label={isEdit ? 'Edit opening balance' : 'Set opening balance'} style={{ maxWidth: 440 }}>
        <div style={{ padding: '20px 24px 24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 34, height: 34, borderRadius: 'var(--r-md)', background: 'var(--brand-50)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Wallet size={15} style={{ color: 'var(--brand-600)' }} />
              </div>
              <h2 style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--text-900)' }}>
                {isEdit ? 'Edit opening balance' : 'Set opening balance'}
              </h2>
            </div>
            <button onClick={onClose} className="sw-modal-close" aria-label="Close"><X size={14} /></button>
          </div>

          <p style={{ fontSize: '0.78rem', color: 'var(--text-500)', marginBottom: 14, lineHeight: 1.5 }}>
            Money you already had available at the start — it is not counted as income.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
            <div>
              <label htmlFor="ob-year" style={labelStyle}>Starting year</label>
              <select
                id="ob-year"
                value={startYear}
                onChange={e => changeYear(parseInt(e.target.value, 10))}
                style={{ ...inputStyle, borderColor: errors.startYear ? 'var(--red-400)' : 'var(--border-default)' }}
              >
                {yearOptions.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
              {errors.startYear && <div style={{ fontSize: '0.72rem', color: 'var(--red-500)', marginTop: 4 }}>{errors.startYear}</div>}
            </div>
            <div>
              <label htmlFor="ob-amount" style={labelStyle}>Opening balance</label>
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', fontSize: '0.8125rem', fontWeight: 700, color: 'var(--text-400)' }}>
                  {sym}
                </span>
                <input
                  id="ob-amount"
                  type="number" step="any"
                  value={amountStr}
                  onChange={e => setAmountStr(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') save(); }}
                  placeholder="0"
                  autoFocus
                  style={{ ...inputStyle, paddingLeft: 26, borderColor: errors.amount ? 'var(--red-400)' : 'var(--border-default)' }}
                />
              </div>
              {errors.amount && <div style={{ fontSize: '0.72rem', color: 'var(--red-500)', marginTop: 4 }}>{errors.amount}</div>}
            </div>
          </div>

          <div style={{ marginBottom: 8 }}>
            <label style={labelStyle}>Effective date</label>
            <DateInput value={effectiveDate} onChange={changeDate} style={{ ...inputStyle, borderColor: errors.effectiveDate ? 'var(--red-400)' : 'var(--border-default)' }} />
            {errors.effectiveDate
              ? <div style={{ fontSize: '0.72rem', color: 'var(--red-500)', marginTop: 4 }}>{errors.effectiveDate}</div>
              : <div style={{ fontSize: '0.7rem', color: 'var(--text-300)', marginTop: 4 }}>Transactions dated before this are ignored by balances.</div>}
          </div>

          {Number.isFinite(amount) && amount < 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: '0.75rem', color: 'var(--warning-text)', background: 'var(--amber-50)', border: '1px solid var(--amber-200)', borderRadius: 'var(--r-sm)', padding: '8px 10px', marginBottom: 4 }}>
              <AlertTriangle size={13} style={{ flexShrink: 0 }} />
              Starting in deficit — a negative opening balance.
            </div>
          )}

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
            {isEdit && (
              <button
                onClick={() => setConfirmRemove(true)}
                style={{ marginRight: 'auto', padding: '8px 12px', borderRadius: 'var(--r-sm)', border: '1px solid var(--red-200)', background: 'var(--red-50)', color: 'var(--red-600)', fontFamily: 'inherit', fontSize: '0.8125rem', fontWeight: 700, cursor: 'pointer' }}
              >
                Remove opening balance
              </button>
            )}
            <button onClick={onClose} className="ws-cta-btn">Cancel</button>
            <button
              onClick={save}
              style={{ padding: '8px 18px', borderRadius: 'var(--r-sm)', border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.8125rem', fontWeight: 700, background: 'var(--brand-600)', color: '#fff' }}
            >
              Save
            </button>
          </div>
        </div>
      </div>

      {/* Remove confirm */}
      {confirmRemove && (
        <div className="sw-overlay" onClick={e => { if (e.target === e.currentTarget) setConfirmRemove(false); }}>
          <div className="sw-modal-box" role="dialog" aria-modal="true" aria-label="Remove opening balance" style={{ maxWidth: 400 }}>
            <div style={{ padding: '20px 24px' }}>
              <h2 style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--text-900)', marginBottom: 8 }}>
                Remove opening balance?
              </h2>
              <p style={{ fontSize: '0.8125rem', color: 'var(--text-500)', marginBottom: 16 }}>
                Balances will no longer be shown. Your transactions are unaffected.
              </p>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button onClick={() => setConfirmRemove(false)} className="ws-cta-btn">Cancel</button>
                <button
                  onClick={() => { clearOpeningBalance(); onClose(); }}
                  style={{ padding: '7px 16px', borderRadius: 'var(--r-sm)', border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.8125rem', fontWeight: 700, background: 'var(--red-500)', color: '#fff' }}
                >
                  Remove
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
