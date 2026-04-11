'use client';

import { useState } from 'react';
import { useBudgetStore } from '@/store/budgetStore';
import { Income } from '@/types';

export default function IncomeForm() {
  const { addIncome } = useBudgetStore();
  const [formData, setFormData] = useState({
    source: '',
    amount: '',
    date: new Date().toISOString().split('T')[0],
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.source || !formData.amount) {
      alert('Please fill in all fields');
      return;
    }

    const d = new Date(formData.date);
    const income: Income = {
      id: Date.now().toString(),
      source: formData.source,
      amount: parseFloat(formData.amount),
      date: formData.date,
      month: String(d.getMonth() + 1).padStart(2, '0'),
      year: d.getFullYear(),
    };

    addIncome(income);
    setFormData({
      source: '',
      amount: '',
      date: new Date().toISOString().split('T')[0],
    });
  };

  return (
    <form onSubmit={handleSubmit} className="dark-card glow-green p-7" style={{ border: '1px solid rgba(5,150,105,0.18)' }}>
      {/* Title */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-1 h-7 rounded-full" style={{ background: 'linear-gradient(180deg, #059669, #047857)' }} />
        <h2 className="graffiti-font text-3xl" style={{ color: '#1e293b' }}>
          ADD INCOME
        </h2>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider mb-2" style={{ color: '#475569' }}>
            Income Source
          </label>
          <input
            type="text"
            value={formData.source}
            onChange={(e) => setFormData({ ...formData, source: e.target.value })}
            placeholder="e.g., Salary, Bonus, Freelance"
            className="dark-input w-full px-4 py-3"
            style={{ '--tw-ring-color': '#34d399' } as React.CSSProperties}
          />
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
        className="btn-neon-green mt-6 w-full py-3 px-4 rounded-xl"
      >
        + Add Income
      </button>
    </form>
  );
}
