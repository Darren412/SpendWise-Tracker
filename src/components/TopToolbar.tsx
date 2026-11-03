'use client';

import { useState, useRef, useEffect } from 'react';
import {
  ChevronLeft, ChevronRight, Plus,
  FileSpreadsheet, ChevronDown, RotateCcw, Cloud, Loader2,
  Sun, Moon, Monitor, MoreHorizontal,
} from 'lucide-react';
import { useBudgetStore } from '@/store/budgetStore';
import { useAuth } from '@/components/AuthProvider';
import { useTheme } from '@/hooks/useTheme';
import { currencies } from '@/utils/currency';
import {
  formatFinancialPeriodRange,
  getCurrentFinancialPeriod,
} from '@/utils/financialCycle';
import CategoryFilterBar from '@/components/CategoryFilterBar';
import type { ThemePreference } from '@/lib/theme';

const THEME_ORDER: ThemePreference[] = ['light', 'dark', 'system'];
const nextTheme = (p: ThemePreference): ThemePreference =>
  THEME_ORDER[(THEME_ORDER.indexOf(p) + 1) % THEME_ORDER.length];

const ThemeIcon = ({ preference, resolved }: { preference: ThemePreference; resolved: 'light' | 'dark' }) =>
  preference === 'system' ? <Monitor size={13} /> : resolved === 'dark' ? <Moon size={13} /> : <Sun size={13} />;

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
  const { preference: themePreference, resolved: resolvedTheme, setPreference: setThemePreference } = useTheme();

  const [showCurrency, setShowCurrency] = useState(false);
  const currencyRef = useRef<HTMLDivElement>(null);
  const [showOverflow, setShowOverflow] = useState(false);
  const overflowRef = useRef<HTMLDivElement>(null);

  const themeLabel = themePreference === 'system' ? 'System' : themePreference === 'dark' ? 'Dark' : 'Light';
  const themeAriaLabel = `Theme: ${themeLabel}. Change theme`;
  const cycleTheme = () => setThemePreference(nextTheme(themePreference));

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
      if (overflowRef.current && !overflowRef.current.contains(e.target as Node))
        setShowOverflow(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  useEffect(() => {
    if (!showOverflow) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setShowOverflow(false); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [showOverflow]);

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

      <div className="sw-toolbar-sep sw-desktop-only" />

      {/* ── City toggle (Darren only) ── */}
      {isDarren && (
        <>
          <div className="sw-tb-toggle sw-desktop-only">
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
          <div className="sw-toolbar-sep sw-desktop-only" />
        </>
      )}

      {/* ── Category filter ── */}
      <div className="sw-desktop-only" style={{ display: 'contents' }}>
        <CategoryFilterBar />
      </div>

      <div className="sw-toolbar-sep sw-desktop-only" />

      {/* ── Currency picker ── */}
      <div style={{ position: 'relative', flexShrink: 0 }} ref={currencyRef} className="sw-desktop-only">
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

      <div className="sw-toolbar-sep sw-desktop-only" />

      {/* ── Reset filters ── */}
      <button
        className="sw-tb-btn sw-desktop-only"
        onClick={() => setExcludedCategoryIds([])}
        title="Reset all filters"
      >
        <RotateCcw size={11} style={{ color: 'var(--text-400)' }} />
        <span className="hidden sm:inline">Reset</span>
      </button>

      {/* ── Quick actions ── */}
      <button className="sw-tb-btn primary" onClick={onAddExpense} aria-label="Add expense">
        <Plus size={12} /> <span className="sw-tb-btn-label">Expense</span>
      </button>
      <button className="sw-tb-btn green" onClick={onAddIncome} aria-label="Add income">
        <Plus size={12} /> <span className="sw-tb-btn-label">Income</span>
      </button>
      <button className="sw-tb-btn sw-desktop-only" onClick={onExport}>
        <FileSpreadsheet size={12} style={{ color: 'var(--green-500)' }} />
        <span className="hidden sm:inline">Export</span>
      </button>

      {/* ── Theme toggle ── */}
      <button
        className="sw-tb-btn sw-desktop-only"
        onClick={cycleTheme}
        aria-label={themeAriaLabel}
        title={themeAriaLabel}
      >
        <ThemeIcon preference={themePreference} resolved={resolvedTheme} />
      </button>

      {/* ── Mobile overflow menu ── */}
      <div className="sw-tb-overflow sw-mobile-only" ref={overflowRef}>
        <button
          className="sw-tb-overflow-btn"
          onClick={() => setShowOverflow(v => !v)}
          aria-label="More toolbar options"
          aria-expanded={showOverflow}
        >
          <MoreHorizontal size={15} />
        </button>

        {showOverflow && (
          <div className="sw-tb-overflow-menu" role="menu">
            <div className="sw-tb-menu-label">Period scope</div>
            {isDarren && (
              <div className="sw-tb-toggle" style={{ margin: '2px 10px 6px' }}>
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
            )}
            <CategoryFilterBar />
            <button
              className="sw-tb-menu-item"
              role="menuitem"
              onClick={() => { setExcludedCategoryIds([]); setShowOverflow(false); }}
            >
              <RotateCcw size={13} style={{ color: 'var(--text-400)' }} />
              Reset filters
            </button>

            <div className="sw-tb-menu-sep" />
            <div className="sw-tb-menu-label">Currency</div>
            {currencies.map(c => (
              <button
                key={c.code}
                className={`sw-tb-menu-item${c.code === currency ? ' active' : ''}`}
                role="menuitem"
                onClick={() => setCurrency(c.code)}
              >
                <span style={{ width: 18, fontWeight: 700, opacity: 0.6 }}>{c.symbol}</span>
                {c.code}
              </button>
            ))}

            <div className="sw-tb-menu-sep" />
            <button
              className="sw-tb-menu-item"
              role="menuitem"
              onClick={cycleTheme}
              aria-label={themeAriaLabel}
            >
              <ThemeIcon preference={themePreference} resolved={resolvedTheme} />
              Theme: {themeLabel}
            </button>
            <button
              className="sw-tb-menu-item"
              role="menuitem"
              onClick={() => { setShowOverflow(false); onExport(); }}
            >
              <FileSpreadsheet size={13} style={{ color: 'var(--green-500)' }} />
              Export
            </button>
          </div>
        )}
      </div>

    </div>
  );
}
