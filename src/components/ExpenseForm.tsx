'use client';

import { useState } from 'react';
import { useBudgetStore } from '@/store/budgetStore';
import { Expense } from '@/types';

export default function ExpenseForm() {
  const { addExpense, categories, selectedCity } = useBudgetStore();
  const effectiveCity = selectedCity === 'Both' ? 'Bangalore' : selectedCity;
  const [formCity, setFormCity] = useState(effectiveCity);
  const [formData, setFormData] = useState({
    category: categories[0]?.id || '',
    description: '',
    amount: '',
    date: new Date().toISOString().split('T')[0],
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.category || !formData.description || !formData.amount) {
      alert('Please fill in all fields');
      return;
    }

    const [yearStr, monthStr] = formData.date.split('-');
    const expense: Expense = {
      id: Date.now().toString(),
      category: formData.category,
      description: formData.description,
      amount: parseFloat(formData.amount),
      date: formData.date,
      month: monthStr,
      year: parseInt(yearStr, 10),
      city: selectedCity === 'Both' ? formCity : selectedCity,
    };

    addExpense(expense);
    setFormData({
      category: categories[0]?.id || 'food',
      description: '',
      amount: '',
      date: new Date().toISOString().split('T')[0],
    });
  };

  return (
    <form onSubmit={handleSubmit} className="dark-card glow-pink p-7" style={{ border: '1px solid rgba(225,29,72,0.18)' }}>
      {/* Title */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-1 h-7 rounded-full" style={{ background: 'linear-gradient(180deg, #e11d48, #be123c)' }} />
        <h2 className="graffiti-font text-3xl" style={{ color: '#1e293b' }}>
          ADD EXPENSE
        </h2>
      </div>

      <div className="space-y-4">
        {selectedCity === 'Both' && (
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider mb-2" style={{ color: '#475569' }}>
              City
            </label>
            <div className="flex gap-2">
              {['Bangalore', 'Mangalore'].map(c => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setFormCity(c)}
                  className="flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all"
                  style={{
                    background: formCity === c ? '#e11d48' : '#f1f5f9',
                    color: formCity === c ? '#fff' : '#64748b',
                    border: `1px solid ${formCity === c ? '#e11d48' : '#e2e8f0'}`,
                  }}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>
        )}
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider mb-2" style={{ color: '#475569' }}>
            Category
          </label>
          <select
            value={formData.category}
            onChange={(e) => setFormData({ ...formData, category: e.target.value })}
            className="dark-select w-full px-4 py-3"
          >
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.icon} {cat.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-bold uppercase tracking-wider mb-2" style={{ color: '#475569' }}>
            Amount
          </label>
          <input
            type="number"
            step="0.01"
            value={formData.amount}
            onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
            placeholder="0.00"
            className="dark-input w-full px-4 py-3"
          />
        </div>

        <div>
          <label className="block text-xs font-bold uppercase tracking-wider mb-2" style={{ color: '#475569' }}>
            Description
          </label>
          <input
            type="text"
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            placeholder="e.g., Weekly groceries"
            className="dark-input w-full px-4 py-3"
          />
        </div>

        <div>
          <label className="block text-xs font-bold uppercase tracking-wider mb-2" style={{ color: '#475569' }}>
            Date
          </label>
          <input
            type="date"
            value={formData.date}
            onChange={(e) => setFormData({ ...formData, date: e.target.value })}
            className="dark-input w-full px-4 py-3"
          />
        </div>
      </div>

      <button
        type="submit"
        className="btn-neon-pink mt-6 w-full py-3 px-4 rounded-xl"
      >
        + Add Expense
      </button>
    </form>
  );
}
