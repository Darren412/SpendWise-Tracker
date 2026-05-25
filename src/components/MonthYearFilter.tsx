'use client';

import { useBudgetStore } from '@/store/budgetStore';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { formatFinancialPeriodRange, getCurrentFinancialPeriod } from '@/utils/financialCycle';

export default function MonthYearFilter() {
  const { selectedMonth, selectedYear, setSelectedMonth, setSelectedYear, financialCycleStart } = useBudgetStore();

  const monthNames     = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const fullMonthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];

  const handlePrev = () => {
    let m = parseInt(selectedMonth) - 1, y = selectedYear;
    if (m < 1) { m = 12; y -= 1; }
    setSelectedMonth(m.toString().padStart(2, '0')); setSelectedYear(y);
  };
  const handleNext = () => {
    let m = parseInt(selectedMonth) + 1, y = selectedYear;
    if (m > 12) { m = 1; y += 1; }
    setSelectedMonth(m.toString().padStart(2, '0')); setSelectedYear(y);
  };
  const goToMonth = (m: number) => setSelectedMonth(m.toString().padStart(2, '0'));

  const selectedM = parseInt(selectedMonth);

  // Financial-cycle aware "current" period
  const currentPeriod    = getCurrentFinancialPeriod(financialCycleStart);
  const isCurrentPeriod  = selectedM === parseInt(currentPeriod.month) && selectedYear === currentPeriod.year;
  const currentPeriodM   = parseInt(currentPeriod.month);
  const currentPeriodY   = currentPeriod.year;

  // Date range label for the selected period
  const periodRange      = formatFinancialPeriodRange(selectedMonth, selectedYear, financialCycleStart);
  const isCustomCycle    = financialCycleStart > 1;

  return (
    <div className="dark-card p-4">
      <div className="flex items-center justify-between gap-4">
        {/* Prev */}
        <button onClick={handlePrev} className="p-2 rounded-lg transition-colors hover:bg-slate-100 flex-shrink-0" style={{ color: '#6b7280' }} aria-label="Previous month">
          <ChevronLeft size={18} />
        </button>

        {/* Month chips */}
        <div className="flex items-center gap-1 flex-wrap justify-center flex-1 min-w-0">
          {monthNames.map((name, i) => {
            const m = i + 1;
            const isSelected = m === selectedM;
            const isCurrent  = m === currentPeriodM && selectedYear === currentPeriodY;
            return (
              <button
                key={m}
                onClick={() => goToMonth(m)}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                style={{
                  background: isSelected ? '#4f46e5' : isCurrent ? '#eef2ff' : 'transparent',
                  color: isSelected ? '#fff' : isCurrent ? '#4f46e5' : '#6b7280',
                  border: isSelected ? '1px solid #4f46e5' : isCurrent ? '1px solid #c7d2fe' : '1px solid transparent',
                }}
              >
                {name}
              </button>
            );
          })}
        </div>

        {/* Next */}
        <button onClick={handleNext} className="p-2 rounded-lg transition-colors hover:bg-slate-100 flex-shrink-0" style={{ color: '#6b7280' }} aria-label="Next month">
          <ChevronRight size={18} />
        </button>
      </div>

      {/* Selected period label */}
      <div className="mt-3 flex items-center justify-center gap-2 flex-wrap">
        <span className="text-sm font-semibold" style={{ color: '#111827' }}>
          {fullMonthNames[selectedM - 1]} {selectedYear}
        </span>
        {isCustomCycle && (
          <span className="text-xs" style={{ color: '#9ca3af' }}>
            {periodRange}
          </span>
        )}
        {isCurrentPeriod && (
          <span className="badge badge-purple">Current Period</span>
        )}
      </div>
    </div>
  );
}

