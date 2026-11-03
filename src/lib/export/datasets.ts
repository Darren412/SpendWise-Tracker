import { Category } from '@/types';
import { getEffectiveTax } from '@/lib/tax';
import { TxnRow } from '@/lib/transactionFilters';
import { MonthPointMoM } from '@/lib/trends';
import { TaxSummary } from '@/lib/tax';
import { YearBalance, getYearBalance } from '@/lib/balance';
import { fundingSource, fundingParts, ReserveEntry, ReserveTransfer } from '@/lib/reserve';
import { CsvColumn } from '@/lib/export/csv';

export interface Dataset {
  columns: CsvColumn[];
  rows: Record<string, unknown>[];
  totals?: Record<string, unknown>;
  /** Optional labelled KPIs for the PDF summary strip (falls back to totals). */
  summary?: { label: string; value: string | number }[];
}

// ── Transactions ──────────────────────────────────────────────────────────

export function transactionsDataset(rows: TxnRow[], categories: Category[]): Dataset {
  const catName = (id?: string) => categories.find(c => c.id === id)?.name ?? (id ?? '');
  const FUNDING_LABEL = { budget: 'Monthly Budget', reserve: 'Reserve', split: 'Split' } as const;
  const data = rows.map(r => {
    const isExp = r._type === 'expense';
    const effTax = getEffectiveTax(r, categories);
    const parts = isExp ? fundingParts(r) : null;
    return {
      date: r.date,
      type: isExp ? 'Expense' : 'Income',
      description: isExp ? r.description : (r.source ?? ''),
      payee: isExp ? (r.payee ?? '') : '',
      category: isExp ? catName(r.category) : (r.category ? catName(r.category) : ''),
      city: isExp ? (r.city ?? '') : '',
      amount: r.amount,
      signedAmount: isExp ? -r.amount : r.amount,
      fundingSource: isExp ? FUNDING_LABEL[fundingSource(r)] : '',
      budgetPortion: isExp ? parts!.budget : '',
      reservePortion: isExp ? parts!.reserve : '',
      recurring: !!r.recurringId,
      taxRelated: !!effTax?.isTaxRelated,
      taxCategory: effTax?.isTaxRelated ? (effTax.taxCategory ?? '') : '',
      taxYear: effTax?.isTaxRelated ? (effTax.taxYear ?? '') : '',
      deductible: effTax?.isTaxRelated ? !!effTax.deductible : '',
      taxNotes: effTax?.isTaxRelated ? (effTax.notes ?? '') : '',
      notes: r.notes ?? '',
    };
  });
  const income = rows.filter(r => r._type === 'income').reduce((s, r) => s + r.amount, 0);
  const expenses = rows.filter(r => r._type === 'expense').reduce((s, r) => s + r.amount, 0);
  const regular = rows.filter(r => r._type === 'expense').reduce((s, r) => s + fundingParts(r).budget, 0);
  const reserve = expenses - regular;
  return {
    columns: [
      { key: 'date', header: 'Date' },
      { key: 'type', header: 'Type' },
      { key: 'description', header: 'Description / Source' },
      { key: 'payee', header: 'Payee' },
      { key: 'category', header: 'Category' },
      { key: 'city', header: 'City' },
      { key: 'amount', header: 'Amount' },
      { key: 'signedAmount', header: 'Signed Amount' },
      { key: 'fundingSource', header: 'Funding Source' },
      { key: 'budgetPortion', header: 'Budget Portion' },
      { key: 'reservePortion', header: 'Reserve Portion' },
      { key: 'recurring', header: 'Recurring' },
      { key: 'taxRelated', header: 'Tax Related' },
      { key: 'taxCategory', header: 'Tax Category' },
      { key: 'taxYear', header: 'Tax Year' },
      { key: 'deductible', header: 'Deductible' },
      { key: 'taxNotes', header: 'Tax Notes' },
      { key: 'notes', header: 'Notes' },
    ],
    rows: data,
    totals: {
      description: 'Total', amount: '', signedAmount: income - expenses,
      budgetPortion: regular, reservePortion: reserve,
      recurring: '', taxRelated: '',
    },
    summary: [
      { label: 'Income', value: income },
      { label: 'Regular expenses', value: regular },
      { label: 'Reserve expenses', value: reserve },
      { label: 'Total actual expenses', value: expenses },
      { label: 'Net', value: income - expenses },
    ],
  };
}

// ── Monthly summary ───────────────────────────────────────────────────────

export function monthlySummaryDataset(series: MonthPointMoM[], ledger?: YearBalance[], transfers?: ReserveTransfer[]): Dataset {
  const hasBalance = (ledger?.length ?? 0) > 0;
  const balAt = (p: MonthPointMoM) => {
    const mb = ledger ? getYearBalance(ledger, p.year)?.months[+p.month - 1] : undefined;
    return mb && !mb.beforeBaseline ? mb : undefined;
  };
  const transfersIn = (p: MonthPointMoM, dir: 'in' | 'out') =>
    (transfers ?? []).filter(t => t.direction === dir && t.date >= p.start && t.date <= p.end)
      .reduce((s, t) => s + t.amount, 0);
  const rows = series.map(p => ({
    month: `${p.label} (${p.start} – ${p.end})`,
    income: p.income,
    incomeMoM: p.incomeMoM ?? '',
    expenses: p.expenses,                                  // regular (budget portions)
    expensesMoM: p.expensesMoM ?? '',
    reserveFundedExpenses: p.reserveTxnTotal,              // full amount of pure-reserve txns
    splitFundedExpenses: p.splitTxnTotal,                  // full amount of split txns
    actualExpenses: p.actualExpenses,
    netCashFlow: p.netCashFlow,
    savings: p.savings,                                    // operating: income − regular
    savingsMoM: p.savingsMoM ?? '',
    savingsRate: p.savingsRate ?? '',
    budget: p.budget ?? '',
    budgetSpent: p.budgetSpent,
    budgetUsedPct: p.budgetUsedPct ?? '',
    reserveIn: transfersIn(p, 'in'),                       // allocations — never income/expense
    reserveOut: transfersIn(p, 'out'),
    reserveSpend: p.reserveExpenses,                       // reserve portions spent
    txnCount: p.txnCount,
    ...(hasBalance ? {
      openingBalance: balAt(p)?.opening ?? '',
      closingBalance: balAt(p)?.closing ?? '',
    } : {}),
  }));
  const totals = {
    month: 'Total',
    income: series.reduce((s, p) => s + p.income, 0),
    expenses: series.reduce((s, p) => s + p.expenses, 0),
    reserveFundedExpenses: series.reduce((s, p) => s + p.reserveTxnTotal, 0),
    splitFundedExpenses: series.reduce((s, p) => s + p.splitTxnTotal, 0),
    actualExpenses: series.reduce((s, p) => s + p.actualExpenses, 0),
    netCashFlow: series.reduce((s, p) => s + p.netCashFlow, 0),
    savings: series.reduce((s, p) => s + p.savings, 0),
    reserveIn: series.reduce((s, p) => s + transfersIn(p, 'in'), 0),
    reserveOut: series.reduce((s, p) => s + transfersIn(p, 'out'), 0),
    reserveSpend: series.reduce((s, p) => s + p.reserveExpenses, 0),
    txnCount: series.reduce((s, p) => s + p.txnCount, 0),
  };
  return {
    columns: [
      { key: 'month', header: 'Month' },
      { key: 'income', header: 'Income' },
      { key: 'incomeMoM', header: 'Income MoM %' },
      { key: 'expenses', header: 'Regular Expenses' },
      { key: 'expensesMoM', header: 'Expenses MoM %' },
      { key: 'reserveFundedExpenses', header: 'Reserve-Funded Expenses' },
      { key: 'splitFundedExpenses', header: 'Split-Funded Expenses' },
      { key: 'actualExpenses', header: 'Total Actual Expenses' },
      { key: 'netCashFlow', header: 'Net Cash Flow' },
      { key: 'savings', header: 'Operating Savings' },
      { key: 'savingsMoM', header: 'Savings MoM %' },
      { key: 'savingsRate', header: 'Operating Rate %' },
      { key: 'budget', header: 'Budget' },
      { key: 'budgetSpent', header: 'Tracked Spend' },
      { key: 'budgetUsedPct', header: 'Budget Used %' },
      { key: 'reserveIn', header: 'Reserve Contributions' },
      { key: 'reserveOut', header: 'Reserve Releases' },
      { key: 'reserveSpend', header: 'Reserve Spend' },
      { key: 'txnCount', header: 'Transactions' },
      ...(hasBalance ? [
        { key: 'openingBalance', header: 'Opening Balance' },
        { key: 'closingBalance', header: 'Closing Balance' },
      ] : []),
    ],
    rows,
    totals,
    summary: [
      { label: 'Income', value: totals.income },
      { label: 'Regular expenses', value: totals.expenses },
      { label: 'Reserve expenses', value: totals.reserveSpend },
      { label: 'Total actual expenses', value: totals.actualExpenses },
      { label: 'Operating surplus', value: totals.savings },
      ...(hasBalance ? [{
        label: 'Overall balance',
        value: getYearBalance(ledger!, series[series.length - 1]?.year ?? 0)?.closing ?? '',
      }] : []),
    ],
  };
}

// ── Category spending ─────────────────────────────────────────────────────

export function categorySpendingDataset(rows: TxnRow[], categories: Category[]): Dataset {
  const expenseRows = rows.filter(r => r._type === 'expense');
  const grandTotal = expenseRows.reduce((s, r) => s + r.amount, 0);
  const byCat = new Map<string, { total: number; count: number }>();
  for (const r of expenseRows) {
    const cur = byCat.get(r.category) ?? { total: 0, count: 0 };
    cur.total += r.amount;
    cur.count += 1;
    byCat.set(r.category, cur);
  }
  const data = [...byCat.entries()]
    .map(([catId, v]) => {
      const cat = categories.find(c => c.id === catId);
      return {
        category: cat?.name ?? catId,
        icon: cat?.icon ?? '',
        total: v.total,
        count: v.count,
        share: grandTotal > 0 ? Math.round((v.total / grandTotal) * 1000) / 10 : 0,
        avg: v.count > 0 ? Math.round((v.total / v.count) * 100) / 100 : 0,
      };
    })
    .sort((a, b) => b.total - a.total);
  return {
    columns: [
      { key: 'category', header: 'Category' },
      { key: 'icon', header: 'Icon' },
      { key: 'total', header: 'Total Spent' },
      { key: 'count', header: 'Transactions' },
      { key: 'share', header: 'Share %' },
      { key: 'avg', header: 'Avg per Txn' },
    ],
    rows: data,
    totals: {
      category: 'Total', total: grandTotal,
      count: expenseRows.length, share: grandTotal > 0 ? 100 : 0,
    },
  };
}

// ── Budget report ─────────────────────────────────────────────────────────

export interface BudgetReportDataset extends Dataset {
  /** Optional per-category tracked-spend breakdown (Phase 3 passes budgets). */
  categorySection?: Dataset;
}

export function budgetReportDataset(
  series: { label: string; budget: number | null; budgetSpent: number; budgetUsedPct: number | null }[],
  categoryBudgets?: Record<string, number>,
  categories?: Category[]
): BudgetReportDataset {
  const status = (b: number | null, pct: number | null): string =>
    b === null ? 'No budget' : (pct ?? 0) >= 100 ? 'Exceeded' : (pct ?? 0) >= 80 ? 'Warning' : 'Under';

  const rows = series.map(p => ({
    month: p.label,
    budget: p.budget ?? '',
    spent: p.budgetSpent,
    remaining: p.budget !== null ? Math.round((p.budget - p.budgetSpent) * 100) / 100 : '',
    usedPct: p.budgetUsedPct ?? '',
    status: status(p.budget, p.budgetUsedPct),
  }));

  const result: BudgetReportDataset = {
    columns: [
      { key: 'month', header: 'Month' },
      { key: 'budget', header: 'Budget' },
      { key: 'spent', header: 'Tracked Spend' },
      { key: 'remaining', header: 'Remaining' },
      { key: 'usedPct', header: 'Utilisation %' },
      { key: 'status', header: 'Status' },
    ],
    rows,
  };

  if (categoryBudgets && categories) {
    result.categorySection = {
      columns: [
        { key: 'category', header: 'Category' },
        { key: 'budget', header: 'Budget' },
      ],
      rows: Object.entries(categoryBudgets).map(([id, b]) => ({
        category: categories.find(c => c.id === id)?.name ?? id,
        budget: b,
      })),
    };
  }

  return result;
}

// ── Tax report ────────────────────────────────────────────────────────────

export function taxDataset(summary: TaxSummary): Dataset {
  const rows: Record<string, unknown>[] = [];
  let dedTotal = 0, nonDedTotal = 0;
  for (const year of Object.keys(summary).sort()) {
    const buckets = summary[year];
    const names = [...new Set([...Object.keys(buckets.expense), ...Object.keys(buckets.income)])].sort();
    for (const name of names) {
      for (const type of ['expense', 'income'] as const) {
        const b = buckets[type][name];
        if (!b) continue;
        rows.push({
          taxYear: year,
          taxCategory: name,
          type: type === 'expense' ? 'Expense' : 'Income',
          deductible: b.deductible,
          nonDeductible: b.nonDeductible,
          count: b.count,
        });
        dedTotal += b.deductible;
        nonDedTotal += b.nonDeductible;
      }
    }
  }
  return {
    columns: [
      { key: 'taxYear', header: 'Tax Year' },
      { key: 'taxCategory', header: 'Tax Category' },
      { key: 'type', header: 'Type' },
      { key: 'deductible', header: 'Deductible' },
      { key: 'nonDeductible', header: 'Non-Deductible' },
      { key: 'count', header: 'Transactions' },
    ],
    rows,
    totals: { taxCategory: 'Total', deductible: dedTotal, nonDeductible: nonDedTotal },
  };
}

// ── Reserve ledger ──────────────────────────────────────────────────────────

export interface ReserveLedgerDataset extends Dataset {
  /** Range summary: opening/closing reserve + period flows. */
  reserveSummary: {
    opening: number;
    contributions: number;
    releases: number;
    spend: number;
    closing: number;
  };
}

const RESERVE_KIND_LABEL: Record<ReserveEntry['kind'], string> = {
  in: 'Added', out: 'Released', spend: 'Major expense',
};

/**
 * Ledger rows inside [from,to] (both inclusive); when no range is given the
 * whole ledger is exported. Amount is signed: +in, −out/spend.
 */
export function reserveLedgerDataset(
  ledger: ReserveEntry[],
  range?: { from: string; to: string },
): ReserveLedgerDataset {
  const before = range ? ledger.filter(e => e.date < range.from) : [];
  const opening = before.length ? before[before.length - 1].balanceAfter : 0;
  const entries = range ? ledger.filter(e => e.date >= range.from && e.date <= range.to) : ledger;

  const contributions = entries.filter(e => e.kind === 'in').reduce((s, e) => s + e.amount, 0);
  const releases = entries.filter(e => e.kind === 'out').reduce((s, e) => s + e.amount, 0);
  const spend = entries.filter(e => e.kind === 'spend').reduce((s, e) => s + e.amount, 0);
  const closing = entries.length ? entries[entries.length - 1].balanceAfter : opening;

  const rows = entries.map(e => ({
    date: e.date,
    type: RESERVE_KIND_LABEL[e.kind],
    description: e.label,
    amount: e.kind === 'in' ? e.amount : -e.amount,
    balanceAfter: e.balanceAfter,
  }));

  return {
    columns: [
      { key: 'date', header: 'Date' },
      { key: 'type', header: 'Type' },
      { key: 'description', header: 'Description' },
      { key: 'amount', header: 'Amount' },
      { key: 'balanceAfter', header: 'Balance After' },
    ],
    rows,
    totals: {
      date: '', type: 'Closing reserve', description: '', amount: '', balanceAfter: closing,
    },
    summary: [
      { label: 'Opening reserve', value: opening },
      { label: 'Contributions', value: contributions },
      { label: 'Releases', value: releases },
      { label: 'Reserve spend', value: spend },
      { label: 'Closing reserve', value: closing },
    ],
    reserveSummary: { opening, contributions, releases, spend, closing },
  };
}
