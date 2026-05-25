'use client';

import { useState, useMemo } from 'react';
import { Search, Plus, Trash2, Filter, ArrowDownRight, ArrowUpRight } from 'lucide-react';
import { useBudgetStore } from '@/store/budgetStore';
import { currencySymbol } from '@/utils/currency';
import { getFinancialMonthRange } from '@/utils/financialCycle';
import AllExpensesModal from '@/components/AllExpensesModal';

interface TransactionsWorkspaceProps {
  onAddExpense: () => void;
  onAddIncome:  () => void;
}

type Tab = 'all' | 'expenses' | 'income';

export default function TransactionsWorkspace({ onAddExpense, onAddIncome }: TransactionsWorkspaceProps) {
  const {
    expenses, income, categories,
    selectedMonth, selectedYear, selectedCity,
    excludedCategoryIds,
    financialCycleStart, currency,
    deleteExpense, deleteIncome,
  } = useBudgetStore();

  const [tab, setTab]     = useState<Tab>('all');
  const [search, setSearch] = useState('');
  const [showAllModal, setShowAllModal] = useState(false);

  const { start, end } = getFinancialMonthRange(selectedMonth, selectedYear, financialCycleStart);
  const sym = currencySymbol(currency);

  const filteredExpenses = useMemo(() => expenses.filter(e => {
    const d = new Date(e.date);
    const inPeriod = d >= start && d <= end;
    const inCity   = selectedCity === 'Both' || !e.city || e.city === selectedCity;
    const inCat    = excludedCategoryIds.length === 0 || !excludedCategoryIds.includes(e.category);
    const inSearch = !search || e.description.toLowerCase().includes(search.toLowerCase());
    return inPeriod && inCity && inCat && inSearch;
  }), [expenses, start, end, selectedCity, excludedCategoryIds, search]);

  const filteredIncome = useMemo(() => income.filter(i => {
    const d = new Date(i.date);
    const inPeriod = d >= start && d <= end;
    const inSearch = !search || i.source?.toLowerCase().includes(search.toLowerCase());
    return inPeriod && inSearch;
  }), [income, start, end, search]);

  const getCatName  = (id: string) => categories.find(c => c.id === id)?.name  ?? id;
  const getCatIcon  = (id: string) => categories.find(c => c.id === id)?.icon  ?? '📦';
  const getCatColor = (id: string) => categories.find(c => c.id === id)?.color ?? '#6b7280';

  const totalExpAmt = filteredExpenses.reduce((s, e) => s + e.amount, 0);
  const totalIncAmt = filteredIncome.reduce((s, i) => s + i.amount, 0);
  const netAmt      = totalIncAmt - totalExpAmt;

  const allRows = useMemo(() => {
    const exp = filteredExpenses.map(e => ({ ...e, _type: 'expense' as const }));
    const inc = filteredIncome.map(i => ({ ...i, _type: 'income' as const }));
    return [...exp, ...inc].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [filteredExpenses, filteredIncome]);

  const displayRows = tab === 'all'
    ? allRows
    : tab === 'expenses'
      ? filteredExpenses.map(e => ({ ...e, _type: 'expense' as const }))
      : filteredIncome.map(i => ({ ...i, _type: 'income' as const }));

  const grouped = useMemo(() => {
    const map: Record<string, typeof displayRows> = {};
    displayRows.forEach(r => {
      const key = r.date.slice(0, 10);
      if (!map[key]) map[key] = [];
      map[key].push(r);
    });
    return Object.entries(map).sort(([a], [b]) => b.localeCompare(a));
  }, [displayRows]);

  return (
    <div style={{ maxWidth: 1400 }}>

      {/* ── Page header ── */}
      <div className="ws-header">
        <div>
          <h1 className="ws-title">Transactions</h1>
          <p className="ws-subtitle">
            {filteredExpenses.length + filteredIncome.length} transactions
            {' · '}
            <span style={{ color: 'var(--red-500)' }}>{sym}{Math.round(totalExpAmt).toLocaleString('en-IN')} out</span>
            {' · '}
            <span style={{ color: 'var(--green-600)' }}>{sym}{Math.round(totalIncAmt).toLocaleString('en-IN')} in</span>
            {' · Net: '}
            <span style={{ color: netAmt >= 0 ? 'var(--green-600)' : 'var(--red-500)', fontWeight: 700 }}>
              {netAmt >= 0 ? '+' : '−'}{sym}{Math.abs(netAmt).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
            </span>
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={onAddExpense} className="ws-cta-btn ws-cta-red">
            <Plus size={12} /> Expense
          </button>
          <button onClick={onAddIncome} className="ws-cta-btn ws-cta-green">
            <Plus size={12} /> Income
          </button>
          <button onClick={() => setShowAllModal(true)} className="ws-cta-btn">
            <Filter size={12} /> All records
          </button>
        </div>
      </div>

      {/* ── Summary strip ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 20 }}>
        {[
          { label: 'Total Out', value: `−${sym}${Math.round(totalExpAmt).toLocaleString('en-IN')}`, color: 'var(--red-500)', bg: 'var(--red-50)', icon: <ArrowUpRight size={14} /> },
          { label: 'Total In',  value: `+${sym}${Math.round(totalIncAmt).toLocaleString('en-IN')}`, color: 'var(--green-600)', bg: 'var(--green-50)', icon: <ArrowDownRight size={14} /> },
          { label: 'Net',       value: `${netAmt >= 0 ? '+' : '−'}${sym}${Math.abs(netAmt).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`, color: netAmt >= 0 ? 'var(--green-600)' : 'var(--red-500)', bg: netAmt >= 0 ? 'var(--green-50)' : 'var(--red-50)', icon: null },
        ].map(card => (
          <div
            key={card.label}
            style={{
              background: card.bg,
              border: `1px solid ${card.color}22`,
              borderRadius: 'var(--r-xl)',
              padding: '14px 18px',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
            }}
          >
            {card.icon && (
              <div style={{ width: 32, height: 32, borderRadius: 'var(--r-md)', background: `${card.color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: card.color }}>
                {card.icon}
              </div>
            )}
            <div>
              <div style={{ fontSize: '0.6875rem', fontWeight: 700, color: 'var(--text-400)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 }}>{card.label}</div>
              <div style={{ fontSize: '1.125rem', fontWeight: 800, color: card.color, fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.02em' }}>{card.value}</div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Filters: tabs + search ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        <div className="ws-tab-bar">
          {(['all', 'expenses', 'income'] as Tab[]).map(t => (
            <button
              key={t}
              className={`ws-tab${tab === t ? ' active' : ''}`}
              onClick={() => setTab(t)}
            >
              {t === 'all' ? 'All' : t === 'expenses' ? `Expenses (${filteredExpenses.length})` : `Income (${filteredIncome.length})`}
            </button>
          ))}
        </div>

        <div style={{ position: 'relative', flex: 1, minWidth: 200, maxWidth: 360 }}>
          <Search size={13} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-400)', pointerEvents: 'none' }} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search transactions…"
            style={{
              width: '100%',
              paddingLeft: 34,
              paddingRight: 12,
              paddingTop: 8,
              paddingBottom: 8,
              border: '1.5px solid var(--border-default)',
              borderRadius: 'var(--r-md)',
              fontSize: '0.8125rem',
              background: 'var(--bg-surface)',
              color: 'var(--text-900)',
              outline: 'none',
              fontFamily: 'inherit',
              transition: 'border-color 0.15s, box-shadow 0.15s',
            }}
            onFocus={e => { e.target.style.borderColor = 'var(--brand-500)'; e.target.style.boxShadow = '0 0 0 3px rgba(99,102,241,0.1)'; }}
            onBlur={e => { e.target.style.borderColor = 'var(--border-default)'; e.target.style.boxShadow = 'none'; }}
          />
        </div>
      </div>

      {/* ── Transaction list ── */}
      <div
        className="panel"
        style={{ padding: 0, overflow: 'hidden' }}
      >
        {grouped.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">📭</div>
            <div className="empty-state-title">No transactions found</div>
            <div className="empty-state-subtitle">
              {search ? 'Try a different search term' : 'Add your first transaction using the buttons above'}
            </div>
          </div>
        ) : (
          <div className="ws-txn-list" style={{ padding: '8px 0' }}>
            {grouped.map(([date, rows]) => (
              <div key={date} className="ws-txn-group">
                <div className="ws-txn-date-header">
                  <span>
                    {new Date(date + 'T12:00:00').toLocaleDateString('en-IN', {
                      weekday: 'long', day: 'numeric', month: 'short',
                    })}
                  </span>
                  <span className="ws-txn-date-total">
                    {rows.filter(r => r._type === 'expense').reduce((s, r) => s + r.amount, 0) > 0
                      ? `−${sym}${Math.round(rows.filter(r => r._type === 'expense').reduce((s, r) => s + r.amount, 0)).toLocaleString('en-IN')}`
                      : ''}
                  </span>
                </div>

                {rows.map(row => {
                  const catId = (row as { category?: string; category_id?: string }).category_id
                    ?? (row as { category?: string }).category
                    ?? '';

                  return (
                    <div key={row.id} className="ws-txn-row">
                      <div
                        className="ws-txn-icon"
                        style={{
                          background: row._type === 'expense'
                            ? `${getCatColor(catId)}18`
                            : 'var(--green-50)',
                        }}
                      >
                        <span style={{ fontSize: '1.0625rem' }}>
                          {row._type === 'expense' ? getCatIcon(catId) : '💰'}
                        </span>
                      </div>

                      <div className="ws-txn-info">
                        <div className="ws-txn-desc">{row._type === 'expense' ? row.description : (row as { source?: string }).source || 'Income'}</div>
                        <div className="ws-txn-meta">
                          {getCatName(catId)}
                          {(row as { city?: string }).city && ` · ${(row as { city?: string }).city}`}
                        </div>
                      </div>

                      <div
                        className="ws-txn-amount num-mono"
                        style={{ color: row._type === 'expense' ? 'var(--red-500)' : 'var(--green-600)' }}
                      >
                        {row._type === 'expense' ? '−' : '+'}{sym}{row.amount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                      </div>

                      <button
                        onClick={() => row._type === 'expense' ? deleteExpense(row.id) : deleteIncome(row.id)}
                        className="ws-txn-delete"
                        title="Delete"
                        aria-label="Delete transaction"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        )}
      </div>

      <AllExpensesModal isOpen={showAllModal} onClose={() => setShowAllModal(false)} />
    </div>
  );
}
