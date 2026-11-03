import { Category, TaxInfo } from '@/types';

/**
 * Indian financial year label for a date string ('YYYY-MM-DD'): April–March.
 *   2026-04-01 → "FY 2026-27"
 *   2027-03-31 → "FY 2026-27"
 *   2026-03-31 → "FY 2025-26"
 */
export function taxYearForDate(date: string): string {
  const [y, m] = date.split('-').map(Number);
  if (!y || !m) return 'FY Unknown';
  const fyStart = m >= 4 ? y : y - 1;
  return `FY ${fyStart}-${String((fyStart + 1) % 100).padStart(2, '0')}`;
}

/**
 * Tax info that applies to a transaction: its own `tax` wins; otherwise the
 * category's default tax is inherited — but only when the category is
 * tax-related. When inheriting and the category didn't pin a taxYear, the
 * transaction's own date determines it.
 */
export function getEffectiveTax(
  txn: { tax?: TaxInfo; category?: string; date?: string },
  categories: Category[]
): TaxInfo | undefined {
  if (txn.tax) return txn.tax;
  if (!txn.category) return undefined;
  const catTax = categories.find(c => c.id === txn.category)?.tax;
  if (!catTax || !catTax.isTaxRelated) return undefined;
  if (catTax.taxYear || !txn.date) return catTax;
  return { ...catTax, taxYear: taxYearForDate(txn.date) };
}

export interface TaxBucket {
  deductible: number;
  nonDeductible: number;
  count: number;
}

export interface TaxYearSummary {
  expense: Record<string, TaxBucket>;
  income: Record<string, TaxBucket>;
}

/** taxYear → { expense: { taxCategory → bucket }, income: { … } } */
export type TaxSummary = Record<string, TaxYearSummary>;

type TaxableRow = {
  _type: 'expense' | 'income';
  amount: number;
  tax?: TaxInfo;
  category?: string;
  date?: string;
};

const UNCATEGORISED = 'Uncategorised';

/**
 * Group tax-tagged transactions by tax year then tax category, keeping
 * deductible and non-deductible totals separate for expenses and income.
 */
export function summarizeTax(rows: TaxableRow[], categories: Category[]): TaxSummary {
  const out: TaxSummary = {};

  for (const row of rows) {
    const eff = getEffectiveTax(row, categories);
    if (!eff?.isTaxRelated) continue;

    const year = eff.taxYear ?? (row.date ? taxYearForDate(row.date) : UNCATEGORISED);
    const catName = eff.taxCategory?.trim() || UNCATEGORISED;
    const side = row._type;

    if (!out[year]) out[year] = { expense: {}, income: {} };
    const bucket = out[year][side][catName] ?? { deductible: 0, nonDeductible: 0, count: 0 };
    if (eff.deductible) bucket.deductible += row.amount;
    else bucket.nonDeductible += row.amount;
    bucket.count += 1;
    out[year][side][catName] = bucket;
  }

  return out;
}
