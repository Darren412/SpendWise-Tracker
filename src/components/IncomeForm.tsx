'use client';

import { useState } from 'react';
import { useBudgetStore, generateId } from '@/store/budgetStore';
import { Income } from '@/types';
import CategorySelect from '@/components/CategorySelect';
import DateInput from '@/components/DateInput';

export default function IncomeForm() {
  const { addIncome, categories } = useBudgetStore();

  const incomeCategories = categories.filter(c => c.type === 'income' || c.type === 'both');
  const defaultIncomeCatId = incomeCategories[0]?.id ?? '';

  const [formData, setFormData] = useState({
    category: defaultIncomeCatId,
    source:   '',
    amount:   '',
    date:     new Date().toISOString().split('T')[0],
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsedAmount = parseFloat(formData.amount);
    if (!formData.amount || isNaN(parsedAmount) || parsedAmount <= 0) { alert('Please enter a valid amount'); return; }

    const [yearStr, monthStr] = formData.date.split('-');
    const income: Income = {
      id:       generateId('inc'),
      source:   formData.source || (incomeCategories.find(c => c.id === formData.category)?.name ?? 'Income'),
      amount:   parsedAmount,
      date:     formData.date,
      month:    monthStr,
      year:     parseInt(yearStr, 10),
      category: formData.category || undefined,
    };

    addIncome(income);
    setFormData({
      category: defaultIncomeCatId,
      source:   '',
      amount:   '',
      date:     new Date().toISOString().split('T')[0],
    });
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
    e.target.style.background = '#fff';
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
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
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
        Add Income
      </button>
    </form>
  );
}
