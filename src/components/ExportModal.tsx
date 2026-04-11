'use client';

import { useState } from 'react';
import { X, FileSpreadsheet, Calendar, CalendarDays, CalendarRange, Database } from 'lucide-react';
import { useBudgetStore } from '@/store/budgetStore';
import { exportToExcel, ExportFilter } from '@/utils/exportToExcel';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

type Scope = 'current-month' | 'choose-month' | 'choose-day' | 'choose-year' | 'all';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export default function ExportModal({ isOpen, onClose }: Props) {
  const { expenses, income, categories, selectedMonth, selectedYear } = useBudgetStore();

  const [scope, setScope] = useState<Scope>('current-month');
  const [chosenMonth, setChosenMonth] = useState(selectedMonth);
  const [chosenYear, setChosenYear]   = useState(selectedYear);
  const [chosenDay, setChosenDay]     = useState(() => new Date().toISOString().split('T')[0]);
  const [chosenYearOnly, setChosenYearOnly] = useState(selectedYear);

  // All years present in data
  const availableYears = [
    ...new Set([...expenses.map(e => e.year), ...income.map(i => i.year)]),
  ].sort((a, b) => b - a);
  if (availableYears.length === 0) availableYears.push(selectedYear);

  const handleExport = () => {
    let filter: ExportFilter;

    if (scope === 'current-month') {
      filter = { scope: 'month', month: selectedMonth, year: selectedYear };
    } else if (scope === 'choose-month') {
      filter = { scope: 'month', month: chosenMonth, year: chosenYear };
    } else if (scope === 'choose-day') {
      filter = { scope: 'day', date: chosenDay };
    } else if (scope === 'choose-year') {
      filter = { scope: 'year', year: chosenYearOnly };
    } else {
      filter = { scope: 'all' };
    }

    exportToExcel(expenses, income, categories, filter);
    onClose();
  };

  if (!isOpen) return null;

  const currentMonthLabel = `${MONTH_NAMES[parseInt(selectedMonth) - 1]} ${selectedYear}`;

  const options: { id: Scope; icon: React.ReactNode; label: string; sub?: React.ReactNode }[] = [
    {
      id: 'current-month',
      icon: <Calendar size={16} />,
      label: `Current Month — ${currentMonthLabel}`,
    },
    {
      id: 'choose-month',
      icon: <CalendarRange size={16} />,
      label: 'Specific Month',
      sub: (
        <div className="flex gap-2 mt-2 ml-6">
          <select
            className="dark-select text-sm rounded-lg px-3 py-1.5 flex-1"
            value={chosenMonth}
            onChange={e => setChosenMonth(e.target.value)}
          >
            {MONTH_NAMES.map((name, i) => (
              <option key={i} value={String(i + 1).padStart(2, '0')}>{name}</option>
            ))}
          </select>
          <select
            className="dark-select text-sm rounded-lg px-3 py-1.5 w-24"
            value={chosenYear}
            onChange={e => setChosenYear(Number(e.target.value))}
          >
            {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      ),
    },
    {
      id: 'choose-day',
      icon: <CalendarDays size={16} />,
      label: 'Specific Day',
      sub: (
        <div className="mt-2 ml-6">
          <input
            type="date"
            className="dark-input text-sm rounded-lg px-3 py-1.5 w-full"
            value={chosenDay}
            onChange={e => setChosenDay(e.target.value)}
          />
        </div>
      ),
    },
    {
      id: 'choose-year',
      icon: <CalendarRange size={16} />,
      label: 'Full Year',
      sub: (
        <div className="mt-2 ml-6">
          <select
            className="dark-select text-sm rounded-lg px-3 py-1.5 w-28"
            value={chosenYearOnly}
            onChange={e => setChosenYearOnly(Number(e.target.value))}
          >
            {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      ),
    },
    {
      id: 'all',
      icon: <Database size={16} />,
      label: 'All Data',
    },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)' }}
    >
      <div
        className="dark-card w-full max-w-md rounded-2xl shadow-2xl"
        style={{ border: '1px solid rgba(255,255,255,0.08)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-white/8">
          <div className="flex items-center gap-2.5">
            <span className="flex items-center justify-center w-8 h-8 rounded-lg" style={{ background: 'rgba(5,150,105,0.15)' }}>
              <FileSpreadsheet size={17} color="#059669" />
            </span>
            <span className="font-semibold text-[15px]" style={{ color: '#f0f0f0' }}>
              Export to Excel
            </span>
          </div>
          <button
            onClick={onClose}
            className="flex items-center justify-center w-7 h-7 rounded-lg transition-colors hover:bg-white/10"
            style={{ color: '#999' }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-1.5">
          <p className="text-xs mb-4" style={{ color: '#888' }}>
            Choose what data to include in the export.
          </p>

          {options.map(opt => (
            <div key={opt.id}>
              <label
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer transition-colors"
                style={{
                  background: scope === opt.id ? 'rgba(5,150,105,0.1)' : 'transparent',
                  border: scope === opt.id ? '1px solid rgba(5,150,105,0.25)' : '1px solid transparent',
                }}
                onClick={() => setScope(opt.id)}
              >
                <input
                  type="radio"
                  name="export-scope"
                  className="accent-emerald-500"
                  checked={scope === opt.id}
                  onChange={() => setScope(opt.id)}
                  onClick={e => e.stopPropagation()}
                />
                <span
                  className="flex items-center gap-2 text-sm font-medium"
                  style={{ color: scope === opt.id ? '#34d399' : '#ccc' }}
                >
                  {opt.icon}
                  {opt.label}
                </span>
              </label>
              {scope === opt.id && opt.sub && (
                <div className="px-3 pb-1">{opt.sub}</div>
              )}
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-white/8">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm font-medium transition-colors hover:bg-white/10"
            style={{ color: '#999', border: '1px solid rgba(255,255,255,0.1)' }}
          >
            Cancel
          </button>
          <button
            onClick={handleExport}
            className="flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold transition-all"
            style={{
              background: '#059669',
              color: '#fff',
              boxShadow: '0 2px 8px rgba(5,150,105,0.3)',
            }}
          >
            <FileSpreadsheet size={15} />
            Export
          </button>
        </div>
      </div>
    </div>
  );
}
