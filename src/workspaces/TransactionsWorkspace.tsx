'use client';

import { useState, useMemo, useCallback } from 'react';
import {
  Search, Plus, Trash2, ChevronDown, ChevronUp, X,
  TrendingUp, TrendingDown, Minus, ArrowDownRight, ArrowUpRight,
  CheckSquare, Square, Download, MapPin, SlidersHorizontal,
  Pencil, Check, RotateCcw, Zap, Calendar,
} from 'lucide-react';
import { useBudgetStore } from '@/store/budgetStore';
import { currencySymbol, formatCurrency } from '@/utils/currency';
import { getFinancialMonthRange } from '@/utils/financialCycle';

interface TransactionsWorkspaceProps {
  onAddExpense: () => void;
  onAddIncome: () => void;
}

type Tab = 'all' | 'expenses' | 'income';
type SortKey = 'date' | 'amount' | 'description';
type SortDir = 'asc' | 'desc';

// ── Inline edit state ─────────────────────────────────────────────────────
interface EditState {
  id: string;
  type: 'expense' | 'income';
  description: string;
  amount: string;
  date: string;
  category: string;
}

export default function TransactionsWorkspace({ onAddExpense, onAddIncome }: TransactionsWorkspaceProps) {
  const {
    expenses, income, categories,
    selectedMonth, selectedYear, selectedCity,
    excludedCategoryIds,
    financialCycleStart, currency,
    deleteExpense, deleteIncome, updateExpense, updateIncome,
  } = useBudgetStore();

  const sym = currencySymbol(currency);
  const { start, end } = getFinancialMonthRange(selectedMonth, selectedYear, financialCycleStart);

  // ── Filter state ──────────────────────────────────────────────────────────
  const [tab, setTab]           = useState<Tab>('all');
  const [search, setSearch]     = useState('');
  const [sortKey, setSortKey]   = useState<SortKey>('date');
  const [sortDir, setSortDir]   = useState<SortDir>('desc');
  const [filterCat, setFilterCat] = useState<string>('');   // '' = all
  const [filterCity, setFilterCity] = useState<string>(''); // '' = all
  const [amtMin, setAmtMin]     = useState('');
  const [amtMax, setAmtMax]     = useState('');
  const [showFilters, setShowFilters] = useState(false);

  // ── Selection state ───────────────────────────────────────────────────────
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // ── Expand / edit state ───────────────────────────────────────────────────
  const [expandedId, setExpandedId]   = useState<string | null>(null);
  const [editState, setEditState]     = useState<EditState | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  // ── Helpers ───────────────────────────────────────────────────────────────
  const getCat      = useCallback((id: string) => categories.find(c => c.id === id), [categories]);
  const getCatName  = (id: string) => getCat(id)?.name  ?? 'Unknown';
  const getCatIcon  = (id: string) => getCat(id)?.icon  ?? '📦';
  const getCatColor = (id: string) => getCat(id)?.color ?? '#6b7280';

  // Distinct cities from all expenses
  const allCities = useMemo(() =>
    [...new Set(expenses.map(e => e.city).filter(Boolean) as string[])].sort(),
    [expenses]);

  // Expense categories only (for filter dropdown)
  const expenseCats = useMemo(() =>
    categories.filter(c => c.type !== 'income'),
    [categories]);

  // ── Filtered datasets ─────────────────────────────────────────────────────
  const filteredExpenses = useMemo(() => expenses.filter(e => {
    const d = new Date(e.date);
    if (d < start || d > end) return false;
    if (selectedCity !== 'Both' && e.city && e.city !== selectedCity) return false;
    if (excludedCategoryIds.length > 0 && excludedCategoryIds.includes(e.category)) return false;
    if (filterCat && e.category !== filterCat) return false;
    if (filterCity && (e.city ?? 'Bangalore') !== filterCity) return false;
    if (amtMin && e.amount < parseFloat(amtMin)) return false;
    if (amtMax && e.amount > parseFloat(amtMax)) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!e.description.toLowerCase().includes(q) &&
          !getCatName(e.category).toLowerCase().includes(q) &&
          !(e.city ?? '').toLowerCase().includes(q)) return false;
    }
    return true;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [expenses, start, end, selectedCity, excludedCategoryIds, filterCat, filterCity, amtMin, amtMax, search]);

  const filteredIncome = useMemo(() => income.filter(i => {
    const d = new Date(i.date);
    if (d < start || d > end) return false;
    if (amtMin && i.amount < parseFloat(amtMin)) return false;
    if (amtMax && i.amount > parseFloat(amtMax)) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!i.source?.toLowerCase().includes(q)) return false;
    }
    return true;
  }), [income, start, end, amtMin, amtMax, search]);

  const totalExpAmt = filteredExpenses.reduce((s, e) => s + e.amount, 0);
  const totalIncAmt = filteredIncome.reduce((s, i) => s + i.amount, 0);
  const netAmt      = totalIncAmt - totalExpAmt;

  // ── Smart insights ────────────────────────────────────────────────────────
  const insights = useMemo(() => {
    if (filteredExpenses.length === 0) return null;
    const maxExp = filteredExpenses.reduce((a, b) => a.amount > b.amount ? a : b);
    const catCounts: Record<string, number> = {};
    filteredExpenses.forEach(e => { catCounts[e.category] = (catCounts[e.category] ?? 0) + 1; });
    const topCatId = Object.entries(catCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? '';
    const avgAmt = totalExpAmt / filteredExpenses.length;
    return { maxExp, topCatId, avgAmt, count: filteredExpenses.length };
  }, [filteredExpenses, totalExpAmt]);

  // ── Sorted + merged rows ──────────────────────────────────────────────────
  type ExpRow = typeof filteredExpenses[number] & { _type: 'expense' };
  type IncRow = typeof filteredIncome[number] & { _type: 'income' };
  type AnyRow = ExpRow | IncRow;

  const sortedRows = useMemo((): AnyRow[] => {
    const exp: AnyRow[] = filteredExpenses.map(e => ({ ...e, _type: 'expense' as const }));
    const inc: AnyRow[] = filteredIncome.map(i => ({ ...i, _type: 'income' as const }));
    const base = tab === 'all' ? [...exp, ...inc]
      : tab === 'expenses' ? exp
      : inc;

    return [...base].sort((a, b) => {
      let cmp = 0;
      if (sortKey === 'date')        cmp = new Date(a.date).getTime() - new Date(b.date).getTime();
      else if (sortKey === 'amount') cmp = a.amount - b.amount;
      else if (sortKey === 'description') {
        const aDesc = a._type === 'expense' ? (a as ExpRow).description : (a as IncRow).source ?? '';
        const bDesc = b._type === 'expense' ? (b as ExpRow).description : (b as IncRow).source ?? '';
        cmp = aDesc.localeCompare(bDesc);
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [filteredExpenses, filteredIncome, tab, sortKey, sortDir]);

  // Grouped by date for display
  const grouped = useMemo(() => {
    const map: Record<string, AnyRow[]> = {};
    sortedRows.forEach(r => {
      const k = r.date.slice(0, 10);
      if (!map[k]) map[k] = [];
      map[k].push(r);
    });
    const entries = Object.entries(map);
    entries.sort(([a], [b]) => sortDir === 'desc' ? b.localeCompare(a) : a.localeCompare(b));
    return entries;
  }, [sortedRows, sortDir]);

  // ── Selection helpers ─────────────────────────────────────────────────────
  const allIds       = sortedRows.map(r => r.id);
  const allSelected  = allIds.length > 0 && allIds.every(id => selected.has(id));
  const someSelected = selected.size > 0;

  const toggleSelect   = (id: string) => setSelected(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleSelectAll = () => setSelected(allSelected ? new Set() : new Set(allIds));
  const clearSelected  = () => setSelected(new Set());

  const bulkDelete = () => {
    selected.forEach(id => {
      const isExp = filteredExpenses.some(e => e.id === id);
      isExp ? deleteExpense(id) : deleteIncome(id);
    });
    clearSelected();
  };

  // ── Inline edit helpers ───────────────────────────────────────────────────
  const startEdit = (row: AnyRow) => {
    if (row._type === 'expense') {
      const r = row as ExpRow;
      setEditState({ id: r.id, type: 'expense', description: r.description, amount: String(r.amount), date: r.date, category: r.category });
    } else {
      const r = row as IncRow;
      setEditState({ id: r.id, type: 'income', description: r.source ?? '', amount: String(r.amount), date: r.date, category: r.category ?? '' });
    }
    setExpandedId(row.id);
  };

  const saveEdit = () => {
    if (!editState) return;
    const amt = parseFloat(editState.amount);
    if (!editState.description.trim() || isNaN(amt) || amt <= 0) return;
    const [y, m] = editState.date.split('-');
    if (editState.type === 'expense') {
      updateExpense(editState.id, {
        description: editState.description.trim(),
        amount: amt,
        date: editState.date,
        category: editState.category,
        month: m,
        year: parseInt(y, 10),
      });
    } else {
      updateIncome(editState.id, {
        source: editState.description.trim(),
        amount: amt,
        date: editState.date,
        month: m,
        year: parseInt(y, 10),
      });
    }
    setEditState(null);
  };

  // ── Sort toggle ───────────────────────────────────────────────────────────
  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('desc'); }
  };

  // ── Filter chips ──────────────────────────────────────────────────────────
  const activeFilters: { label: string; onRemove: () => void }[] = [];
  if (filterCat)  activeFilters.push({ label: getCatName(filterCat),    onRemove: () => setFilterCat('') });
  if (filterCity) activeFilters.push({ label: filterCity,               onRemove: () => setFilterCity('') });
  if (amtMin)     activeFilters.push({ label: `≥ ${sym}${amtMin}`,      onRemove: () => setAmtMin('') });
  if (amtMax)     activeFilters.push({ label: `≤ ${sym}${amtMax}`,      onRemove: () => setAmtMax('') });

  const resetFilters = () => { setFilterCat(''); setFilterCity(''); setAmtMin(''); setAmtMax(''); setSearch(''); };
  const hasFilters = !!(filterCat || filterCity || amtMin || amtMax || search);

  // ── Export selected ───────────────────────────────────────────────────────
  const exportSelected = () => {
    const rows = sortedRows.filter(r => selected.has(r.id));
    const csv = ['Date,Type,Description,Category,Amount,City',
      ...rows.map(r => {
        const desc = r._type === 'expense' ? (r as ExpRow).description : (r as IncRow).source ?? '';
        const cat  = r._type === 'expense' ? getCatName((r as ExpRow).category) : 'Income';
        const city = (r as ExpRow).city ?? '';
        const sign = r._type === 'expense' ? -r.amount : r.amount;
        return `${r.date},${r._type},"${desc}","${cat}",${sign},"${city}"`;
      })
    ].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a'); a.href = url; a.download = 'transactions.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  // ── Date formatting ───────────────────────────────────────────────────────
  const fmtDateHeader = (dateStr: string) => {
    const d = new Date(dateStr + 'T12:00:00');
    const today = new Date(); today.setHours(0,0,0,0);
    const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
    const dDay = new Date(d); dDay.setHours(0,0,0,0);
    if (dDay.getTime() === today.getTime())     return 'Today';
    if (dDay.getTime() === yesterday.getTime()) return 'Yesterday';
    return d.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short' });
  };

  const fmtTime = (dateStr: string) => {
    // Dates are stored as YYYY-MM-DD without time — show the date short instead
    const d = new Date(dateStr + 'T12:00:00');
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  };

  const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const selectedMonthLabel = `${MONTH_NAMES[parseInt(selectedMonth) - 1]} ${selectedYear}`;

  return (
    <div style={{ maxWidth: 1400 }}>

      {/* ══════════════════════════════════════════════════════════════════════
          PAGE HEADER
      ══════════════════════════════════════════════════════════════════════ */}
      <div className="ws-header">
        <div>
          <h1 className="ws-title" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            Activity
            <span style={{
              fontSize: '0.75rem', fontWeight: 700, padding: '3px 10px', borderRadius: 99,
              background: 'var(--brand-50)', color: 'var(--brand-600)',
              border: '1px solid var(--brand-200)',
            }}>
              {selectedMonthLabel}
            </span>
          </h1>
          <p className="ws-subtitle">
            {filteredExpenses.length + filteredIncome.length} transactions
            {' · '}
            <span style={{ color: 'var(--red-500)' }}>{sym}{Math.round(totalExpAmt).toLocaleString('en-IN')} out</span>
            {' · '}
            <span style={{ color: 'var(--green-600)' }}>{sym}{Math.round(totalIncAmt).toLocaleString('en-IN')} in</span>
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={onAddExpense} className="ws-cta-btn ws-cta-red">
            <Plus size={12} /> Expense
          </button>
          <button onClick={onAddIncome} className="ws-cta-btn ws-cta-green">
            <Plus size={12} /> Income
          </button>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          KPI STRIP
      ══════════════════════════════════════════════════════════════════════ */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
        {[
          {
            label: 'Money Out', value: `${sym}${Math.round(totalExpAmt).toLocaleString('en-IN')}`,
            sub: `${filteredExpenses.length} expense${filteredExpenses.length !== 1 ? 's' : ''}`,
            color: 'var(--red-500)', bg: 'var(--red-50)', border: 'var(--red-100)',
            Icon: ArrowUpRight,
          },
          {
            label: 'Money In', value: `${sym}${Math.round(totalIncAmt).toLocaleString('en-IN')}`,
            sub: `${filteredIncome.length} income item${filteredIncome.length !== 1 ? 's' : ''}`,
            color: 'var(--green-600)', bg: 'var(--green-50)', border: 'var(--green-100)',
            Icon: ArrowDownRight,
          },
          {
            label: 'Net Balance', value: `${netAmt >= 0 ? '+' : '−'}${sym}${Math.abs(netAmt).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`,
            sub: netAmt >= 0 ? 'Positive cash flow' : 'Overspending',
            color: netAmt >= 0 ? 'var(--green-600)' : 'var(--red-500)',
            bg: netAmt >= 0 ? 'var(--green-50)' : 'var(--red-50)',
            border: netAmt >= 0 ? 'var(--green-100)' : 'var(--red-100)',
            Icon: netAmt >= 0 ? TrendingUp : TrendingDown,
          },
          {
            label: 'Avg Expense', value: filteredExpenses.length > 0 ? `${sym}${Math.round(totalExpAmt / filteredExpenses.length).toLocaleString('en-IN')}` : `${sym}0`,
            sub: 'per transaction',
            color: 'var(--brand-600)', bg: 'var(--brand-50)', border: 'var(--brand-100)',
            Icon: Minus,
          },
        ].map(card => (
          <div
            key={card.label}
            style={{
              background: card.bg,
              border: `1px solid ${card.border}`,
              borderRadius: 'var(--r-xl)',
              padding: '16px 18px',
              display: 'flex', alignItems: 'center', gap: 12,
              transition: 'box-shadow 0.2s',
            }}
          >
            <div style={{
              width: 36, height: 36, borderRadius: 'var(--r-md)',
              background: `${card.color}18`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: card.color, flexShrink: 0,
            }}>
              <card.Icon size={16} />
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: '0.6875rem', fontWeight: 700, color: 'var(--text-400)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 }}>{card.label}</div>
              <div style={{ fontSize: '1.125rem', fontWeight: 800, color: card.color, fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.02em', whiteSpace: 'nowrap' }}>{card.value}</div>
              <div style={{ fontSize: '0.6875rem', color: 'var(--text-400)', marginTop: 1 }}>{card.sub}</div>
            </div>
          </div>
        ))}
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          SMART INSIGHTS BAR
      ══════════════════════════════════════════════════════════════════════ */}
      {insights && (
        <div style={{
          display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16,
          padding: '10px 14px',
          background: 'var(--brand-50)',
          border: '1px solid var(--brand-100)',
          borderRadius: 'var(--r-lg)',
        }}>
          <Zap size={13} style={{ color: 'var(--brand-500)', flexShrink: 0, marginTop: 1 }} />
          <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--brand-700)', marginRight: 4 }}>Insights:</span>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-600)' }}>
            Largest expense:&nbsp;
            <strong style={{ color: 'var(--text-900)' }}>
              {insights.maxExp.description} ({sym}{insights.maxExp.amount.toLocaleString('en-IN')})
            </strong>
          </span>
          <span style={{ color: 'var(--text-300)', fontSize: '0.75rem' }}>·</span>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-600)' }}>
            Top category:&nbsp;
            <strong style={{ color: 'var(--text-900)' }}>
              {getCatIcon(insights.topCatId)} {getCatName(insights.topCatId)}
            </strong>
          </span>
          <span style={{ color: 'var(--text-300)', fontSize: '0.75rem' }}>·</span>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-600)' }}>
            Avg per transaction:&nbsp;
            <strong style={{ color: 'var(--text-900)' }}>{sym}{Math.round(insights.avgAmt).toLocaleString('en-IN')}</strong>
          </span>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          FILTER BAR
      ══════════════════════════════════════════════════════════════════════ */}
      <div style={{ marginBottom: 12 }}>
        {/* Primary row: tabs + search + filter toggle */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 8 }}>

          {/* Tabs */}
          <div className="ws-tab-bar">
            {(['all', 'expenses', 'income'] as Tab[]).map(t => (
              <button key={t} className={`ws-tab${tab === t ? ' active' : ''}`} onClick={() => setTab(t)}>
                {t === 'all'      ? `All (${filteredExpenses.length + filteredIncome.length})`
                  : t === 'expenses' ? `Expenses (${filteredExpenses.length})`
                  : `Income (${filteredIncome.length})`}
              </button>
            ))}
          </div>

          {/* Search */}
          <div style={{ position: 'relative', flex: 1, minWidth: 160, maxWidth: 320 }}>
            <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-400)', pointerEvents: 'none' }} />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search transactions…"
              style={{
                width: '100%', paddingLeft: 32, paddingRight: search ? 28 : 10, paddingTop: 7, paddingBottom: 7,
                border: '1.5px solid var(--border-default)', borderRadius: 'var(--r-md)',
                fontSize: '0.8125rem', background: 'var(--bg-surface)', color: 'var(--text-900)',
                outline: 'none', fontFamily: 'inherit', transition: 'border-color 0.15s, box-shadow 0.15s',
              }}
              onFocus={e => { e.target.style.borderColor = 'var(--brand-500)'; e.target.style.boxShadow = '0 0 0 3px rgba(99,102,241,0.1)'; }}
              onBlur={e => { e.target.style.borderColor = 'var(--border-default)'; e.target.style.boxShadow = 'none'; }}
            />
            {search && (
              <button onClick={() => setSearch('')} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-400)', padding: 0 }}>
                <X size={12} />
              </button>
            )}
          </div>

          {/* Advanced filter toggle */}
          <button
            onClick={() => setShowFilters(v => !v)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '7px 12px',
              borderRadius: 'var(--r-md)', fontSize: '0.8125rem', fontWeight: 600, cursor: 'pointer',
              background: showFilters ? 'var(--brand-50)' : 'var(--bg-surface)',
              color: showFilters ? 'var(--brand-600)' : 'var(--text-600)',
              border: showFilters ? '1.5px solid var(--brand-300)' : '1.5px solid var(--border-default)',
              fontFamily: 'inherit', transition: 'all 0.15s', flexShrink: 0,
            }}
          >
            <SlidersHorizontal size={13} />
            Filters
            {activeFilters.length > 0 && (
              <span style={{ background: 'var(--brand-500)', color: '#fff', borderRadius: 99, fontSize: 10, fontWeight: 800, padding: '1px 6px' }}>
                {activeFilters.length}
              </span>
            )}
          </button>

          {/* Sort control */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
            {(['date', 'amount'] as SortKey[]).map(k => (
              <button
                key={k}
                onClick={() => handleSort(k)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 3, padding: '6px 10px',
                  borderRadius: 'var(--r-sm)', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer',
                  background: sortKey === k ? 'var(--brand-50)' : 'transparent',
                  color: sortKey === k ? 'var(--brand-600)' : 'var(--text-500)',
                  border: sortKey === k ? '1px solid var(--brand-200)' : '1px solid transparent',
                  fontFamily: 'inherit',
                }}
              >
                {k.charAt(0).toUpperCase() + k.slice(1)}
                {sortKey === k && (sortDir === 'desc' ? <ChevronDown size={11} /> : <ChevronUp size={11} />)}
              </button>
            ))}
          </div>

          {/* Reset button */}
          {hasFilters && (
            <button
              onClick={resetFilters}
              style={{
                display: 'flex', alignItems: 'center', gap: 5, padding: '7px 10px',
                borderRadius: 'var(--r-md)', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer',
                background: 'var(--red-50)', color: 'var(--red-600)',
                border: '1px solid var(--red-100)', fontFamily: 'inherit',
              }}
            >
              <RotateCcw size={11} /> Reset
            </button>
          )}
        </div>

        {/* Advanced filter panel */}
        {showFilters && (
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10,
            padding: '12px 14px',
            background: 'var(--bg-subtle)',
            border: '1px solid var(--border-default)',
            borderRadius: 'var(--r-lg)',
            marginBottom: 8,
          }}>
            {/* Category filter */}
            <div>
              <label style={{ display: 'block', fontSize: '0.6875rem', fontWeight: 700, color: 'var(--text-400)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>
                Category
              </label>
              <select
                value={filterCat}
                onChange={e => setFilterCat(e.target.value)}
                style={{ width: '100%', padding: '7px 10px', borderRadius: 'var(--r-sm)', fontSize: '0.8125rem', background: 'var(--bg-surface)', border: '1px solid var(--border-default)', color: 'var(--text-700)', fontFamily: 'inherit', outline: 'none' }}
              >
                <option value="">All categories</option>
                {expenseCats.map(c => (
                  <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
                ))}
              </select>
            </div>

            {/* City filter */}
            {allCities.length > 0 && (
              <div>
                <label style={{ display: 'block', fontSize: '0.6875rem', fontWeight: 700, color: 'var(--text-400)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>
                  City
                </label>
                <select
                  value={filterCity}
                  onChange={e => setFilterCity(e.target.value)}
                  style={{ width: '100%', padding: '7px 10px', borderRadius: 'var(--r-sm)', fontSize: '0.8125rem', background: 'var(--bg-surface)', border: '1px solid var(--border-default)', color: 'var(--text-700)', fontFamily: 'inherit', outline: 'none' }}
                >
                  <option value="">All cities</option>
                  {allCities.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            )}

            {/* Amount range */}
            <div>
              <label style={{ display: 'block', fontSize: '0.6875rem', fontWeight: 700, color: 'var(--text-400)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>
                Min Amount ({sym})
              </label>
              <input
                type="number" min="0" value={amtMin} onChange={e => setAmtMin(e.target.value)}
                placeholder="0"
                style={{ width: '100%', padding: '7px 10px', borderRadius: 'var(--r-sm)', fontSize: '0.8125rem', background: 'var(--bg-surface)', border: '1px solid var(--border-default)', color: 'var(--text-700)', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.6875rem', fontWeight: 700, color: 'var(--text-400)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>
                Max Amount ({sym})
              </label>
              <input
                type="number" min="0" value={amtMax} onChange={e => setAmtMax(e.target.value)}
                placeholder="∞"
                style={{ width: '100%', padding: '7px 10px', borderRadius: 'var(--r-sm)', fontSize: '0.8125rem', background: 'var(--bg-surface)', border: '1px solid var(--border-default)', color: 'var(--text-700)', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }}
              />
            </div>
          </div>
        )}

        {/* Active filter chips */}
        {activeFilters.length > 0 && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {activeFilters.map(f => (
              <span
                key={f.label}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 5,
                  padding: '4px 10px', borderRadius: 99, fontSize: '0.75rem', fontWeight: 600,
                  background: 'var(--brand-50)', color: 'var(--brand-700)',
                  border: '1px solid var(--brand-200)',
                }}
              >
                {f.label}
                <button onClick={f.onRemove} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--brand-400)', padding: 0, display: 'flex' }}>
                  <X size={10} />
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          BULK ACTION BAR
      ══════════════════════════════════════════════════════════════════════ */}
      {someSelected && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px',
          background: 'var(--brand-50)', border: '1px solid var(--brand-200)',
          borderRadius: 'var(--r-lg)', marginBottom: 12,
          animation: 'txnFadeIn 0.15s ease',
        }}>
          <CheckSquare size={15} style={{ color: 'var(--brand-600)' }} />
          <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--brand-700)' }}>
            {selected.size} selected
          </span>
          <div style={{ flex: 1 }} />
          <button
            onClick={exportSelected}
            style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', borderRadius: 'var(--r-sm)', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer', background: 'var(--bg-surface)', color: 'var(--text-700)', border: '1px solid var(--border-default)', fontFamily: 'inherit' }}
          >
            <Download size={12} /> Export CSV
          </button>
          <button
            onClick={bulkDelete}
            style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', borderRadius: 'var(--r-sm)', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer', background: 'var(--red-50)', color: 'var(--red-600)', border: '1px solid var(--red-100)', fontFamily: 'inherit' }}
          >
            <Trash2 size={12} /> Delete {selected.size}
          </button>
          <button
            onClick={clearSelected}
            style={{ display: 'flex', alignItems: 'center', padding: '6px', borderRadius: 'var(--r-sm)', cursor: 'pointer', background: 'transparent', border: 'none', color: 'var(--text-400)', fontFamily: 'inherit' }}
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          TRANSACTION TABLE
      ══════════════════════════════════════════════════════════════════════ */}
      <div
        className="panel"
        style={{ padding: 0, overflow: 'hidden' }}
      >
        {/* Table header */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '28px 40px 1fr 140px 100px 90px 80px',
          gap: 0,
          padding: '0 16px',
          height: 38,
          alignItems: 'center',
          background: 'var(--bg-subtle)',
          borderBottom: '1px solid var(--border-default)',
          position: 'sticky', top: 0, zIndex: 2,
        }}>
          {/* Select all checkbox */}
          <button onClick={toggleSelectAll} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-400)', padding: 0, display: 'flex' }}>
            {allSelected && sortedRows.length > 0 ? <CheckSquare size={14} style={{ color: 'var(--brand-500)' }} /> : <Square size={14} />}
          </button>
          <div />
          {/* Description col with sort */}
          <button onClick={() => handleSort('description')} style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.6875rem', fontWeight: 700, color: 'var(--text-400)', letterSpacing: '0.07em', textTransform: 'uppercase', padding: 0, textAlign: 'left' }}>
            Description
            {sortKey === 'description' && (sortDir === 'asc' ? <ChevronUp size={10} /> : <ChevronDown size={10} />)}
          </button>
          <span style={{ fontSize: '0.6875rem', fontWeight: 700, color: 'var(--text-400)', letterSpacing: '0.07em', textTransform: 'uppercase' }}>Category</span>
          <button onClick={() => handleSort('date')} style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.6875rem', fontWeight: 700, color: 'var(--text-400)', letterSpacing: '0.07em', textTransform: 'uppercase', padding: 0 }}>
            Date
            {sortKey === 'date' && (sortDir === 'asc' ? <ChevronUp size={10} /> : <ChevronDown size={10} />)}
          </button>
          <button onClick={() => handleSort('amount')} style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 4, background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.6875rem', fontWeight: 700, color: 'var(--text-400)', letterSpacing: '0.07em', textTransform: 'uppercase', padding: 0, width: '100%' }}>
            {sortKey === 'amount' && (sortDir === 'asc' ? <ChevronUp size={10} /> : <ChevronDown size={10} />)}
            Amount
          </button>
          <div />
        </div>

        {/* Empty state */}
        {grouped.length === 0 ? (
          <div style={{ padding: '48px 24px', textAlign: 'center' }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>📭</div>
            <div style={{ fontSize: '0.9375rem', fontWeight: 700, color: 'var(--text-700)', marginBottom: 6 }}>
              No transactions found
            </div>
            <div style={{ fontSize: '0.8125rem', color: 'var(--text-400)', marginBottom: 20 }}>
              {hasFilters || search ? 'Try adjusting your filters' : 'Add your first transaction to get started'}
            </div>
            {(hasFilters || search) && (
              <button
                onClick={resetFilters}
                style={{ padding: '8px 18px', borderRadius: 'var(--r-md)', fontSize: '0.8125rem', fontWeight: 600, cursor: 'pointer', background: 'var(--brand-600)', color: '#fff', border: 'none', fontFamily: 'inherit' }}
              >
                Clear all filters
              </button>
            )}
          </div>
        ) : (
          <>
            {grouped.map(([date, rows]) => {
              const dayExp = rows.filter(r => r._type === 'expense').reduce((s, r) => s + r.amount, 0);
              const dayInc = rows.filter(r => r._type === 'income').reduce((s, r) => s + r.amount, 0);

              return (
                <div key={date}>
                  {/* Date group header */}
                  <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '8px 16px 4px',
                    background: 'var(--bg-subtle)',
                    borderBottom: '1px solid var(--border-default)',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Calendar size={11} style={{ color: 'var(--text-400)' }} />
                      <span style={{ fontSize: '0.6875rem', fontWeight: 700, color: 'var(--text-500)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                        {fmtDateHeader(date)}
                      </span>
                      <span style={{ fontSize: '0.6875rem', color: 'var(--text-300)' }}>
                        {rows.length} item{rows.length !== 1 ? 's' : ''}
                      </span>
                    </div>
                    <div style={{ display: 'flex', gap: 12 }}>
                      {dayInc > 0 && <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--green-600)' }}>+{sym}{Math.round(dayInc).toLocaleString('en-IN')}</span>}
                      {dayExp > 0 && <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--red-500)' }}>−{sym}{Math.round(dayExp).toLocaleString('en-IN')}</span>}
                    </div>
                  </div>

                  {/* Rows */}
                  {rows.map(row => {
                    const catId    = row._type === 'expense' ? (row as ExpRow).category : '';
                    const isExp    = row._type === 'expense';
                    const isExpanded = expandedId === row.id;
                    const isEditing  = editState?.id === row.id;
                    const isSelecting = selected.has(row.id);
                    const isDelConfirm = deleteConfirm === row.id;
                    const catColor = isExp ? getCatColor(catId) : '#16a34a';

                    return (
                      <div key={row.id} style={{ borderBottom: '1px solid var(--border-default)' }}>
                        {/* Main row */}
                        <div
                          style={{
                            display: 'grid',
                            gridTemplateColumns: '28px 40px 1fr 140px 100px 90px 80px',
                            alignItems: 'center',
                            padding: '0 16px',
                            minHeight: 52,
                            background: isSelecting ? 'var(--brand-50)' : isExpanded ? 'var(--bg-subtle)' : 'transparent',
                            transition: 'background 0.12s',
                            cursor: 'pointer',
                          }}
                          onClick={() => { if (!isEditing) setExpandedId(isExpanded ? null : row.id); }}
                          onMouseEnter={e => { if (!isSelecting && !isExpanded) (e.currentTarget as HTMLDivElement).style.background = 'var(--bg-muted)'; }}
                          onMouseLeave={e => { if (!isSelecting && !isExpanded) (e.currentTarget as HTMLDivElement).style.background = 'transparent'; }}
                        >
                          {/* Checkbox */}
                          <button
                            onClick={e => { e.stopPropagation(); toggleSelect(row.id); }}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: isSelecting ? 'var(--brand-500)' : 'var(--text-300)', padding: 0, display: 'flex' }}
                          >
                            {isSelecting ? <CheckSquare size={14} /> : <Square size={14} />}
                          </button>

                          {/* Category icon */}
                          <div style={{
                            width: 30, height: 30, borderRadius: 8, flexShrink: 0,
                            background: isExp ? `${catColor}18` : 'var(--green-50)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14,
                          }}>
                            {isExp ? getCatIcon(catId) : '💰'}
                          </div>

                          {/* Description + meta */}
                          <div style={{ minWidth: 0, paddingRight: 12 }}>
                            <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-900)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {isExp ? (row as ExpRow).description : (row as IncRow).source || 'Income'}
                            </div>
                            <div style={{ fontSize: '0.6875rem', color: 'var(--text-400)', marginTop: 1, display: 'flex', alignItems: 'center', gap: 6 }}>
                              {isExp && (row as ExpRow).city && (
                                <>
                                  <MapPin size={9} />
                                  <span>{(row as ExpRow).city}</span>
                                  <span>·</span>
                                </>
                              )}
                              <span>{isExp ? getCatName(catId) : 'Income'}</span>
                            </div>
                          </div>

                          {/* Category badge */}
                          <div style={{ paddingRight: 8 }}>
                            {isExp ? (
                              <span style={{
                                display: 'inline-flex', alignItems: 'center', gap: 4,
                                padding: '3px 8px', borderRadius: 99, fontSize: '0.6875rem', fontWeight: 700,
                                background: `${catColor}14`, color: catColor,
                                border: `1px solid ${catColor}28`,
                                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 130,
                              }}>
                                {getCatIcon(catId)} {getCatName(catId)}
                              </span>
                            ) : (
                              <span className="badge badge-green">Income</span>
                            )}
                          </div>

                          {/* Date */}
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-500)', whiteSpace: 'nowrap' }}>
                            {fmtTime(row.date)}
                          </span>

                          {/* Amount */}
                          <div style={{ textAlign: 'right' }}>
                            <span style={{
                              fontSize: '0.9375rem', fontWeight: 800, fontVariantNumeric: 'tabular-nums',
                              color: isExp ? 'var(--red-500)' : 'var(--green-600)',
                              letterSpacing: '-0.01em',
                            }}>
                              {isExp ? '−' : '+'}{sym}{row.amount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                            </span>
                          </div>

                          {/* Actions */}
                          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 4 }} onClick={e => e.stopPropagation()}>
                            <button
                              onClick={() => startEdit(row)}
                              title="Edit"
                              style={{ width: 26, height: 26, borderRadius: 6, border: 'none', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-400)', transition: 'all 0.12s' }}
                              onMouseEnter={e => { e.currentTarget.style.background = 'var(--brand-50)'; e.currentTarget.style.color = 'var(--brand-600)'; }}
                              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-400)'; }}
                            >
                              <Pencil size={12} />
                            </button>
                            <button
                              onClick={() => setDeleteConfirm(isDelConfirm ? null : row.id)}
                              title="Delete"
                              style={{ width: 26, height: 26, borderRadius: 6, border: 'none', background: isDelConfirm ? 'var(--red-50)' : 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: isDelConfirm ? 'var(--red-500)' : 'var(--text-400)', transition: 'all 0.12s' }}
                              onMouseEnter={e => { if (!isDelConfirm) { e.currentTarget.style.background = 'var(--red-50)'; e.currentTarget.style.color = 'var(--red-400)'; }}}
                              onMouseLeave={e => { if (!isDelConfirm) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-400)'; }}}
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </div>

                        {/* ── Delete confirm inline ── */}
                        {isDelConfirm && (
                          <div style={{
                            display: 'flex', alignItems: 'center', gap: 10, padding: '8px 16px 10px 74px',
                            background: 'var(--red-50)', borderTop: '1px dashed var(--red-100)',
                            animation: 'txnFadeIn 0.15s ease',
                          }}>
                            <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--red-700)', flex: 1 }}>
                              Delete this transaction? This cannot be undone.
                            </span>
                            <button
                              onClick={() => { row._type === 'expense' ? deleteExpense(row.id) : deleteIncome(row.id); setDeleteConfirm(null); setSelected(s => { const n = new Set(s); n.delete(row.id); return n; }); }}
                              style={{ padding: '5px 14px', borderRadius: 8, fontSize: '0.75rem', fontWeight: 700, background: 'var(--red-500)', color: '#fff', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}
                            >
                              Delete
                            </button>
                            <button
                              onClick={() => setDeleteConfirm(null)}
                              style={{ padding: '5px 12px', borderRadius: 8, fontSize: '0.75rem', fontWeight: 600, background: 'var(--bg-surface)', color: 'var(--text-600)', border: '1px solid var(--border-default)', cursor: 'pointer', fontFamily: 'inherit' }}
                            >
                              Cancel
                            </button>
                          </div>
                        )}

                        {/* ── Expanded detail panel ── */}
                        {isExpanded && !isEditing && (
                          <div style={{
                            padding: '16px 16px 16px 74px',
                            background: 'var(--bg-subtle)',
                            borderTop: '1px dashed var(--border-default)',
                            animation: 'txnSlideDown 0.18s ease',
                          }}>
                            <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
                              {/* Detail fields */}
                              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, auto))', gap: '8px 24px', flex: 1 }}>
                                <div>
                                  <div style={{ fontSize: '0.625rem', fontWeight: 700, color: 'var(--text-400)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 2 }}>Type</div>
                                  <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-700)' }}>{isExp ? 'Expense' : 'Income'}</div>
                                </div>
                                <div>
                                  <div style={{ fontSize: '0.625rem', fontWeight: 700, color: 'var(--text-400)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 2 }}>Date</div>
                                  <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-700)' }}>
                                    {new Date(row.date + 'T12:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
                                  </div>
                                </div>
                                {isExp && (
                                  <div>
                                    <div style={{ fontSize: '0.625rem', fontWeight: 700, color: 'var(--text-400)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 2 }}>Category</div>
                                    <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-700)' }}>{getCatIcon(catId)} {getCatName(catId)}</div>
                                  </div>
                                )}
                                {isExp && (row as ExpRow).city && (
                                  <div>
                                    <div style={{ fontSize: '0.625rem', fontWeight: 700, color: 'var(--text-400)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 2 }}>City</div>
                                    <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-700)', display: 'flex', alignItems: 'center', gap: 4 }}>
                                      <MapPin size={10} />{(row as ExpRow).city}
                                    </div>
                                  </div>
                                )}
                                <div>
                                  <div style={{ fontSize: '0.625rem', fontWeight: 700, color: 'var(--text-400)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 2 }}>Amount</div>
                                  <div style={{ fontSize: '0.9375rem', fontWeight: 800, color: isExp ? 'var(--red-500)' : 'var(--green-600)', fontVariantNumeric: 'tabular-nums' }}>
                                    {isExp ? '−' : '+'}{formatCurrency(row.amount, currency)}
                                  </div>
                                </div>
                              </div>

                              {/* Action buttons */}
                              <div style={{ display: 'flex', gap: 6, alignItems: 'flex-start', flexShrink: 0 }}>
                                <button
                                  onClick={() => startEdit(row)}
                                  style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 14px', borderRadius: 'var(--r-sm)', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer', background: 'var(--brand-600)', color: '#fff', border: 'none', fontFamily: 'inherit' }}
                                >
                                  <Pencil size={11} /> Edit
                                </button>
                                <button
                                  onClick={() => { setExpandedId(null); setDeleteConfirm(row.id); }}
                                  style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 14px', borderRadius: 'var(--r-sm)', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer', background: 'var(--red-50)', color: 'var(--red-600)', border: '1px solid var(--red-100)', fontFamily: 'inherit' }}
                                >
                                  <Trash2 size={11} /> Delete
                                </button>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* ── Inline edit panel ── */}
                        {isEditing && (
                          <div style={{
                            padding: '14px 16px 14px 74px',
                            background: 'var(--brand-50)',
                            borderTop: '1px dashed var(--brand-200)',
                            animation: 'txnSlideDown 0.18s ease',
                          }}>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10, marginBottom: 12 }}>
                              {/* Description */}
                              <div style={{ gridColumn: 'span 2' }}>
                                <label style={{ display: 'block', fontSize: '0.6875rem', fontWeight: 700, color: 'var(--text-500)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                                  {editState!.type === 'expense' ? 'Description' : 'Source'}
                                </label>
                                <input
                                  autoFocus
                                  value={editState!.description}
                                  onChange={e => setEditState(s => s && ({ ...s, description: e.target.value }))}
                                  onKeyDown={e => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') setEditState(null); }}
                                  style={{ width: '100%', padding: '7px 10px', borderRadius: 'var(--r-sm)', fontSize: '0.8125rem', background: 'var(--bg-surface)', border: '1.5px solid var(--brand-300)', color: 'var(--text-900)', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }}
                                />
                              </div>
                              {/* Amount */}
                              <div>
                                <label style={{ display: 'block', fontSize: '0.6875rem', fontWeight: 700, color: 'var(--text-500)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Amount ({sym})</label>
                                <input
                                  type="number" min="0" step="0.01"
                                  value={editState!.amount}
                                  onChange={e => setEditState(s => s && ({ ...s, amount: e.target.value }))}
                                  style={{ width: '100%', padding: '7px 10px', borderRadius: 'var(--r-sm)', fontSize: '0.8125rem', background: 'var(--bg-surface)', border: '1.5px solid var(--brand-300)', color: 'var(--text-900)', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }}
                                />
                              </div>
                              {/* Date */}
                              <div>
                                <label style={{ display: 'block', fontSize: '0.6875rem', fontWeight: 700, color: 'var(--text-500)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Date</label>
                                <input
                                  type="date"
                                  value={editState!.date}
                                  onChange={e => setEditState(s => s && ({ ...s, date: e.target.value }))}
                                  style={{ width: '100%', padding: '7px 10px', borderRadius: 'var(--r-sm)', fontSize: '0.8125rem', background: 'var(--bg-surface)', border: '1.5px solid var(--brand-300)', color: 'var(--text-900)', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }}
                                />
                              </div>
                              {/* Category (expense only) */}
                              {editState!.type === 'expense' && (
                                <div>
                                  <label style={{ display: 'block', fontSize: '0.6875rem', fontWeight: 700, color: 'var(--text-500)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Category</label>
                                  <select
                                    value={editState!.category}
                                    onChange={e => setEditState(s => s && ({ ...s, category: e.target.value }))}
                                    style={{ width: '100%', padding: '7px 10px', borderRadius: 'var(--r-sm)', fontSize: '0.8125rem', background: 'var(--bg-surface)', border: '1.5px solid var(--brand-300)', color: 'var(--text-700)', fontFamily: 'inherit', outline: 'none' }}
                                  >
                                    {expenseCats.map(c => (
                                      <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
                                    ))}
                                  </select>
                                </div>
                              )}
                            </div>
                            <div style={{ display: 'flex', gap: 8 }}>
                              <button
                                onClick={saveEdit}
                                style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 16px', borderRadius: 'var(--r-sm)', fontSize: '0.8125rem', fontWeight: 700, cursor: 'pointer', background: 'var(--brand-600)', color: '#fff', border: 'none', fontFamily: 'inherit' }}
                              >
                                <Check size={13} /> Save changes
                              </button>
                              <button
                                onClick={() => setEditState(null)}
                                style={{ padding: '7px 14px', borderRadius: 'var(--r-sm)', fontSize: '0.8125rem', fontWeight: 600, cursor: 'pointer', background: 'var(--bg-surface)', color: 'var(--text-600)', border: '1px solid var(--border-default)', fontFamily: 'inherit' }}
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })}

            {/* Table footer summary */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '10px 16px',
              background: 'var(--bg-subtle)',
              borderTop: '1px solid var(--border-default)',
            }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-400)' }}>
                {sortedRows.length} transaction{sortedRows.length !== 1 ? 's' : ''}
              </span>
              <div style={{ display: 'flex', gap: 16 }}>
                {totalIncAmt > 0 && (
                  <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--green-600)' }}>
                    +{sym}{Math.round(totalIncAmt).toLocaleString('en-IN')}
                  </span>
                )}
                {totalExpAmt > 0 && (
                  <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--red-500)' }}>
                    −{sym}{Math.round(totalExpAmt).toLocaleString('en-IN')}
                  </span>
                )}
                <span style={{ fontSize: '0.8125rem', fontWeight: 800, color: netAmt >= 0 ? 'var(--green-600)' : 'var(--red-500)' }}>
                  Net: {netAmt >= 0 ? '+' : '−'}{sym}{Math.abs(netAmt).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                </span>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
