'use client';

import { useState } from 'react';
import { FileSpreadsheet, Download, Calendar, MapPin, Tag, FileText, FileDown, Loader2 } from 'lucide-react';
import { useBudgetStore } from '@/store/budgetStore';
import { formatCurrency } from '@/utils/currency';
import { formatFinancialPeriodRange, getFinancialMonthRange } from '@/utils/financialCycle';
import { applyTransactionFilters, EMPTY_FILTERS, TxnRow } from '@/lib/transactionFilters';
import { buildMonthlySeries, withMoM } from '@/lib/trends';
import { summarizeTax } from '@/lib/tax';
import { toCSV } from '@/lib/export/csv';
import {
  transactionsDataset, monthlySummaryDataset, categorySpendingDataset,
  budgetReportDataset, taxDataset, Dataset, BudgetReportDataset,
} from '@/lib/export/datasets';
import { buildReportHTML } from '@/lib/export/pdfReport';
import { downloadText } from '@/lib/export/download';
import { printHTML } from '@/lib/export/print';
import DateInput from '@/components/DateInput';
import ExportModal from '@/components/ExportModal';
import TaxSummaryPanel from '@/components/TaxSummaryPanel';

type ReportType = 'transactions' | 'monthly' | 'category' | 'budget' | 'tax';
type ReportRange = 'period' | '3' | '6' | '12' | 'custom';

const REPORT_LABELS: Record<ReportType, string> = {
  transactions: 'Transactions', monthly: 'Monthly summary', category: 'Category spending',
  budget: 'Budget report', tax: 'Tax report',
};

const RANGE_OPTIONS: { value: ReportRange; label: string }[] = [
  { value: 'period', label: 'This period' },
  { value: '3', label: 'Last 3 months' },
  { value: '6', label: 'Last 6 months' },
  { value: '12', label: 'Last 12 months' },
  { value: 'custom', label: 'Custom range' },
];

export default function ReportsWorkspace() {
  const {
    expenses, income, categories,
    selectedMonth, selectedYear, selectedCity, excludedCategoryIds,
    budgetCategoryIds, getMonthlyBudget, financialCycleStart, currency,
    categoryBudgets,
  } = useBudgetStore();

  const [showExport, setShowExport] = useState(false);

  // ── Reports & Exports card ────────────────────────────────────────────────
  const [reportType, setReportType] = useState<ReportType>('transactions');
  const [range, setRange]           = useState<ReportRange>('period');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo]     = useState('');
  const [format, setFormat]         = useState<'csv' | 'pdf'>('csv');
  const [generating, setGenerating] = useState(false);
  const [reportError, setReportError] = useState('');

  const labelStyle: React.CSSProperties = {
    display: 'block', fontSize: '0.6875rem', fontWeight: 700, color: 'var(--text-400)',
    textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 5,
  };
  const selectStyle: React.CSSProperties = {
    width: '100%', padding: '8px 11px', borderRadius: 'var(--r-sm)', fontSize: '0.8125rem',
    background: 'var(--bg-surface)', border: '1px solid var(--border-default)',
    color: 'var(--text-700)', fontFamily: 'inherit', outline: 'none',
  };

  /** Series covering the chosen range (custom → months intersecting it, capped at 24 back). */
  const rangeSeries = () => {
    const months = range === 'period' ? 1 : range === 'custom' ? 24 : parseInt(range, 10);
    const s = buildMonthlySeries(expenses, income, {
      endMonth: selectedMonth, endYear: selectedYear, months,
      financialCycleStart, selectedCity, excludedCategoryIds,
      budgetCategoryIds, getBudget: getMonthlyBudget,
    });
    if (range !== 'custom') return s;
    return s.filter(p => p.start <= customTo && p.end >= customFrom);
  };

  /** Transactions respecting global scoping (city + excluded categories) over the range. */
  const rangeRows = (): TxnRow[] => {
    const { start, end } = getFinancialMonthRange(selectedMonth, selectedYear, financialCycleStart);
    const f = range === 'period'
      ? EMPTY_FILTERS
      : range === 'custom'
        ? { ...EMPTY_FILTERS, dateFrom: customFrom, dateTo: customTo }
        : EMPTY_FILTERS; // N-month ranges are handled via the series bounds below
    // For N-month ranges, bound the filter to the oldest covered period's start
    let dateFrom = f.dateFrom, dateTo = f.dateTo;
    if (range !== 'period' && range !== 'custom') {
      const s = rangeSeries();
      if (s.length) { dateFrom = s[0].start; dateTo = s[s.length - 1].end; }
    }
    return applyTransactionFilters(expenses, income,
      { ...f, dateFrom, dateTo },
      { periodStart: start, periodEnd: end, selectedCity, excludedCategoryIds, categories });
  };

  const rangeLabel = (): string => {
    if (range === 'period') return formatFinancialPeriodRange(selectedMonth, selectedYear, financialCycleStart);
    if (range === 'custom') return `${customFrom} → ${customTo}`;
    const s = rangeSeries();
    return s.length ? `${s[0].start} → ${s[s.length - 1].end}` : '—';
  };

  const buildDataset = (): { dataset: Dataset; title: string; rangeText: string } => {
    const title = REPORT_LABELS[reportType];
    const rangeText = rangeLabel();
    switch (reportType) {
      case 'transactions':
        return { title, rangeText, dataset: transactionsDataset(rangeRows(), categories) };
      case 'monthly':
        return { title, rangeText, dataset: monthlySummaryDataset(withMoM(rangeSeries())) };
      case 'category':
        return { title, rangeText, dataset: categorySpendingDataset(rangeRows(), categories) };
      case 'budget':
        return { title, rangeText, dataset: budgetReportDataset(rangeSeries(), categoryBudgets, categories) };
      case 'tax':
        return { title, rangeText, dataset: taxDataset(summarizeTax(rangeRows(), categories)) };
    }
  };

  const generateReport = async () => {
    setReportError('');
    if (range === 'custom') {
      if (!customFrom || !customTo) { setReportError('Pick both a start and end date.'); return; }
      if (customFrom > customTo) { setReportError('Start date must be on or before the end date.'); return; }
    }
    setGenerating(true);
    try {
      const { dataset, title, rangeText } = buildDataset();
      const extra = (dataset as BudgetReportDataset).categorySection;
      if (format === 'csv') {
        let csv = toCSV(dataset.columns, dataset.rows, dataset.totals);
        if (extra) csv += toCSV(extra.columns, extra.rows).slice(1); // strip second BOM
        downloadText(csv,
          `spendwise-${reportType}-${range === 'custom' ? 'custom' : range}.csv`, 'text/csv');
      } else {
        const html = buildReportHTML({
          title: `${title} Report`,
          subtitle: 'Spendwise',
          dateRangeLabel: rangeText,
          currency,
          summary: dataset.totals
            ? Object.entries(dataset.totals).filter(([, v]) => v !== '' && v !== undefined).slice(0, 5)
                .map(([k, v]) => ({ label: k, value: typeof v === 'number' ? formatCurrency(v as number, currency) : String(v) }))
            : [],
          sections: [
            { kind: 'table', title, columns: dataset.columns, rows: dataset.rows, totalsRow: dataset.totals },
            ...(extra ? [{ kind: 'table' as const, title: 'Category budgets', columns: extra.columns, rows: extra.rows }] : []),
          ],
        });
        printHTML(html, `spendwise-${reportType}`);
      }
    } catch (err) {
      setReportError(err instanceof Error ? err.message : 'Report generation failed.');
    } finally {
      setGenerating(false);
    }
  };

  const exportCards = [
    {
      icon: <FileSpreadsheet size={22} />,
      iconBg: 'var(--green-50)',
      iconColor: 'var(--green-600)',
      label: 'Full Export',
      sub: 'All transactions to Excel',
      action: () => setShowExport(true),
    },
    {
      icon: <Calendar size={22} />,
      iconBg: 'var(--blue-50)',
      iconColor: 'var(--blue-600)',
      label: 'Cycle Report',
      sub: 'Current financial period',
      action: () => setShowExport(true),
    },
    {
      icon: <MapPin size={22} />,
      iconBg: 'var(--purple-50)',
      iconColor: 'var(--purple-600)',
      label: 'Location Report',
      sub: 'By city breakdown',
      action: () => setShowExport(true),
    },
    {
      icon: <Tag size={22} />,
      iconBg: 'var(--amber-50)',
      iconColor: 'var(--amber-600)',
      label: 'Category Report',
      sub: 'Spend by category',
      action: () => setShowExport(true),
    },
  ];

  return (
    <div style={{ maxWidth: 1400 }}>

      {/* ── Header ── */}
      <div className="ws-header">
        <div>
          <h1 className="ws-title" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 'var(--r-md)',
              background: 'var(--brand-50)', border: '1px solid var(--brand-100)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <FileText size={16} style={{ color: 'var(--brand-600)' }} />
            </div>
            Reports
          </h1>
          <p className="ws-subtitle">Data exports · Tax summary · Historical analytics</p>
        </div>
        <button onClick={() => setShowExport(true)} className="ws-cta-btn" style={{ background: 'var(--green-600)', color: '#fff', borderColor: 'var(--green-700)', boxShadow: 'var(--shadow-green)' }}>
          <Download size={13} /> Export to Excel
        </button>
      </div>

      {/* ── Reports & Exports ── */}
      <div className="panel" style={{ padding: '18px 22px', marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
          <FileDown size={14} style={{ color: 'var(--brand-600)' }} />
          <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-400)', textTransform: 'uppercase', letterSpacing: '0.09em' }}>
            Reports &amp; Exports
          </span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10, alignItems: 'end' }}>
          <div>
            <label style={labelStyle}>Report</label>
            <select aria-label="Report type" value={reportType} onChange={e => setReportType(e.target.value as ReportType)} style={selectStyle}>
              {(Object.keys(REPORT_LABELS) as ReportType[]).map(t => (
                <option key={t} value={t}>{REPORT_LABELS[t]}</option>
              ))}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Range</label>
            <select aria-label="Report range" value={range} onChange={e => setRange(e.target.value as ReportRange)} style={selectStyle}>
              {RANGE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          {range === 'custom' && (
            <>
              <div>
                <label style={labelStyle}>From</label>
                <DateInput value={customFrom} onChange={setCustomFrom} />
              </div>
              <div>
                <label style={labelStyle}>To</label>
                <DateInput value={customTo} onChange={setCustomTo} />
              </div>
            </>
          )}
          <div>
            <label style={labelStyle}>Format</label>
            <div style={{ display: 'flex', gap: 4 }}>
              {(['csv', 'pdf'] as const).map(f => (
                <button
                  key={f}
                  onClick={() => setFormat(f)}
                  aria-pressed={format === f}
                  style={{
                    flex: 1, padding: '8px 0', borderRadius: 'var(--r-sm)', cursor: 'pointer', fontFamily: 'inherit',
                    fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase',
                    background: format === f ? 'var(--brand-600)' : 'var(--bg-surface)',
                    color: format === f ? '#fff' : 'var(--text-500)',
                    border: format === f ? '1px solid var(--brand-600)' : '1px solid var(--border-default)',
                  }}
                >
                  {f === 'csv' ? 'CSV' : 'PDF'}
                </button>
              ))}
            </div>
          </div>
          <div>
            <button
              onClick={generateReport}
              disabled={generating}
              className="ws-cta-btn"
              style={{
                width: '100%', justifyContent: 'center', padding: '8px 14px',
                background: 'var(--brand-600)', color: '#fff', borderColor: 'var(--brand-700)',
                opacity: generating ? 0.7 : 1,
              }}
            >
              {generating ? <Loader2 size={13} className="animate-spin" /> : <FileDown size={13} />}
              {generating ? 'Generating…' : 'Generate'}
            </button>
          </div>
        </div>
        {reportError && (
          <div role="alert" style={{ marginTop: 10, fontSize: '0.78rem', color: 'var(--red-500)', fontWeight: 600 }}>
            {reportError}
          </div>
        )}
        {range === 'custom' && (
          <div style={{ marginTop: 8, fontSize: '0.68rem', color: 'var(--text-400)' }}>
            Custom ranges cover the financial months they overlap (up to 24 months back).
          </div>
        )}
      </div>

      {/* ── Export cards ── */}
      <div
        className="stagger-fade"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: 12,
          marginBottom: 24,
        }}
      >
        {exportCards.map(card => (
          <button
            key={card.label}
            onClick={card.action}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 14,
              padding: '16px 20px',
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-default)',
              borderRadius: 'var(--r-xl)',
              cursor: 'pointer',
              textAlign: 'left',
              transition: 'box-shadow 0.2s, transform 0.15s, border-color 0.2s',
              fontFamily: 'inherit',
              boxShadow: 'var(--shadow-xs)',
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLButtonElement).style.boxShadow = 'var(--shadow-md)';
              (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-2px)';
              (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--border-strong)';
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLButtonElement).style.boxShadow = 'var(--shadow-xs)';
              (e.currentTarget as HTMLButtonElement).style.transform = 'none';
              (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--border-default)';
            }}
          >
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: 'var(--r-lg)',
                background: card.iconBg,
                color: card.iconColor,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              {card.icon}
            </div>
            <div>
              <div style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-900)', marginBottom: 2 }}>{card.label}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-400)' }}>{card.sub}</div>
            </div>
          </button>
        ))}
      </div>

      {/* ── Tax summary (deductible / non-deductible per tax year) ── */}
      <TaxSummaryPanel />

      <ExportModal isOpen={showExport} onClose={() => setShowExport(false)} />
    </div>
  );
}
