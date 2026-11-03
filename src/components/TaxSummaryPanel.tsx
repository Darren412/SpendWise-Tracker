'use client';

import { useMemo, useState } from 'react';
import { Receipt } from 'lucide-react';
import { useBudgetStore } from '@/store/budgetStore';
import { summarizeTax, taxYearForDate } from '@/lib/tax';
import { todayLocalISO } from '@/utils/financialCycle';
import { formatCurrency } from '@/utils/currency';
import { TxnRow } from '@/lib/transactionFilters';

/**
 * Tax Summary panel — per tax year, groups tax-tagged transactions by tax
 * category with deductible / non-deductible totals for expenses and income.
 */
export default function TaxSummaryPanel() {
  const { expenses, income, categories, currency } = useBudgetStore();

  const rows = useMemo<TxnRow[]>(
    () => [
      ...expenses.map(e => ({ ...e, _type: 'expense' as const })),
      ...income.map(i => ({ ...i, _type: 'income' as const })),
    ],
    [expenses, income]
  );
  const summary = useMemo(() => summarizeTax(rows, categories), [rows, categories]);
  const years = Object.keys(summary).sort();

  const currentFY = taxYearForDate(todayLocalISO());
  const [chosen, setChosen] = useState('');
  const activeYear = chosen || (years.includes(currentFY) ? currentFY : years[years.length - 1] ?? currentFY);

  const yearData = summary[activeYear];
  const catNames = yearData
    ? [...new Set([...Object.keys(yearData.expense), ...Object.keys(yearData.income)])].sort()
    : [];

  const thStyle: React.CSSProperties = {
    fontSize: '0.625rem', fontWeight: 700, color: 'var(--text-400)',
    textTransform: 'uppercase', letterSpacing: '0.07em', textAlign: 'right',
  };

  return (
    <div className="panel" style={{ marginTop: 24, padding: '20px 24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, marginBottom: 16 }}>
        <h3 style={{
          fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-400)',
          textTransform: 'uppercase', letterSpacing: '0.09em',
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <Receipt size={14} style={{ color: 'var(--amber-500)' }} />
          Tax Summary
        </h3>
        {years.length > 0 && (
          <select
            value={activeYear}
            onChange={e => setChosen(e.target.value)}
            aria-label="Tax year"
            style={{
              padding: '6px 10px', borderRadius: 'var(--r-sm)',
              border: '1.5px solid var(--border-default)',
              background: 'var(--bg-surface)', color: 'var(--text-700)',
              fontSize: '0.8125rem', fontWeight: 600, fontFamily: 'inherit', outline: 'none',
            }}
          >
            {years.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        )}
      </div>

      {catNames.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '32px 16px' }}>
          <div style={{ fontSize: 30, marginBottom: 10 }}>🧾</div>
          <div style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-700)', marginBottom: 4 }}>
            Nothing tax-tagged {years.length === 0 ? 'yet' : `in ${activeYear}`}
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-400)' }}>
            Mark transactions or categories as tax-related to see deductible and non-deductible totals here.
          </div>
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 520 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-default)' }}>
                <th style={{ ...thStyle, textAlign: 'left', padding: '0 8px 8px 0' }}>Tax category</th>
                <th style={{ ...thStyle, padding: '0 8px 8px' }}>Expenses · deductible</th>
                <th style={{ ...thStyle, padding: '0 8px 8px' }}>Expenses · other</th>
                <th style={{ ...thStyle, padding: '0 8px 8px' }}>Income · deductible</th>
                <th style={{ ...thStyle, padding: '0 0 8px 8px' }}>Income · other</th>
              </tr>
            </thead>
            <tbody>
              {catNames.map(name => {
                const e = yearData.expense[name];
                const i = yearData.income[name];
                const cell = (b: typeof e | typeof i, key: 'deductible' | 'nonDeductible'): string =>
                  b && b[key] > 0 ? formatCurrency(b[key], currency) : '—';
                return (
                  <tr key={name} style={{ borderBottom: '1px solid var(--bg-muted)' }}>
                    <td style={{ padding: '9px 8px 9px 0', fontSize: '0.8125rem', fontWeight: 700, color: 'var(--text-800)' }}>
                      {name}
                      <span style={{ fontSize: '0.68rem', fontWeight: 500, color: 'var(--text-400)', marginLeft: 8 }}>
                        {(e?.count ?? 0) + (i?.count ?? 0)} txn{(e?.count ?? 0) + (i?.count ?? 0) !== 1 ? 's' : ''}
                      </span>
                    </td>
                    <td style={{ padding: '9px 8px', textAlign: 'right', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--green-600)', fontVariantNumeric: 'tabular-nums' }}>{cell(e, 'deductible')}</td>
                    <td style={{ padding: '9px 8px', textAlign: 'right', fontSize: '0.8125rem', color: 'var(--text-600)', fontVariantNumeric: 'tabular-nums' }}>{cell(e, 'nonDeductible')}</td>
                    <td style={{ padding: '9px 8px', textAlign: 'right', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--green-600)', fontVariantNumeric: 'tabular-nums' }}>{cell(i, 'deductible')}</td>
                    <td style={{ padding: '9px 0 9px 8px', textAlign: 'right', fontSize: '0.8125rem', color: 'var(--text-600)', fontVariantNumeric: 'tabular-nums' }}>{cell(i, 'nonDeductible')}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
