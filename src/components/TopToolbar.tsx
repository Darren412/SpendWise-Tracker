'use client';

import { useState, useRef, useEffect } from 'react';
import {
  ChevronLeft, ChevronRight, Plus,
  FileSpreadsheet, ChevronDown, RotateCcw, Cloud, Loader2,
} from 'lucide-react';
import { useBudgetStore } from '@/store/budgetStore';
import { useAuth } from '@/components/AuthProvider';
import { currencies } from '@/utils/currency';
import {
  formatFinancialPeriodRange,
  getCurrentFinancialPeriod,
} from '@/utils/financialCycle';
import CategoryFilterBar from '@/components/CategoryFilterBar';

interface TopToolbarProps {
  onAddExpense: () => void;
  onAddIncome:  () => void;
  onExport:     () => void;
}

export default function TopToolbar({ onAddExpense, onAddIncome, onExport }: TopToolbarProps) {
  const {
    selectedMonth, selectedYear, setSelectedMonth, setSelectedYear,
    selectedCity, setSelectedCity,
    currency, setCurrency,
    setExcludedCategoryIds,
    financialCycleStart,
    syncing,
  } = useBudgetStore();
  const { user } = useAuth();

  const [showCurrency, setShowCurrency] = useState(false);
  const currencyRef = useRef<HTMLDivElement>(null);

  const isDarren = user?.email === 'darren412@gmail.com';
  const cities   = ['Bangalore', 'Mangalore', 'Both'];
  const months   = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const selectedM = parseInt(selectedMonth);

  const periodRange  = formatFinancialPeriodRange(selectedMonth, selectedYear, financialCycleStart);
  const currentPeriod = getCurrentFinancialPeriod(financialCycleStart);
  const isCurrentPeriod = selectedM === parseInt(currentPeriod.month) && selectedYear === currentPeriod.year;

  const prevMonth = () => {
    let m = selectedM - 1, y = selectedYear;
    if (m < 1) { m = 12; y -= 1; }
    setSelectedMonth(m.toString().padStart(2, '0'));
    setSelectedYear(y);
  };
  const nextMonth = () => {
    let m = selectedM + 1, y = selectedYear;
    if (m > 12) { m = 1; y += 1; }
    setSelectedMonth(m.toString().padStart(2, '0'));
    setSelectedYear(y);
  };
  const jumpNow = () => {
    setSelectedMonth(currentPeriod.month);
    setSelectedYear(currentPeriod.year);
  };

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (currencyRef.current && !currencyRef.current.contains(e.target as Node))
        setShowCurrency(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const currConfig = currencies.find(c => c.code === currency) ?? currencies[0];

  return (
    <div className="sw-toolbar">

      {/* ── Period navigation ── */}
      <div className="sw-tb-period">
        <button className="sw-tb-nav-btn" onClick={prevMonth} aria-label="Previous month">
          <ChevronLeft size={12} />
        </button>
        <div className="sw-tb-period-text">
          <span className="sw-tb-period-main">{months[selectedM - 1]} {selectedYear}</span>
          <span className="sw-tb-period-sub">{periodRange}</span>
        </div>
        <button className="sw-tb-nav-btn" onClick={nextMonth} aria-label="Next month">
          <ChevronRight size={12} />
        </button>
        {!isCurrentPeriod && (
          <button
            onClick={jumpNow}
            style={{
              fontSize: '0.6875rem',
              fontWeight: 700,
              color: 'var(--brand-600)',
              background: 'var(--brand-50)',
              border: '1px solid var(--brand-200)',
              borderRadius: 6,
              padding: '3px 9px',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              flexShrink: 0,
              fontFamily: 'inherit',
              transition: 'background 0.15s',
            }}
          >
            Today
          </button>
        )}
      </div>

      <div className="sw-toolbar-sep" />

      {/* ── City toggle (Darren only) ── */}
      {isDarren && (
        <>
          <div className="sw-tb-toggle">
            {cities.map(c => (
              <button
                key={c}
                className={`sw-tb-toggle-btn${selectedCity === c ? ' active' : ''}`}
                onClick={() => setSelectedCity(c)}
              >
                {c}
              </button>
            ))}
          </div>
          <div className="sw-toolbar-sep" />
        </>
      )}

      {/* ── Category filter ── */}
      <CategoryFilterBar />

      <div className="sw-toolbar-sep" />

      {/* ── Currency picker ── */}
      <div style={{ position: 'relative', flexShrink: 0 }} ref={currencyRef}>
        <button
          className="sw-tb-btn"
          onClick={() => setShowCurrency(v => !v)}
          style={{ gap: 4 }}
        >
          <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--text-500)' }}>{currConfig.symbol}</span>
          <span>{currConfig.code}</span>
          <ChevronDown
            size={10}
            style={{
              color: 'var(--text-400)',
              transition: 'transform 0.2s',
              transform: showCurrency ? 'rotate(180deg)' : 'none',
            }}
          />
        </button>

        {showCurrency && (
          <div
            style={{
              position: 'fixed',
              top: 'auto',
              left: 'auto',
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-default)',
              borderRadius: 'var(--r-lg)',
              boxShadow: '0 12px 40px rgba(0,0,0,0.14), 0 4px 16px rgba(0,0,0,0.08)',
              minWidth: 150,
              zIndex: 9999,
              overflow: 'hidden',
              marginTop: 4,
            }}
          >
            {currencies.map(c => (
              <button
                key={c.code}
                onClick={() => { setCurrency(c.code); setShowCurrency(false); }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  width: '100%',
                  textAlign: 'left',
                  padding: '9px 14px',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '0.8125rem',
                  fontFamily: 'inherit',
                  background: c.code === currency ? 'var(--brand-50)' : 'transparent',
                  color: c.code === currency ? 'var(--brand-600)' : 'var(--text-700)',
                  fontWeight: c.code === currency ? 700 : 400,
                  transition: 'background 0.12s',
                }}
                onMouseEnter={e => { if (c.code !== currency) e.currentTarget.style.background = 'var(--bg-muted)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = c.code === currency ? 'var(--brand-50)' : 'transparent'; }}
              >
                <span style={{ width: 22, fontSize: '0.875rem', fontWeight: 700, opacity: 0.6 }}>{c.symbol}</span>
                <span>{c.code}</span>
                {c.code === currency && (
                  <span style={{ marginLeft: 'auto', fontSize: '0.75rem', color: 'var(--brand-600)' }}>✓</span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── Spacer ── */}
      <div style={{ flex: 1, minWidth: 8 }} />

      {/* ── Sync indicator ── */}
      {syncing ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.75rem', color: 'var(--text-400)', flexShrink: 0 }}>
          <Loader2 size={12} className="animate-spin" />
          <span className="hidden sm:inline">Syncing</span>
        </div>
      ) : (
        <div title="All changes synced" style={{ display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0 }}>
          <Cloud size={13} style={{ color: 'var(--green-500)' }} />
          <span className="hidden sm:inline" style={{ fontSize: '0.6875rem', fontWeight: 600, color: 'var(--green-600)' }}>Synced</span>
        </div>
      )}

      <div className="sw-toolbar-sep" />

      {/* ── Reset filters ── */}
      <button
        className="sw-tb-btn"
        onClick={() => setExcludedCategoryIds([])}
        title="Reset all filters"
      >
        <RotateCcw size={11} style={{ color: 'var(--text-400)' }} />
        <span className="hidden sm:inline">Reset</span>
      </button>

      {/* ── Quick actions ── */}
      <button className="sw-tb-btn primary" onClick={onAddExpense}>
        <Plus size={12} /> Expense
      </button>
      <button className="sw-tb-btn green" onClick={onAddIncome}>
        <Plus size={12} /> Income
      </button>
      <button className="sw-tb-btn" onClick={onExport}>
        <FileSpreadsheet size={12} style={{ color: 'var(--green-500)' }} />
        <span className="hidden sm:inline">Export</span>
      </button>

    </div>
  );
}
