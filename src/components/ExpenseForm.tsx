'use client';

import { useState } from 'react';
import { useBudgetStore, generateId } from '@/store/budgetStore';
import { Expense } from '@/types';
import CategorySelect from '@/components/CategorySelect';
import DateInput from '@/components/DateInput';

export default function ExpenseForm() {
  const { addExpense, categories, selectedCity } = useBudgetStore();
  const effectiveCity = selectedCity === 'Both' ? 'Bangalore' : selectedCity;
  const [formCity, setFormCity] = useState(effectiveCity);

  const expenseCategories = categories.filter(c => c.type !== 'income');
  const defaultCatId = expenseCategories[0]?.id ?? '';

  const [formData, setFormData] = useState({
    category:    defaultCatId,
    description: '',
    amount:      '',
    date:        new Date().toISOString().split('T')[0],
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsedAmount = parseFloat(formData.amount);
    if (!formData.category || !formData.description || !formData.amount || isNaN(parsedAmount) || parsedAmount <= 0) {
      alert('Please fill in all fields with valid values');
      return;
    }
    const [yearStr, monthStr] = formData.date.split('-');
    const expense: Expense = {
      id:          generateId('exp'),
      category:    formData.category,
      description: formData.description,
      amount:      parsedAmount,
      date:        formData.date,
      month:       monthStr,
      year:        parseInt(yearStr, 10),
      city:        selectedCity === 'Both' ? formCity : selectedCity,
    };
    addExpense(expense);
    setFormData({
      category:    expenseCategories[0]?.id ?? '',
      description: '',
      amount:      '',
      date:        new Date().toISOString().split('T')[0],
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

      {/* City (Darren only) */}
      {selectedCity === 'Both' && (
        <div>
          <label style={labelStyle}>City</label>
          <div style={{ display: 'flex', gap: 8 }}>
            {['Bangalore', 'Mangalore'].map(c => (
              <button
                key={c}
                type="button"
                onClick={() => setFormCity(c)}
                style={{
                  flex: 1,
                  padding: '9px 0',
                  borderRadius: 'var(--r-md)',
                  border: formCity === c ? '1.5px solid var(--brand-300)' : '1.5px solid var(--border-default)',
                  background: formCity === c ? 'var(--brand-600)' : 'var(--bg-subtle)',
                  color: formCity === c ? '#fff' : 'var(--text-600)',
                  fontSize: '0.8125rem',
                  fontWeight: formCity === c ? 700 : 500,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  transition: 'all 0.15s',
                }}
              >
                {c}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Category */}
      <div>
        <label style={labelStyle}>Category</label>
        <CategorySelect
          categories={expenseCategories}
          value={formData.category}
          onChange={id => setFormData({ ...formData, category: id })}
          placeholder="Select expense category…"
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

      {/* Description */}
      <div>
        <label style={labelStyle}>Description</label>
        <input
          type="text"
          value={formData.description}
          onChange={e => setFormData({ ...formData, description: e.target.value })}
          placeholder="e.g., Weekly groceries"
          style={inputStyle}
          onFocus={focusInput}
          onBlur={blurInput}
        />
      </div>

      <button
        type="submit"
        style={{
          width: '100%',
          padding: '12px',
          borderRadius: 'var(--r-md)',
          border: 'none',
          background: 'var(--red-500)',
          color: '#fff',
          fontSize: '0.9rem',
          fontWeight: 700,
          cursor: 'pointer',
          fontFamily: 'inherit',
          boxShadow: 'var(--shadow-red)',
          transition: 'background 0.15s, transform 0.1s, box-shadow 0.15s',
          marginTop: 2,
        }}
        onMouseEnter={e => {
          (e.currentTarget.style.background = 'var(--red-600)');
          (e.currentTarget.style.transform = 'translateY(-1px)');
        }}
        onMouseLeave={e => {
          (e.currentTarget.style.background = 'var(--red-500)');
          (e.currentTarget.style.transform = 'none');
        }}
      >
        Add Expense
      </button>
    </form>
  );
}
