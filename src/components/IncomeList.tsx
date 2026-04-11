'use client';

import { useBudgetStore } from '@/store/budgetStore';
import { Trash2 } from 'lucide-react';

export default function IncomeList() {
  const { deleteIncome, getIncomeByMonth, selectedMonth, selectedYear } =
    useBudgetStore();

  const monthIncome = getIncomeByMonth(selectedMonth, selectedYear);

  if (monthIncome.length === 0) {
    return (
      <div className="dark-card glow-green p-8" style={{ border: '1px solid rgba(5,150,105,0.15)' }}>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-1 h-7 rounded-full" style={{ background: 'linear-gradient(180deg, #059669, #047857)' }} />
          <h2 className="graffiti-font text-3xl" style={{ color: '#1e293b' }}>INCOME RECORDS</h2>
        </div>
        <p className="text-center py-8 font-medium" style={{ color: '#94a3b8' }}>
          No income recorded yet for this month.
        </p>
      </div>
    );
  }

  return (
    <div className="dark-card glow-green p-8" style={{ border: '1px solid rgba(5,150,105,0.15)' }}>
      <div className="flex items-center gap-3 mb-6">
        <div className="w-1 h-7 rounded-full" style={{ background: 'linear-gradient(180deg, #059669, #047857)' }} />
        <h2 className="graffiti-font text-3xl" style={{ color: '#1e293b' }}>INCOME RECORDS</h2>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full dark-table">
          <thead>
            <tr>
              <th className="text-left">Source</th>
              <th className="text-left">Date</th>
              <th className="text-right">Amount</th>
              <th className="text-center">Action</th>
            </tr>
          </thead>
          <tbody>
            {monthIncome.map((inc) => (
              <tr key={inc.id}>
                <td className="font-medium" style={{ color: '#1e293b' }}>{inc.source}</td>
                <td style={{ color: '#64748b' }}>{new Date(inc.date).toLocaleDateString()}</td>
                <td className="text-right font-bold font-mono" style={{ color: '#059669' }}>
                  +₹{inc.amount.toFixed(2)}
                </td>
                <td className="text-center">
                  <button
                    onClick={() => deleteIncome(inc.id)}
                    className="inline-flex items-center justify-center w-8 h-8 rounded-lg transition-all hover:scale-110"
                    style={{ color: '#fb7185', background: 'rgba(251,113,133,0.08)', border: '1px solid rgba(251,113,133,0.2)' }}
                  >
                    <Trash2 size={16} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
