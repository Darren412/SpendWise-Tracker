import { Expense, Category, FundingSource } from '@/types';
import { getSpendClass } from '@/lib/spendClass';
import { getFinancialMonthRange, getFinancialPeriod } from '@/utils/financialCycle';

export interface ReserveTransfer {
  id: string;
  date: string;                 // 'YYYY-MM-DD'
  amount: number;               // > 0
  direction: 'in' | 'out';      // in = allocate to reserve, out = release back
  note?: string;
  createdAt: string;            // ISO timestamp — same-date ordering tiebreak
}

const round2 = (n: number) => Math.round(n * 100) / 100;

// ── Funding decomposition ───────────────────────────────────────────────────

export function fundingSource(e: Expense): FundingSource {
  return e.funding?.source ?? 'budget';
}

/** budget + reserve === amount exactly; any rounding residue lands in budget. */
export function fundingParts(e: Expense): { budget: number; reserve: number } {
  const source = fundingSource(e);
  if (source === 'reserve') return { budget: 0, reserve: e.amount };
  if (source === 'split') {
    const reserve = round2(Math.min(Math.max(0, e.funding?.reserveAmount ?? 0), e.amount));
    return { budget: round2(e.amount - reserve), reserve };
  }
  return { budget: e.amount, reserve: 0 };
}

/**
 * Expenses reduced to their budget ("regular") portions — the ONE helper all
 * budget/behaviour analysis uses for regular spending. Pure-reserve records
 * drop out entirely.
 */
export function budgetPortionExpenses(expenses: Expense[]): Expense[] {
  return expenses
    .map(e => ({ ...e, amount: fundingParts(e).budget }))
    .filter(e => e.amount > 0);
}

/** Validation message for a funding choice, or null when valid. */
export function validateFunding(input: {
  amount: number; source: FundingSource; reserveAmount?: number;
}): string | null {
  if (input.source === 'split') {
    const r = input.reserveAmount;
    if (r === undefined || !Number.isFinite(r)) return 'Enter the amount paid from reserve.';
    if (round2(r) !== r) return 'Use at most two decimals.';
    if (r <= 0) return 'The reserve portion must be greater than 0.';
    if (r >= input.amount) return 'The reserve portion must be less than the total — use "Reserve" for the full amount.';
    if (round2(input.amount - r) <= 0) return 'The budget portion must be greater than 0.';
  }
  return null;
}

// ── Reserve ledger ──────────────────────────────────────────────────────────

export interface ReserveEntry {
  date: string;
  kind: 'in' | 'out' | 'spend';   // in = transfer in, spend = reserve-funded expense, out = transfer out
  amount: number;               // positive magnitude; in adds, spend/out subtract
  refId: string;                // transfer id or expense id
  label: string;
  balanceAfter: number;
}

/** Chronological ledger; same-date order: in → spend → out; ties by createdAt/id. */
export function buildReserveLedger(
  transfers: ReserveTransfer[],
  expenses: Expense[],
): ReserveEntry[] {
  const raw: { date: string; kind: ReserveEntry['kind']; amount: number; refId: string; label: string; sortKey: string }[] = [];

  for (const t of transfers) {
    raw.push({
      date: t.date, kind: t.direction, amount: t.amount, refId: t.id,
      label: t.note?.trim() || (t.direction === 'in' ? 'Added to reserve' : 'Released from reserve'),
      sortKey: `t:${t.createdAt}:${t.id}`,
    });
  }
  for (const e of expenses) {
    const reserve = fundingParts(e).reserve;
    if (reserve > 0) {
      raw.push({
        date: e.date, kind: 'spend', amount: reserve, refId: e.id,
        label: e.description || 'Reserve expense',
        sortKey: `e:${e.id}`,
      });
    }
  }

  const KIND_ORDER: Record<ReserveEntry['kind'], number> = { in: 0, spend: 1, out: 2 };
  raw.sort((a, b) =>
    a.date !== b.date ? a.date.localeCompare(b.date)
    : KIND_ORDER[a.kind] !== KIND_ORDER[b.kind] ? KIND_ORDER[a.kind] - KIND_ORDER[b.kind]
    : a.sortKey.localeCompare(b.sortKey));

  let balance = 0;
  return raw.map(r => {
    balance += r.kind === 'in' ? r.amount : -r.amount;
    const { sortKey: _sk, ...entry } = r;
    return { ...entry, balanceAfter: balance };
  });
}

/** Reserve balance after all entries dated ≤ asOf (default: everything). */
export function reserveBalance(ledger: ReserveEntry[], asOf?: string): number {
  let b = 0;
  for (const e of ledger) {
    if (asOf !== undefined && e.date > asOf) break;
    b = e.balanceAfter;
  }
  return b;
}

/**
 * Max amount drawable on `date` without the running balance going negative at
 * that date OR at any later ledger entry = min(balance as of `date`,
 * balanceAfter of every entry dated ≥ `date`). Options exclude a transfer or
 * expense (for edit flows). Floored at 0.
 */
export function reserveAvailableOn(
  transfers: ReserveTransfer[],
  expenses: Expense[],
  date: string,
  opts?: { excludeExpenseId?: string; excludeTransferId?: string },
): number {
  const ledger = buildReserveLedger(
    transfers.filter(t => t.id !== opts?.excludeTransferId),
    expenses.filter(e => e.id !== opts?.excludeExpenseId),
  );
  let avail = reserveBalance(ledger, date);
  for (const e of ledger) {
    if (e.date >= date && e.balanceAfter < avail) avail = e.balanceAfter;
  }
  return Math.max(0, avail);
}

/** Reserve-funded portions of expenses in a date range. */
export function reserveUsage(
  expenses: Expense[],
  range: { from: string; to: string },
): { total: number; count: number; items: Expense[] } {
  const items = expenses.filter(e =>
    e.date >= range.from && e.date <= range.to && fundingParts(e).reserve > 0);
  return {
    total: round2(items.reduce((s, e) => s + fundingParts(e).reserve, 0)),
    count: items.length,
    items,
  };
}

// ── Coverage ────────────────────────────────────────────────────────────────

export function reserveCoverage(
  reserve: number,
  essentialMonthlyAvg: number | null,
): { months: number | null; status: 'ok' | 'insufficient-data' | 'no-essential-spend' } {
  if (essentialMonthlyAvg === null) return { months: null, status: 'insufficient-data' };
  if (essentialMonthlyAvg <= 0) return { months: null, status: 'no-essential-spend' };
  return { months: Math.round((reserve / essentialMonthlyAvg) * 10) / 10, status: 'ok' };
}

const ISO = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/**
 * Average monthly essential spending over the last `months` COMPLETE
 * financial periods (essential-class categories, budget portions only —
 * regular essential spending, not reserve-funded spikes). `avg` is null when
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
