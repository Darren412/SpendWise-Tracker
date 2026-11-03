import { Category, Expense, Income } from '@/types';
import { getEffectiveTax } from '@/lib/tax';
import { fundingSource } from '@/lib/reserve';

export interface TransactionFilters {
  search: string;
  dateFrom?: string; dateTo?: string;   // when either is set it REPLACES the selected financial period
  categoryIds: string[];                 // [] = all
  type: 'all' | 'expense' | 'income';
  amountMin?: number; amountMax?: number;
  recurring: 'all' | 'only' | 'exclude';
  tax: 'all' | 'only' | 'deductible' | 'non-deductible' | 'exclude';
  city?: string;                         // '' / undefined = all
  funding: 'all' | 'budget' | 'reserve' | 'split';  // expenses only — income excluded when non-'all'
}

export const EMPTY_FILTERS: TransactionFilters = {
  search: '',
  categoryIds: [],
  type: 'all',
  recurring: 'all',
  tax: 'all',
  funding: 'all',
};

export type TxnRow = (Expense & { _type: 'expense' }) | (Income & { _type: 'income' });

export interface FilterContext {
  periodStart: Date;
  periodEnd: Date;
  selectedCity: string;              // 'Both' = no global city scoping
  excludedCategoryIds: string[];     // expense-category exclusions ([] = nothing excluded)
  categories: Category[];
}

// Dates are stored as 'YYYY-MM-DD'; parse as LOCAL midnight to match the
// period boundaries produced by getFinancialMonthRange.
function txnDate(iso: string): Date {
  return new Date(iso + 'T00:00:00');
}

function matchesSearch(haystacks: (string | undefined)[], q: string): boolean {
  return haystacks.some(h => (h ?? '').toLowerCase().includes(q));
}

export function applyTransactionFilters(
  expenses: Expense[],
  income: Income[],
  filters: TransactionFilters,
  ctx: FilterContext
): TxnRow[] {
  const q = filters.search.trim().toLowerCase();
  const hasCustomRange = !!(filters.dateFrom || filters.dateTo);
  const catFilter = filters.categoryIds.length > 0 ? new Set(filters.categoryIds) : null;

  const inRange = (iso: string): boolean => {
    const d = txnDate(iso);
    if (hasCustomRange) {
      if (filters.dateFrom && d < txnDate(filters.dateFrom)) return false;
      if (filters.dateTo && d > txnDate(filters.dateTo)) return false;
      return true;
    }
    return d >= ctx.periodStart && d <= ctx.periodEnd;
  };

  const taxPass = (txn: { tax?: import('@/types').TaxInfo; category?: string; date?: string }): boolean => {
    if (filters.tax === 'all') return true;
    const eff = getEffectiveTax(txn, ctx.categories);
    switch (filters.tax) {
      case 'only':           return !!eff?.isTaxRelated;
      case 'deductible':     return !!(eff?.isTaxRelated && eff.deductible);
      case 'non-deductible': return !!(eff?.isTaxRelated && !eff.deductible);
      case 'exclude':        return !eff?.isTaxRelated;
      default:               return true;
    }
  };

  const recurringPass = (txn: { recurringId?: string }): boolean =>
    filters.recurring === 'all' ||
    (filters.recurring === 'only' ? !!txn.recurringId : !txn.recurringId);

  const amountPass = (amount: number): boolean =>
    (filters.amountMin === undefined || amount >= filters.amountMin) &&
    (filters.amountMax === undefined || amount <= filters.amountMax);

  const categoryPass = (category: string | undefined): boolean =>
    !catFilter || (!!category && catFilter.has(category));

  const out: TxnRow[] = [];

  if (filters.type !== 'income') {
    for (const e of expenses) {
      if (!inRange(e.date)) continue;
      // Global city scope: uncategorised-city expenses stay visible under 'Both'
      if (ctx.selectedCity !== 'Both' && e.city && e.city !== ctx.selectedCity) continue;
      if (ctx.excludedCategoryIds.length > 0 && ctx.excludedCategoryIds.includes(e.category)) continue;
      if (filters.city && (e.city ?? 'Bangalore') !== filters.city) continue;
      if (!categoryPass(e.category)) continue;
      if (!amountPass(e.amount)) continue;
      if (!recurringPass(e)) continue;
      if (!taxPass(e)) continue;
      if (filters.funding !== 'all' && fundingSource(e) !== filters.funding) continue;
      if (q) {
        const eff = getEffectiveTax(e, ctx.categories);
        if (!matchesSearch(
          [e.description, e.payee, e.notes, ctx.categories.find(c => c.id === e.category)?.name, e.city, eff?.taxCategory],
          q
        )) continue;
      }
      out.push({ ...e, _type: 'expense' });
    }
  }

  // Income rows have no funding — any non-'all' funding filter excludes them
  if (filters.type !== 'expense' && filters.funding === 'all') {
    for (const i of income) {
      if (!inRange(i.date)) continue;
      // Category filter applies to income too when income.category is set;
      // income without a category can't match an explicit category filter
      if (!categoryPass(i.category)) continue;
      if (!amountPass(i.amount)) continue;
      if (!recurringPass(i)) continue;
      if (!taxPass(i)) continue;
      if (q) {
        const eff = getEffectiveTax(i, ctx.categories);
        if (!matchesSearch(
          [i.source, i.notes, ctx.categories.find(c => c.id === i.category)?.name, eff?.taxCategory],
          q
        )) continue;
      }
      out.push({ ...i, _type: 'income' });
    }
  }

  return out;
}

/** Human-readable filter summary lines for report headers/footers. */
export function describeFilters(
  f: TransactionFilters,
  categories: Category[],
  sym: string,
  period?: { label: string; range: string } // shown when no custom range is set
): string[] {
  const out: string[] = [];
  const catName = (id: string) => categories.find(c => c.id === id)?.name ?? id;

  if (f.dateFrom || f.dateTo) {
    const fmt = (d?: string) => d
      ? new Date(d + 'T12:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
      : '…';
    out.push(`Date: ${fmt(f.dateFrom)} – ${fmt(f.dateTo)}`);
  } else if (period) {
    out.push(`Period: ${period.label}${period.range ? ` (${period.range})` : ''}`);
  }
  if (f.categoryIds.length > 0) out.push(`Category: ${f.categoryIds.map(catName).join(', ')}`);
  if (f.type === 'expense') out.push('Type: Expenses only');
  if (f.type === 'income') out.push('Type: Income only');
  if (f.amountMin !== undefined) out.push(`Amount ≥ ${sym}${f.amountMin}`);
  if (f.amountMax !== undefined) out.push(`Amount ≤ ${sym}${f.amountMax}`);
  if (f.recurring === 'only') out.push('Recurring: only');
  if (f.recurring === 'exclude') out.push('Recurring: excluded');
  const taxLabels: Record<TransactionFilters['tax'], string> = {
    only: 'tax-related only', deductible: 'deductible only',
    'non-deductible': 'non-deductible only', exclude: 'not tax-related',
    all: '',
  };
  if (f.tax !== 'all') out.push(`Tax: ${taxLabels[f.tax]}`);
  const fundingLabels: Record<TransactionFilters['funding'], string> = {
    budget: 'monthly budget', reserve: 'reserve', split: 'split', all: '',
  };
  if (f.funding !== 'all') out.push(`Funding: ${fundingLabels[f.funding]}`);
  if (f.city) out.push(`City: ${f.city}`);
  if (f.search.trim()) out.push(`Search: "${f.search.trim()}"`);
  return out;
}

/** Number of filter dimensions that differ from EMPTY_FILTERS. */
export function countActiveFilters(f: TransactionFilters): number {
  let n = 0;
  if (f.search.trim()) n++;
  if (f.dateFrom) n++;
  if (f.dateTo) n++;
  if (f.categoryIds.length > 0) n++;
  if (f.type !== 'all') n++;
  if (f.amountMin !== undefined) n++;
  if (f.amountMax !== undefined) n++;
  if (f.recurring !== 'all') n++;
  if (f.tax !== 'all') n++;
  if (f.funding !== 'all') n++;
  if (f.city) n++;
  return n;
}
