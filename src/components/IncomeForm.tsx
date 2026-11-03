'use client';

import { useState } from 'react';
import { useBudgetStore, generateId } from '@/store/budgetStore';
import { Income, RecurrenceFrequency, RecurringRule, TaxInfo } from '@/types';
import CategorySelect from '@/components/CategorySelect';
import DateInput from '@/components/DateInput';
import TaxFields from '@/components/TaxFields';
import { todayLocalISO } from '@/utils/financialCycle';
import { ChevronDown } from 'lucide-react';

export default function IncomeForm() {
  const { addIncome, addRecurringRule, categories } = useBudgetStore();

  const incomeCategories = categories.filter(c => c.type === 'income' || c.type === 'both');
  const defaultIncomeCatId = incomeCategories[0]?.id ?? '';

  const [formData, setFormData] = useState({
    category: defaultIncomeCatId,
    source:   '',
    amount:   '',
    date:     todayLocalISO(),
  });

  // Collapsible "More details" — notes, repeat, tax
  const [showMore, setShowMore] = useState(false);
  const [notes, setNotes] = useState('');
  const [repeat, setRepeat] = useState(false);
  const [frequency, setFrequency] = useState<RecurrenceFrequency>('monthly');
  const [hasEnd, setHasEnd] = useState(false);
  const [endDate, setEndDate] = useState(todayLocalISO());
  const [tax, setTax] = useState<TaxInfo | undefined>(undefined);
  const [error, setError] = useState('');

  const resetMore = () => {
    setNotes(''); setRepeat(false); setFrequency('monthly');
    setHasEnd(false); setTax(undefined); setError('');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsedAmount = parseFloat(formData.amount);
    if (!formData.amount || isNaN(parsedAmount) || parsedAmount <= 0) {
      setError('Please enter a valid amount greater than 0.');
      return;
    }
    if (repeat && hasEnd && endDate < formData.date) {
      setError('Repeat end date must be on or after the transaction date.');
      return;
    }
    setError('');

    const resolvedSource = formData.source.trim()
      || (incomeCategories.find(c => c.id === formData.category)?.name ?? 'Income');

    if (repeat) {
      // runRecurringGeneration (inside addRecurringRule) creates the first
      // occurrence exactly once — do NOT also addIncome.
      const rule: RecurringRule = {
        id: generateId('rec'),
        type: 'income',
        amount: parsedAmount,
        category: formData.category || '',
        description: resolvedSource,
        frequency,
        startDate: formData.date,
        endDate: hasEnd ? endDate : undefined,
        paused: false,
        createdAt: new Date().toISOString(),
        tax,
      };
      addRecurringRule(rule);
    } else {
      const [yearStr, monthStr] = formData.date.split('-');
      const income: Income = {
        id:       generateId('inc'),
        source:   resolvedSource,
        amount:   parsedAmount,
        date:     formData.date,
        month:    monthStr,
        year:     parseInt(yearStr, 10),
        category: formData.category || undefined,
        notes:    notes.trim() || undefined,
        tax,
      };
      addIncome(income);
    }

    setFormData({
      category: defaultIncomeCatId,
      source:   '',
      amount:   '',
      date:     todayLocalISO(),
    });
    resetMore();
  };

  const labelStyle: React.CSSProperties = {
    fontSize: '0.72rem',
    fontWeight: 700,
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
    color: 'var(--text-500)',
    display: 'block',
    marginBottom: 6,
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '10px 12px',
    background: 'var(--bg-subtle)',
    border: '1.5px solid var(--border-default)',
    borderRadius: 'var(--r-md)',
    color: 'var(--text-900)',
    fontSize: '0.875rem',
    fontFamily: 'inherit',
    outline: 'none',
    transition: 'all 0.15s',
  };

  const focusInput = (e: React.FocusEvent<HTMLInputElement>) => {
    e.target.style.background = 'var(--bg-surface)';
    e.target.style.borderColor = 'var(--brand-500)';
    e.target.style.boxShadow = '0 0 0 3px rgba(99,102,241,0.1)';
  };
  const blurInput = (e: React.FocusEvent<HTMLInputElement>) => {
    e.target.style.background = 'var(--bg-subtle)';
    e.target.style.borderColor = 'var(--border-default)';
    e.target.style.boxShadow = 'none';
  };

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* Income category */}
      <div>
        <label style={labelStyle}>Income Type</label>
        <CategorySelect
          categories={incomeCategories}
          value={formData.category}
          onChange={id => setFormData({ ...formData, category: id })}
          placeholder="Select income type…"
        />
      </div>

      {/* Source */}
      <div>
        <label style={labelStyle}>
          Source{' '}
          <span style={{ fontWeight: 400, color: 'var(--text-400)', textTransform: 'none', letterSpacing: 0 }}>(optional)</span>
        </label>
        <input
          type="text"
          value={formData.source}
          onChange={e => setFormData({ ...formData, source: e.target.value })}
          placeholder="e.g., Acme Corp, Client A…"
          style={inputStyle}
          onFocus={focusInput}
          onBlur={blurInput}
        />
      </div>

      {/* Amount + Date */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12 }}>
        <div>
          <label style={labelStyle}>Amount</label>
          <input
            type="number"
            step="0.01"
            value={formData.amount}
            onChange={e => setFormData({ ...formData, amount: e.target.value })}
            placeholder="0.00"
            style={inputStyle}
            onFocus={focusInput}
            onBlur={blurInput}
          />
        </div>
        <div>
          <label style={labelStyle}>Date</label>
          <DateInput
            value={formData.date}
            onChange={date => setFormData({ ...formData, date })}
            style={inputStyle}
          />
        </div>
      </div>

      {/* ── More details (notes, repeat, tax) ── */}
      <div>
        <button
          type="button"
          onClick={() => setShowMore(v => !v)}
          aria-expanded={showMore}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            background: 'none', border: 'none', padding: 0, cursor: 'pointer',
            fontSize: '0.78rem', fontWeight: 700, color: 'var(--brand-600)',
            fontFamily: 'inherit',
          }}
        >
          <ChevronDown size={13} style={{ transform: showMore ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }} />
          {showMore ? 'Fewer details' : 'More details'}
        </button>

        {showMore && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 14, paddingTop: 14, borderTop: '1px dashed var(--border-default)' }}>
            {/* Notes */}
            <div>
              <label style={labelStyle}>Notes <span style={{ fontWeight: 400, color: 'var(--text-400)', textTransform: 'none', letterSpacing: 0 }}>(optional)</span></label>
              <input
                type="text"
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Any extra detail…"
                style={inputStyle}
                onFocus={focusInput}
                onBlur={blurInput}
              />
            </div>

            {/* Repeat */}
            <div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', userSelect: 'none' }}>
                <input
                  type="checkbox"
                  checked={repeat}
                  onChange={e => setRepeat(e.target.checked)}
                  style={{ width: 15, height: 15, accentColor: 'var(--brand-600)', cursor: 'pointer' }}
                />
                <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-700)' }}>
                  Repeat this income
                </span>
              </label>
              {repeat && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10, marginTop: 10 }}>
                  <div>
                    <label style={labelStyle} htmlFor="inc-freq">Repeats</label>
                    <select
                      id="inc-freq"
                      value={frequency}
                      onChange={e => setFrequency(e.target.value as RecurrenceFrequency)}
                      style={inputStyle}
                    >
                      <option value="weekly">Weekly</option>
                      <option value="monthly">Monthly</option>
                      <option value="quarterly">Quarterly</option>
                      <option value="yearly">Yearly</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ ...labelStyle, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <input type="checkbox" checked={hasEnd} onChange={e => setHasEnd(e.target.checked)} style={{ accentColor: 'var(--brand-600)' }} />
                      Ends on
                    </label>
                    {hasEnd && <DateInput value={endDate} onChange={setEndDate} style={inputStyle} />}
                  </div>
                </div>
              )}
            </div>

            {/* Tax */}
            <TaxFields value={tax} onChange={setTax} defaultDate={formData.date} />
          </div>
        )}
      </div>

      {/* Inline validation message */}
      {error && (
        <div role="alert" style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--red-500)', marginTop: -4 }}>
          {error}
        </div>
      )}

      <button
        type="submit"
        style={{
          width: '100%',
          padding: '12px',
          borderRadius: 'var(--r-md)',
          border: 'none',
          background: 'var(--green-600)',
          color: '#fff',
          fontSize: '0.9rem',
          fontWeight: 700,
          cursor: 'pointer',
          fontFamily: 'inherit',
          boxShadow: 'var(--shadow-green)',
          transition: 'background 0.15s, transform 0.1s',
          marginTop: 2,
        }}
        onMouseEnter={e => {
          (e.currentTarget.style.background = 'var(--green-700)');
          (e.currentTarget.style.transform = 'translateY(-1px)');
        }}
        onMouseLeave={e => {
          (e.currentTarget.style.background = 'var(--green-600)');
          (e.currentTarget.style.transform = 'none');
        }}
      >
        {repeat ? 'Add recurring income' : 'Add Income'}
      </button>
    </form>
  );
}
