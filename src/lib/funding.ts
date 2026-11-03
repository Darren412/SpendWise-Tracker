import { Expense, Category, FundingSource } from '@/types';
import { getSpendClass } from '@/lib/spendClass';
import { getFinancialMonthRange, getFinancialPeriod } from '@/utils/financialCycle';
import { availableBalanceOn, BalanceLedgerInputs } from '@/lib/balance';

export type { BalanceLedgerInputs } from '@/lib/balance';

const round2 = (n: number) => Math.round(n * 100) / 100;

// ── Funding decomposition ───────────────────────────────────────────────────

/**
 * 'reserve' / `reserveAmount` are legacy aliases (pre-refactor data) — they
 * normalise to 'balance' / `balanceAmount`.
 */
export function fundingSource(e: Pick<Expense, 'funding'>): FundingSource {
  const s = e.funding?.source;
  if (s === 'reserve') return 'balance';
  return s ?? 'budget';
}

/** budget + balance === amount exactly; any rounding residue lands in budget. */
export function fundingParts(e: Pick<Expense, 'amount' | 'funding'>): { budget: number; balance: number } {
  const source = fundingSource(e);
  if (source === 'balance') return { budget: 0, balance: e.amount };
  if (source === 'split') {
    const balance = round2(Math.min(Math.max(0, e.funding?.balanceAmount ?? e.funding?.reserveAmount ?? 0), e.amount));
    return { budget: round2(e.amount - balance), balance };
  }
  return { budget: e.amount, balance: 0 };
}

/**
 * Expenses reduced to their budget ("regular") portions — the ONE helper all
 * budget/behaviour analysis uses for regular spending. Pure balance-funded
 * records drop out entirely.
 */
export function budgetPortionExpenses(expenses: Expense[]): Expense[] {
  return expenses
    .map(e => ({ ...e, amount: fundingParts(e).budget }))
    .filter(e => e.amount > 0);
}

/** Validation message for a funding choice, or null when valid. */
export function validateFunding(input: {
  amount: number; source: FundingSource; balanceAmount?: number;
}): string | null {
  if (input.source === 'split') {
    const r = input.balanceAmount;
    if (r === undefined || !Number.isFinite(r)) return 'Enter the amount paid from your existing balance.';
    if (round2(r) !== r) return 'Use at most two decimals.';
    if (r <= 0) return 'The existing-balance portion must be greater than 0.';
    if (r >= input.amount) return 'The existing-balance portion must be less than the total — use "Existing Balance" for the full amount.';
    if (round2(input.amount - r) <= 0) return 'The budget portion must be greater than 0.';
  }
  return null;
}

// ── Major expense usage ─────────────────────────────────────────────────────

/** Balance-funded portions of expenses in a date range. */
export function majorExpenseUsage(
  expenses: Expense[],
  range: { from: string; to: string },
): { total: number; count: number; items: Expense[] } {
  const items = expenses.filter(e =>
    e.date >= range.from && e.date <= range.to && fundingParts(e).balance > 0);
  return {
    total: round2(items.reduce((s, e) => s + fundingParts(e).balance, 0)),
    count: items.length,
    items,
  };
}

// ── Coverage ────────────────────────────────────────────────────────────────

export function balanceCoverage(
  balance: number,
  essentialMonthlyAvg: number | null,
): { months: number | null; status: 'ok' | 'insufficient-data' | 'no-essential-spend' } {
  if (essentialMonthlyAvg === null) return { months: null, status: 'insufficient-data' };
  if (essentialMonthlyAvg <= 0) return { months: null, status: 'no-essential-spend' };
  return { months: Math.round((balance / essentialMonthlyAvg) * 10) / 10, status: 'ok' };
}

const ISO = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/**
 * Average monthly essential spending over the last `months` COMPLETE
 * financial periods (essential-class categories, budget portions only —
 * regular essential spending, not balance-funded spikes). `avg` is null when
 * fewer than `months` complete periods exist since the first expense.
 */
export function essentialMonthlyAverage(
  expenses: Expense[],
  categories: Category[],
  opts: { financialCycleStart: number; today: string; months?: number },
): { avg: number | null; monthsUsed: number } {
  const { financialCycleStart, today } = opts;
  const n = opts.months ?? 3;
  const essentialIds = new Set(
    categories.filter(c => c.type !== 'income' && getSpendClass(c) === 'essential').map(c => c.id),
  );

  // Enumerate financial periods (by label) ending with the current one
  const cur = getFinancialPeriod(today, financialCycleStart);
  interface P { m: string; y: number; startISO: string; endISO: string }
  const periods: P[] = [];
  {
    let m = parseInt(cur.month, 10), y = cur.year;
    for (let i = 0; i < 24; i++) {
      const mm = String(m).padStart(2, '0');
      const r = getFinancialMonthRange(mm, y, financialCycleStart);
      periods.unshift({ m: mm, y, startISO: ISO(r.start), endISO: ISO(r.end) });
      m -= 1; if (m < 1) { m = 12; y -= 1; }
    }
  }

  // History start = first period containing any expense
  let historyStartIdx = -1;
  for (let i = 0; i < periods.length; i++) {
    if (expenses.some(e => e.year === periods[i].y && e.month === periods[i].m)) {
      historyStartIdx = i;
      break;
    }
  }
  if (historyStartIdx === -1) return { avg: null, monthsUsed: 0 };

  const complete = periods.filter(p => p.endISO < today && periods.indexOf(p) >= historyStartIdx);
  const baseline = complete.slice(-n);
  if (baseline.length < n) return { avg: null, monthsUsed: baseline.length };

  const regular = budgetPortionExpenses(expenses);
  const total = baseline.reduce((s, p) => s + regular
    .filter(e => e.year === p.y && e.month === p.m && essentialIds.has(e.category))
    .reduce((x, e) => x + e.amount, 0), 0);
  return { avg: total / baseline.length, monthsUsed: baseline.length };
}

// ── Recurring-generation capping ────────────────────────────────────────────

export interface MajorFundingNotice { ruleId: string; date: string; description: string; shortBy: number; }

/**
 * Caps balance portions of newly generated recurring expenses so no occurrence
 * would take the available balance below zero. Processes txns in date order;
 * each occurrence is checked against the balance INCLUDING earlier generated
 * items. A capped txn becomes a split (or budget when nothing is available)
 * and yields a notice. Pure — the store applies the result. No baseline →
 * no capping (the available balance is unbounded).
 */
export function capBalanceFunding<T extends Omit<Expense, 'month' | 'year'>>(
  newTxns: T[],
  ledger: BalanceLedgerInputs,
): { expenses: T[]; notices: MajorFundingNotice[] } {
  if (!ledger.baseline) return { expenses: [...newTxns].sort((a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : 0), notices: [] };
  const notices: MajorFundingNotice[] = [];
  const processed: T[] = [];
  const sorted = [...newTxns].sort((a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : 0);
  for (const e of sorted) {
    const part = fundingParts(e).balance;
    if (part <= 0) { processed.push(e); continue; }
    const avail = availableBalanceOn(
      { ...ledger, expenses: [...ledger.expenses, ...(processed as unknown as Expense[])] },
      e.date,
    );
    if (avail === null || part <= avail) { processed.push(e); continue; }
    const capped: T = {
      ...e,
      funding: avail <= 0 ? undefined : { source: 'split', balanceAmount: Math.round(avail * 100) / 100 },
    };
    notices.push({
      ruleId: e.recurringId ?? '',
      date: e.date,
      description: e.description,
      shortBy: Math.round((part - avail) * 100) / 100,
    });
    processed.push(capped);
  }
  return { expenses: processed, notices };
}

// ── Three-concept position summary ──────────────────────────────────────────

export interface PositionSummaryInput {
  monthlyBudget: number | null;          // this period's overall budget (null = none set)
  operatingSurplus: number;              // income − regular expenses for the period
  regularSpend?: number;                 // needed to compare vs monthlyBudget
  majorUsed: number;                     // balance-funded outflows this period
  majorCount: number;                    // balance-funded txns this period
  overallBalance: number | null;         // current-period closing to date (null w/o baseline)
  format: (v: number) => string;
}

/** One short sentence per accounting concept — only lines that apply. */
export function buildPositionSummary(s: PositionSummaryInput): string[] {
  const lines: string[] = [];

  // 1 — monthly budget performance (regular spend only)
  if (s.monthlyBudget != null && s.monthlyBudget > 0 && s.regularSpend !== undefined) {
    if (s.regularSpend <= s.monthlyBudget) {
      lines.push(`Your normal monthly budget remains within plan with a ${s.format(Math.max(0, s.operatingSurplus))} operating surplus.`);
    } else {
      lines.push(`Your normal monthly budget is ${s.format(s.regularSpend - s.monthlyBudget)} over plan.`);
    }
  } else {
    if (s.operatingSurplus >= 0) {
      lines.push(`Your month shows a ${s.format(s.operatingSurplus)} operating surplus.`);
    } else {
      lines.push(`Your month shows a ${s.format(Math.abs(s.operatingSurplus))} operating deficit.`);
    }
  }

  // 2 — major expenses paid from the existing balance this period
  if (s.majorUsed > 0 && s.majorCount > 0) {
    lines.push(`You paid ${s.format(s.majorUsed)} for ${s.majorCount === 1 ? 'a major expense' : `${s.majorCount} major expenses`} from your existing balance.`);
  }

  // 3 — actual overall balance
  if (s.overallBalance !== null) {
    lines.push(`Your actual overall balance is now ${s.format(s.overallBalance)}.`);
  }

  return lines;
}
