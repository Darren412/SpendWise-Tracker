'use client';

import { useBudgetStore } from '@/store/budgetStore';
import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react';

export default function MonthYearFilter() {
  const { selectedMonth, selectedYear, setSelectedMonth, setSelectedYear } = useBudgetStore();

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];

  const currentDate = new Date();
  const currentMonth = currentDate.getMonth() + 1;
  const currentYear = currentDate.getFullYear();

  const handlePrevMonth = () => {
    let month = parseInt(selectedMonth) - 1;
    let year = selectedYear;
    if (month < 1) { month = 12; year -= 1; }
    setSelectedMonth(month.toString().padStart(2, '0'));
    setSelectedYear(year);
  };

  const handleNextMonth = () => {
    let month = parseInt(selectedMonth) + 1;
    let year = selectedYear;
    if (month > 12) { month = 1; year += 1; }
    setSelectedMonth(month.toString().padStart(2, '0'));
    setSelectedYear(year);
  };

  const isCurrentMonth = parseInt(selectedMonth) === currentMonth && selectedYear === currentYear;

  return (
    <div className="dark-card px-6 py-4 flex items-center justify-between gap-4">
      <button
        onClick={handlePrevMonth}
        className="p-2 rounded-lg transition-colors hover:bg-slate-100"
        style={{ color: '#64748b' }}
        aria-label="Previous month"
      >
        <ChevronLeft size={20} />
      </button>

      <div className="flex items-center gap-3">
        <div className="p-1.5 rounded-lg" style={{ background: '#eef2ff' }}>
          <Calendar size={16} color="#6366f1" />
        </div>
        <div className="text-center">
          <p className="text-xl font-bold tracking-tight" style={{ color: '#0f172a' }}>
            {monthNames[parseInt(selectedMonth) - 1]} {selectedYear}
          </p>
          {isCurrentMonth && (
            <p className="text-xs font-semibold" style={{ color: '#6366f1' }}>
              Current Month
            </p>
          )}
        </div>
      </div>

      <button
        onClick={handleNextMonth}
        className="p-2 rounded-lg transition-colors hover:bg-slate-100"
        style={{ color: '#64748b' }}
        aria-label="Next month"
      >
        <ChevronRight size={20} />
      </button>
    </div>
  );
}

