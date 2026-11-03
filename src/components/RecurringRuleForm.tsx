'use client';

import { useState } from 'react';
import { RecurrenceFrequency, RecurringRule, TaxInfo, FundingSource } from '@/types';
import { useBudgetStore, generateId } from '@/store/budgetStore';
import CategorySelect from '@/components/CategorySelect';
import DateInput from '@/components/DateInput';
import TaxFields from '@/components/TaxFields';
import FundingPicker from '@/components/balance/FundingPicker';
import { validateFunding } from '@/lib/funding';
import { todayLocalISO } from '@/utils/financialCycle';

const FREQUENCIES: { value: RecurrenceFrequency; label: string }[] = [
  { value: 'weekly',    label: 'Weekly' },
  { value: 'monthly',   label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'yearly',    label: 'Yearly' },
];

interface RecurringRuleFormProps {
  initial?: RecurringRule;          // provided → edit mode
  onSave: (rule: RecurringRule) => void;
  onCancel: () => void;
}

const labelStyle: React.CSSProperties = {
  fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.04em',
  textTransform: 'uppercase', color: 'var(--text-500)',
  display: 'block', marginBottom: 6,
};

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '10px 12px',
  background: 'var(--bg-subtle)',
  border: '1.5px solid var(--border-default)',
  borderRadius: 'var(--r-md)',
  color: 'var(--text-900)', fontSize: '0.875rem',
  fontFamily: 'inherit', outline: 'none',
  boxSizing: 'border-box',
};

export default function RecurringRuleForm({ initial, onSave, onCancel }: RecurringRuleFormProps) {
  const { categories, selectedCity } = useBudgetStore();
  const editing = !!initial;

  const [type, setType] = useState<'expense' | 'income'>(initial?.type ?? 'expense');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [amount, setAmount] = useState(initial ? String(initial.amount) : '');
  const [category, setCategory] = useState(initial?.category ?? '');
  const [frequency, setFrequency] = useState<RecurrenceFrequency>(initial?.frequency ?? 'monthly');
  const [startDate, setStartDate] = useState(initial?.startDate ?? todayLocalISO());
  const [hasEnd, setHasEnd] = useState(!!initial?.endDate);
  const [endDate, setEndDate] = useState(initial?.endDate ?? todayLocalISO());
  const [formCity, setFormCity] = useState(initial?.city ?? (selectedCity === 'Both' ? 'Bangalore' : selectedCity));
  const [tax, setTax] = useState<TaxInfo | undefined>(initial?.tax);
  const [funding, setFunding] = useState<{ source: FundingSource; balanceAmount: string }>({
    // legacy 'reserve' / reserveAmount → 'balance' / balanceAmount
    source: initial?.funding?.source === 'reserve' ? 'balance' : (initial?.funding?.source ?? 'budget'),
    balanceAmount: (initial?.funding?.balanceAmount ?? initial?.funding?.reserveAmount) !== undefined
      ? String(initial!.funding!.balanceAmount ?? initial!.funding!.reserveAmount) : '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const typeCategories = type === 'expense'
    ? categories.filter(c => c.type !== 'income')
    : categories.filter(c => c.type === 'income' || c.type === 'both');

  const validate = (): boolean => {
    const e: Record<string, string> = {};
    const amt = parseFloat(amount);
    if (!description.trim()) e.description = 'Description is required';
    if (!amount || isNaN(amt) || amt <= 0) e.amount = 'Enter an amount greater than 0';
    if (!category) e.category = 'Pick a category';
    if (hasEnd && (!endDate || endDate < startDate)) e.endDate = 'End date must be on or after the start date';
    if (type === 'expense' && !isNaN(amt) && amt > 0) {
      const fErr = validateFunding({
        amount: amt, source: funding.source,
        balanceAmount: funding.source === 'split' ? parseFloat(funding.balanceAmount) : undefined,
      });
      if (fErr) e.funding = fErr;
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!validate()) return;
    onSave({
      id: initial?.id ?? generateId('rec'),
      type,
      amount: parseFloat(amount),
      category,
      description: description.trim(),
      city: type === 'expense' ? (selectedCity === 'Both' ? formCity : selectedCity) : undefined,
      frequency,
      startDate,
      endDate: hasEnd ? endDate : undefined,
      paused: initial?.paused ?? false,
      generatedThrough: initial?.generatedThrough,
      createdAt: initial?.createdAt ?? new Date().toISOString(),
      tax,
      funding: type === 'expense' && funding.source !== 'budget'
        ? funding.source === 'split'
          ? { source: 'split', balanceAmount: parseFloat(funding.balanceAmount) }
          : { source: funding.source }
        : undefined,
    });
  };

  const errorText = (msg?: string) =>
    msg ? <div role="alert" style={{ fontSize: '0.72rem', color: 'var(--red-500)', marginTop: 4 }}>{msg}</div> : null;

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

      {/* Type */}
      <div>
        <label style={labelStyle}>Type</label>
        <div style={{ display: 'flex', gap: 8 }}>
          {(['expense', 'income'] as const).map(t => (
            <button
              key={t}
              type="button"
              onClick={() => { setType(t); setCategory(''); }}
              style={{
                flex: 1, padding: '9px 0', borderRadius: 'var(--r-md)', cursor: 'pointer', fontFamily: 'inherit',
                border: type === t ? '1.5px solid var(--brand-300)' : '1.5px solid var(--border-default)',
                background: type === t ? 'var(--brand-600)' : 'var(--bg-subtle)',
                color: type === t ? '#fff' : 'var(--text-600)',
                fontSize: '0.8125rem', fontWeight: type === t ? 700 : 500,
              }}
            >
              {t === 'expense' ? 'Expense' : 'Income'}
            </button>
          ))}
        </div>
      </div>

      {/* Description / source */}
      <div>
        <label style={labelStyle} htmlFor="rr-desc">{type === 'expense' ? 'Description' : 'Source'}</label>
        <input
          id="rr-desc"
          type="text"
          value={description}
          onChange={e => setDescription(e.target.value)}
          placeholder={type === 'expense' ? 'e.g., Monthly rent' : 'e.g., Monthly salary'}
          style={inputStyle}
        />
        {errorText(errors.description)}
      </div>

      {/* Amount + Frequency */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12 }}>
        <div>
          <label style={labelStyle} htmlFor="rr-amount">Amount</label>
          <input
            id="rr-amount"
            type="number"
            step="0.01"
            value={amount}
            onChange={e => setAmount(e.target.value)}
            placeholder="0.00"
            style={inputStyle}
          />
          {errorText(errors.amount)}
        </div>
        <div>
          <label style={labelStyle} htmlFor="rr-freq">Repeats</label>
          <select
            id="rr-freq"
            value={frequency}
            onChange={e => setFrequency(e.target.value as RecurrenceFrequency)}
            style={inputStyle}
          >
            {FREQUENCIES.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
          </select>
        </div>
      </div>

      {/* Category */}
      <div>
        <label style={labelStyle}>Category</label>
        <CategorySelect
          categories={typeCategories}
          value={category}
          onChange={setCategory}
          placeholder={`Select ${type} category…`}
        />
        {errorText(errors.category)}
      </div>

      {/* Dates */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12 }}>
        <div>
          <label style={labelStyle}>Starts</label>
          <DateInput value={startDate} onChange={setStartDate} style={inputStyle} />
        </div>
        <div>
          <label style={{ ...labelStyle, display: 'flex', alignItems: 'center', gap: 6 }}>
            <input
              type="checkbox"
              checked={hasEnd}
              onChange={e => setHasEnd(e.target.checked)}
              style={{ accentColor: 'var(--brand-600)' }}
            />
            Ends on
          </label>
          {hasEnd && (
            <>
              <DateInput value={endDate} onChange={setEndDate} style={inputStyle} />
              {errorText(errors.endDate)}
            </>
          )}
        </div>
      </div>

      {/* City — only when the account has multiple city options */}
      {type === 'expense' && selectedCity === 'Both' && (
        <div>
          <label style={labelStyle}>City</label>
          <div style={{ display: 'flex', gap: 8 }}>
            {['Bangalore', 'Mangalore'].map(c => (
              <button
                key={c}
                type="button"
                onClick={() => setFormCity(c)}
                style={{
                  flex: 1, padding: '8px 0', borderRadius: 'var(--r-md)', cursor: 'pointer', fontFamily: 'inherit',
                  border: formCity === c ? '1.5px solid var(--brand-300)' : '1.5px solid var(--border-default)',
                  background: formCity === c ? 'var(--brand-600)' : 'var(--bg-subtle)',
                  color: formCity === c ? '#fff' : 'var(--text-600)',
                  fontSize: '0.8125rem', fontWeight: formCity === c ? 700 : 500,
                }}
              >
                {c}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Pay from — expense rules only; generated occurrences copy this */}
      {type === 'expense' && (
        <div>
          <FundingPicker
            amount={parseFloat(amount)}
            date={startDate}
            source={funding.source}
            balanceAmount={funding.balanceAmount}
            onChange={setFunding}
            compact
          />
          {errorText(errors.funding)}
        </div>
      )}

      {/* Tax */}
      <TaxFields value={tax} onChange={setTax} defaultDate={startDate} />

      {/* Actions */}
      <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
        <button
          type="submit"
          style={{
            flex: 1, padding: '11px', borderRadius: 'var(--r-md)', border: 'none',
            background: 'var(--brand-600)', color: '#fff',
            fontSize: '0.875rem', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
          }}
        >
          {editing ? 'Save rule' : 'Create rule'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          style={{
            padding: '11px 18px', borderRadius: 'var(--r-md)',
            background: 'var(--bg-surface)', color: 'var(--text-600)',
            border: '1.5px solid var(--border-default)',
            fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
          }}
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
