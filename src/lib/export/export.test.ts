import { describe, it, expect } from 'vitest';
import { toCSV } from '@/lib/export/csv';
import { transactionsDataset, monthlySummaryDataset, categorySpendingDataset, budgetReportDataset, taxDataset, reserveLedgerDataset } from '@/lib/export/datasets';
import { buildReportHTML } from '@/lib/export/pdfReport';
import { describeFilters, EMPTY_FILTERS } from '@/lib/transactionFilters';
import { summarizeTax } from '@/lib/tax';
import { withMoM, MonthPointMoM } from '@/lib/trends';
import { buildReserveLedger, ReserveTransfer } from '@/lib/reserve';
import { Category, Expense } from '@/types';
import { TxnRow } from '@/lib/transactionFilters';

const cats: Category[] = [
  { id: 'food', name: 'Dining & Food', color: '#000', icon: '🍔', type: 'expense' },
  { id: 'sal', name: 'Salary', color: '#000', icon: '💼', type: 'income' },
];

const rows: TxnRow[] = [
  { id: 'e1', _type: 'expense', category: 'food', description: 'Lunch, "special"', amount: 120, date: '2026-03-05', month: '03', year: 2026, payee: 'Café', notes: '=bad' },
  { id: 'i1', _type: 'income', source: 'Acme Corp', amount: 1000, date: '2026-03-01', month: '03', year: 2026, category: 'sal', recurringId: 'r1' },
];

describe('toCSV', () => {
  it('produces BOM-prefixed RFC 4180 output with CRLF endings', () => {
    const csv = toCSV([{ key: 'a', header: 'A' }, { key: 'b', header: 'B' }], [{ a: 1, b: 'x' }]);
    expect(csv.startsWith('﻿')).toBe(true);
    expect(csv).toContain('A,B\r\n1,x\r\n');
  });

  it('quotes fields containing comma/quote/newline and doubles quotes', () => {
    const csv = toCSV(
      [{ key: 'v', header: 'V' }],
      [{ v: 'a,b' }, { v: 'say "hi"' }, { v: 'line1\nline2' }]
    );
    expect(csv).toContain('"a,b"');
    expect(csv).toContain('"say ""hi"""');
    expect(csv).toContain('"line1\nline2"');
  });

  it('guards formula-injection on string cells only', () => {
    const csv = toCSV(
      [{ key: 'v', header: 'V' }, { key: 'n', header: 'N' }],
      [{ v: '=CMD()', n: -50 }, { v: '+x', n: 5 }]
    );
    expect(csv).toContain("'=CMD()");
    expect(csv).toContain("'+x");
    expect(csv).toContain(',-50');   // negative numbers stay raw
    expect(csv).not.toContain('"-50"');
  });

  it('formats numbers raw with max 2 decimals, booleans as Yes/No', () => {
    const csv = toCSV(
      [{ key: 'n', header: 'N' }, { key: 'b', header: 'B' }, { key: 'e', header: 'E' }],
      [{ n: 0.30000000000004, b: true, e: null }, { n: 42.125, b: false, e: undefined }]
    );
    expect(csv).toContain('0.3,Yes,');
    expect(csv).toContain('42.13,No,');
  });
});

describe('transactionsDataset', () => {
  const ds = transactionsDataset(rows, cats);

  it('emits positive Amount and Signed Amount per type', () => {
    expect(ds.rows[0].amount).toBe(120);
    expect(ds.rows[0].signedAmount).toBe(-120);
    expect(ds.rows[1].amount).toBe(1000);
    expect(ds.rows[1].signedAmount).toBe(1000);
  });

  it('resolves names, recurring and tax', () => {
    expect(ds.rows[0].category).toBe('Dining & Food');
    expect(ds.rows[1].category).toBe('Salary');
    expect(ds.rows[1].recurring).toBe(true);
    expect(ds.rows[0].recurring).toBe(false);
  });

  it('totals carry income/expenses/net/count via signed sum', () => {
    expect(ds.totals?.signedAmount).toBe(880); // 1000 - 120
  });

  it('round-trips through toCSV with injection-guarded notes', () => {
    const csv = toCSV(ds.columns, ds.rows);
    expect(csv).toContain('Lunch, ""special""');  // quoting intact
    expect(csv).toContain("'=bad");                // notes guarded
  });
});

describe('monthlySummaryDataset', () => {
  it('maps series rows incl. MoM blanks and totals', () => {
    const series: MonthPointMoM[] = withMoM([
      { key: '2026-02', month: '02', year: 2026, label: "Feb '26", start: '2026-01-25', end: '2026-02-24',
        income: 1000, expenses: 400, reserveExpenses: 0, reserveTxnTotal: 0, splitTxnTotal: 0,
        actualExpenses: 400, netCashFlow: 600, savings: 600, savingsRate: 60, budget: 500, budgetSpent: 250,
        budgetUsedPct: 50, txnCount: 7, byCategory: {}, isComplete: true, isCurrent: false },
      { key: '2026-03', month: '03', year: 2026, label: "Mar '26", start: '2026-02-25', end: '2026-03-24',
        income: 0, expenses: 100, reserveExpenses: 0, reserveTxnTotal: 0, splitTxnTotal: 0,
        actualExpenses: 100, netCashFlow: -100, savings: -100, savingsRate: null, budget: null, budgetSpent: 0,
        budgetUsedPct: null, txnCount: 2, byCategory: {}, isComplete: true, isCurrent: false },
    ]);
    const ds = monthlySummaryDataset(series);
    expect(ds.rows).toHaveLength(2);
    expect(ds.rows[1].savingsRate).toBe('');
    expect(ds.rows[1].budget).toBe('');
    expect(ds.totals?.income).toBe(1000);
    expect(ds.totals?.savings).toBe(500);
    expect(ds.totals?.txnCount).toBe(9);
  });
});

describe('categorySpendingDataset', () => {
  it('totals per category with share and avg, sorted desc', () => {
    const ds = categorySpendingDataset([
      ...rows,
      { id: 'e2', _type: 'expense', category: 'food', description: 'x', amount: 80, date: '2026-03-06', month: '03', year: 2026 },
    ] as TxnRow[], cats);
    expect(ds.rows).toHaveLength(1); // only expense categories appear
    expect(ds.rows[0].category).toBe('Dining & Food');
    expect(ds.rows[0].total).toBe(200);
    expect(ds.rows[0].count).toBe(2);
    expect(ds.rows[0].share).toBe(100);
    expect(ds.rows[0].avg).toBe(100);
  });
});

describe('budgetReportDataset', () => {
  it('statuses Under / Warning / Exceeded / No budget', () => {
    const ds = budgetReportDataset([
      { label: "Jan '26", budget: 500, budgetSpent: 100, budgetUsedPct: 20 },
      { label: "Feb '26", budget: 500, budgetSpent: 450, budgetUsedPct: 90 },
      { label: "Mar '26", budget: 500, budgetSpent: 550, budgetUsedPct: 110 },
      { label: "Apr '26", budget: null, budgetSpent: 10, budgetUsedPct: null },
    ]);
    expect(ds.rows.map(r => r.status)).toEqual(['Under', 'Warning', 'Exceeded', 'No budget']);
    expect(ds.rows[2].remaining).toBe(-50);
    expect(ds.rows[3].budget).toBe('');
  });
});

describe('taxDataset', () => {
  it('flattens year/category/type buckets with totals', () => {
    const summary = summarizeTax(
      [{ _type: 'expense' as const, amount: 100, date: '2026-05-01', category: 'x',
         tax: { isTaxRelated: true, taxCategory: '80C', deductible: true, taxYear: 'FY 2026-27' } }],
      []
    );
    const ds = taxDataset(summary);
    expect(ds.rows).toHaveLength(1);
    expect(ds.rows[0].taxCategory).toBe('80C');
    expect(ds.totals?.deductible).toBe(100);
  });
});

describe('buildReportHTML', () => {
  const html = buildReportHTML({
    title: 'Transactions <script>alert(1)</script>',
    subtitle: 'Report "v2"',
    currency: 'INR',
    summary: [{ label: 'Money out', value: '₹120' }],
    sections: [
      {
        kind: 'table', title: 'Rows',
        columns: [{ key: 'a', header: 'A' }],
        rows: [{ a: '<b>x</b>' }],
        totalsRow: { a: 'Total: 1' },
      },
      {
        kind: 'barChart', title: 'Spending',
        categories: ['Feb', 'Mar'],
        series: [
          { label: 'Income', values: [100, 200], color: '#16a34a' },
          { label: 'Expenses', values: [50, 80], color: '#ef4444' },
        ],
      },
    ],
  });

  it('escapes user-supplied strings everywhere', () => {
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('&lt;b&gt;x&lt;/b&gt;');
    expect(html).toContain('&quot;v2&quot;');
  });

  it('includes summary cards, totals row and print CSS', () => {
    expect(html).toContain('Money out');
    expect(html).toContain('Total: 1');
    expect(html).toContain('@page');
    expect(html).toContain('table-header-group');
  });

  it('renders the bar chart as inline SVG with one rect per bar', () => {
    expect(html).toContain('<svg');
    // 2 categories × 2 series = 4 bar rects (decimal coords exclude legend swatches)
    const bars = html.match(/<rect x="\d+\.\d+/g) ?? [];
    expect(bars.length).toBe(4);
    expect(html).toContain('Income');
    expect(html).toContain('Expenses');
  });
});

describe('describeFilters', () => {
  const F = (over: Partial<Parameters<typeof describeFilters>[0]> = {}) => ({ ...EMPTY_FILTERS, ...over });

  it('describes each active dimension', () => {
    const lines = describeFilters(
      F({
        search: ' uber ', categoryIds: ['food'], type: 'expense',
        amountMin: 500, amountMax: 5000, recurring: 'only', tax: 'deductible', city: 'Mangalore',
      }),
      cats, '₹', { label: "Mar '26", range: 'Feb 25 – Mar 24' }
    );
    expect(lines).toContain('Category: Dining & Food');
    expect(lines).toContain('Type: Expenses only');
    expect(lines).toContain('Amount ≥ ₹500');
    expect(lines).toContain('Amount ≤ ₹5000');
    expect(lines).toContain('Recurring: only');
    expect(lines).toContain('Tax: deductible only');
    expect(lines).toContain('City: Mangalore');
    expect(lines).toContain('Search: "uber"');
  });

  it('custom range replaces the period label', () => {
    const custom = describeFilters(F({ dateFrom: '2026-09-01', dateTo: '2026-09-30' }), cats, '₹',
      { label: "Sep '26", range: 'Aug 25 – Sep 24' });
    expect(custom[0]).toMatch(/^Date: /);
    expect(custom[0]).toMatch(/Date: 01 \w+ 2026 – 30 \w+ 2026/);
    const period = describeFilters(F(), cats, '₹', { label: "Sep '26", range: 'Aug 25 – Sep 24' });
    expect(period).toEqual(["Period: Sep '26 (Aug 25 – Sep 24)"]);
  });

  it('empty filters → empty list', () => {
    expect(describeFilters(F(), cats, '₹')).toEqual([]);
  });
});

describe('reserve funding in the transactions dataset', () => {
  const fundedRows: TxnRow[] = [
    { id: 's1', _type: 'expense', category: 'food', description: 'split', amount: 100, date: '2026-03-05', month: '03', year: 2026, funding: { source: 'split', reserveAmount: 30 } },
    { id: 'r1', _type: 'expense', category: 'food', description: 'res txn', amount: 200, date: '2026-03-06', month: '03', year: 2026, funding: { source: 'reserve' } },
  ];
  it('columns carry funding source + portions; totals split regular/reserve', () => {
    const d = transactionsDataset(fundedRows, cats);
    const headers = d.columns.map(c => c.header);
    expect(headers).toContain('Funding Source');
    expect(headers).toContain('Budget Portion');
    expect(headers).toContain('Reserve Portion');
    expect(d.rows[0].fundingSource).toBe('Split');
    expect(d.rows[0].budgetPortion).toBe(70);
    expect(d.rows[0].reservePortion).toBe(30);
    expect(d.rows[1].fundingSource).toBe('Reserve');
    expect(d.rows[1].budgetPortion).toBe(0);
    expect(d.rows[1].reservePortion).toBe(200);
    expect(d.totals?.budgetPortion).toBe(70);
    expect(d.totals?.reservePortion).toBe(230);
    // regular + reserve = actual
    expect((d.totals!.budgetPortion as number) + (d.totals!.reservePortion as number)).toBe(300);
  });
});

describe('reserve ledger dataset', () => {
  it('lists entries with signed amounts and a range summary', () => {
    const transfers: ReserveTransfer[] = [
      { id: 't1', date: '2026-01-01', amount: 600000, direction: 'in', createdAt: '2026-01-01T00:00:00Z' },
      { id: 't2', date: '2026-02-15', amount: 50000, direction: 'out', createdAt: '2026-02-15T00:00:00Z' },
    ];
    const expenses: Expense[] = [
      { id: 'e1', category: 'food', description: 'Car', amount: 300000, date: '2026-03-01', month: '03', year: 2026, funding: { source: 'reserve' } },
    ];
    const ledger = buildReserveLedger(transfers, expenses);
    const d = reserveLedgerDataset(ledger, { from: '2026-02-01', to: '2026-03-31' });
    expect(d.rows).toHaveLength(2); // Feb release + Mar spend (Jan contribution outside range)
    expect(d.reserveSummary.opening).toBe(600000);
    expect(d.reserveSummary.releases).toBe(50000);
    expect(d.reserveSummary.spend).toBe(300000);
    expect(d.reserveSummary.closing).toBe(250000);
    expect(d.rows[1].amount).toBe(-300000);
  });
});
