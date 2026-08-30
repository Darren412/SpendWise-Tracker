'use client';

import { useState } from 'react';
import { Settings, Calendar, Info, Check, RotateCcw } from 'lucide-react';
import { useBudgetStore } from '@/store/budgetStore';
import { formatFinancialPeriodRange, cycleDayLabel, getCurrentFinancialPeriod, ordinalSuffix } from '@/utils/financialCycle';

const PRESET_DAYS = [1, 5, 10, 15, 20, 25, 28];

export default function FinancialCycleSettings() {
  const { financialCycleStart, setFinancialCycleStart, selectedMonth, selectedYear } = useBudgetStore();
  const [open, setOpen]         = useState(false);
  const [draft, setDraft]       = useState(financialCycleStart);
  const [showConfirm, setShowConfirm] = useState(false);

  const isDirty      = draft !== financialCycleStart;
  const previewRange = formatFinancialPeriodRange(selectedMonth, selectedYear, draft);
  const currentLabel = cycleDayLabel(financialCycleStart);
  const isCalendar   = financialCycleStart === 1;
  const draftIsCalendar = draft === 1;

  const handleApply = () => {
    if (isDirty) {
      setShowConfirm(true);
    }
  };

  const confirmApply = () => {
    setFinancialCycleStart(draft);
    setShowConfirm(false);
    setOpen(false);
  };

  const handleReset = () => {
    setDraft(financialCycleStart);
    setShowConfirm(false);
  };

  // Preview of what the current period would look like with the new setting
  const currentPeriodWithDraft = getCurrentFinancialPeriod(draft);

  return (
    <div className="dark-card p-0 overflow-hidden">
      {/* ── Collapsed header ── */}
      <button
        onClick={() => { setOpen(o => !o); setDraft(financialCycleStart); setShowConfirm(false); }}
        className="w-full flex items-center justify-between px-5 py-4 transition-colors"
        style={{ background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left' }}
      >
        <div className="flex items-center gap-3">
          <div className="icon-pill" style={{ background: '#f5f3ff' }}>
            <Settings size={14} color="#7c3aed" />
          </div>
          <div>
            <p className="card-header-label mb-0">Financial Cycle</p>
            <p className="text-xs" style={{ color: '#9ca3af' }}>
              {isCalendar
                ? 'Standard calendar month (1st – last)'
                : `Salary cycle · starts ${currentLabel}`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {!isCalendar && (
            <span className="badge" style={{ background: '#f5f3ff', color: '#7c3aed', border: '1px solid #ddd6fe' }}>
              {financialCycleStart}th cycle
            </span>
          )}
          <svg
            width="16" height="16" viewBox="0 0 24 24" fill="none"
            stroke="#9ca3af" strokeWidth="2"
            style={{ transform: open ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform 0.2s' }}
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </div>
      </button>

      {/* ── Expanded panel ── */}
      {open && (
        <div className="px-5 pb-5 space-y-4" style={{ borderTop: '1px solid #f0f2f5' }}>

          {/* Info callout */}
          <div className="flex gap-2.5 mt-4 p-3 rounded-xl" style={{ background: '#fffbeb', border: '1px solid #fde68a' }}>
            <Info size={14} style={{ color: '#d97706', flexShrink: 0, marginTop: 1 }} />
            <p className="text-xs" style={{ color: '#92400e', lineHeight: 1.6 }}>
              This sets the day of the month when your financial period resets.
              {' '}Setting it to <strong>25</strong> means your &quot;July&quot; financial period runs from
              {' '}<strong>Jun 25 → Jul 24</strong>, matching a salary received on the 25th.
              {' '}Changing this will re-assign all existing expenses and income to the correct financial period.
            </p>
          </div>

          {/* Day picker — preset chips */}
          <div>
            <p className="card-header-label mb-2">Cycle Start Day</p>
            <div className="flex flex-wrap gap-2">
              {PRESET_DAYS.map(d => {
                const isSelected = draft === d;
                return (
                  <button
                    key={d}
                    onClick={() => setDraft(d)}
                    className="px-4 py-2 rounded-xl text-xs font-bold transition-all"
                    style={{
                      background:  isSelected ? '#7c3aed' : '#f4f6f9',
                      color:       isSelected ? '#fff'    : '#374151',
                      border:      isSelected ? '1px solid #7c3aed' : '1px solid #e8ecf0',
                      cursor: 'pointer',
                    }}
                  >
                    {d === 1 ? '1st (Calendar)' : `${d}${ordinalSuffix(d)}`}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Custom day number input */}
          <div>
            <p className="card-header-label mb-2">Custom Day (1–28)</p>
            <input
              type="number"
              min={1}
              max={28}
              value={draft}
              onChange={e => {
                const n = parseInt(e.target.value, 10);
                if (!isNaN(n)) setDraft(Math.min(28, Math.max(1, n)));
              }}
              className="dark-input px-3 py-2.5"
              style={{ width: 100 }}
            />
          </div>

          {/* Live preview */}
          <div className="rounded-xl p-3" style={{ background: '#f8fafc', border: '1px solid #e8ecf0' }}>
            <div className="flex items-center gap-2 mb-2">
              <Calendar size={13} style={{ color: '#6b7280' }} />
              <p className="text-xs font-semibold" style={{ color: '#374151' }}>Period preview</p>
            </div>
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs" style={{ color: '#9ca3af' }}>Selected month view</span>
                <span className="text-xs font-bold" style={{ color: draftIsCalendar ? '#6b7280' : '#7c3aed' }}>
                  {previewRange}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs" style={{ color: '#9ca3af' }}>Current period would be</span>
                <span className="text-xs font-bold" style={{ color: '#374151' }}>
                  {formatFinancialPeriodRange(currentPeriodWithDraft.month, currentPeriodWithDraft.year, draft)}
                </span>
              </div>
            </div>
          </div>

          {/* Confirm dialog */}
          {showConfirm && (
            <div className="rounded-xl p-4 space-y-3" style={{ background: '#fef2f2', border: '1px solid #fecaca' }}>
              <p className="text-xs font-semibold" style={{ color: '#7f1d1d' }}>
                ⚠️ This will re-assign ALL existing expenses and income to their correct financial period based on the <strong>{cycleDayLabel(draft)}</strong> cycle. This cannot be undone.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={confirmApply}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold"
                  style={{ background: '#7c3aed', color: '#fff', border: 'none', cursor: 'pointer' }}
                >
                  <Check size={12} /> Apply & Migrate
                </button>
                <button
                  onClick={() => setShowConfirm(false)}
                  className="px-4 py-2 rounded-lg text-xs font-semibold"
                  style={{ background: '#f4f6f9', color: '#374151', border: '1px solid #e8ecf0', cursor: 'pointer' }}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Apply / Reset buttons */}
          {!showConfirm && (
            <div className="flex gap-2 pt-1">
              <button
                onClick={handleApply}
                disabled={!isDirty}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold transition-all"
                style={{
                  background: isDirty ? '#7c3aed' : '#e8ecf0',
                  color:      isDirty ? '#fff'    : '#9ca3af',
                  border: 'none', cursor: isDirty ? 'pointer' : 'default',
                }}
              >
                <Check size={12} /> Apply
              </button>
              <button
                onClick={handleReset}
                disabled={!isDirty}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold transition-all"
                style={{
                  background: '#f4f6f9', color: isDirty ? '#374151' : '#9ca3af',
                  border: '1px solid #e8ecf0', cursor: isDirty ? 'pointer' : 'default',
                }}
              >
                <RotateCcw size={11} /> Reset
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
