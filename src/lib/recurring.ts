import { Expense, Income, RecurringRule } from '@/types';

// ── Pure Y/M/D date math on 'YYYY-MM-DD' strings ────────────────────────────
// No `new Date('YYYY-MM-DD')` parsing — that is UTC and drifts a day in
// positive offsets. Dates are manipulated as { y, m, d } integer triples and
// only compared lexicographically (safe for zero-padded ISO dates).

const MAX_OCCURRENCES_PER_CALL = 500;

function parseISO(d: string): { y: number; m: number; d: number } {
  const [y, m, dd] = d.split('-').map(Number);
  return { y, m, d: dd };
}

function toISO(y: number, m: number, d: number): string {
  return `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

// Local-time construction/reads only — never crosses the UTC boundary.
function daysInMonth(y: number, m: number): number {
  return new Date(y, m, 0).getDate();
}

function addDays(iso: string, n: number): string {
  const { y, m, d } = parseISO(iso);
  const dt = new Date(y, m - 1, d + n);
  return toISO(dt.getFullYear(), dt.getMonth() + 1, dt.getDate());
}

function minDate(a: string, b: string): string {
  return a <= b ? a : b;
}

export function maxDate(a: string, b: string): string {
  return a >= b ? a : b;
}

// k-th month-stepped occurrence: anchor day-of-month, clamped per occurrence
// to the target month's last day (Jan 31 → Feb 28/29 → Mar 31 — the clamp is
// applied from the anchor each time, never carried over cumulatively).
function monthSteppedDate(anchor: { y: number; m: number; d: number }, step: number, k: number): string {
  const total = anchor.m - 1 + k * step;
  const y = anchor.y + Math.floor(total / 12);
  const m = ((total % 12) + 12) % 12 + 1;
  const d = Math.min(anchor.d, daysInMonth(y, m));
  return toISO(y, m, d);
}

const MONTH_STEPS: Record<RecurringRule['frequency'], number> = {
  weekly: 0,
  monthly: 1,
  quarterly: 3,
  yearly: 12,
};

/**
 * All occurrence dates for `rule` in the half-open interval
 * (afterExclusive, untilInclusive], anchored on startDate. endDate also caps
 * the upper bound. Hard-capped at 500 dates per call.
 */
export function occurrenceDates(
  rule: RecurringRule,
  afterExclusive: string | undefined,
  untilInclusive: string
): string[] {
  const upper = rule.endDate ? minDate(rule.endDate, untilInclusive) : untilInclusive;
  const anchor = parseISO(rule.startDate);
  const out: string[] = [];

  if (rule.startDate > upper) return out;

  for (let k = 0; out.length < MAX_OCCURRENCES_PER_CALL; k++) {
    const date =
      rule.frequency === 'weekly'
        ? addDays(rule.startDate, 7 * k)
        : monthSteppedDate(anchor, MONTH_STEPS[rule.frequency], k);
    if (date > upper) break;
    if (!afterExclusive || date > afterExclusive) out.push(date);
  }

  return out;
}

// Deterministic id → identical occurrences dedupe across devices via id merge.
export function occurrenceId(ruleId: string, date: string): string {
  return `rec_${ruleId}_${date.replace(/-/g, '')}`;
}

export interface GeneratedDue {
  expenses: Omit<Expense, 'month' | 'year'>[];
  income: Omit<Income, 'month' | 'year'>[];
  rules: RecurringRule[]; // same length as input; unchanged rules keep identity
}

/**
 * Materialise all due occurrences up to `today` (never future-dated).
 * Interval per rule: (generatedThrough ?? dayBefore(startDate), min(today, endDate)].
 * Ids already present in `existingIds` are skipped, and each processed rule's
 * generatedThrough advances to the interval's upper bound (when ≥ startDate).
 * Paused rules pass through unchanged.
 */
export function generateDue(
  rules: RecurringRule[],
  existingIds: Set<string>,
  today: string
): GeneratedDue {
  const expenses: Omit<Expense, 'month' | 'year'>[] = [];
  const income: Omit<Income, 'month' | 'year'>[] = [];

  const nextRules = rules.map(rule => {
    if (rule.paused) return rule;

    const upper = rule.endDate ? minDate(rule.endDate, today) : today;
    const after = rule.generatedThrough ?? addDays(rule.startDate, -1);
    if (upper <= after || upper < rule.startDate) return rule;

    const dates = occurrenceDates(rule, after, upper);
    for (const date of dates) {
      const id = occurrenceId(rule.id, date);
      if (existingIds.has(id)) continue;
      if (rule.type === 'expense') {
        expenses.push({
          id,
          category: rule.category,
          description: rule.description,
          payee: undefined,
          city: rule.city,
          amount: rule.amount,
          date,
          recurringId: rule.id,
          tax: rule.tax,
        });
      } else {
        income.push({
          id,
          source: rule.description,
          category: rule.category,
          amount: rule.amount,
          date,
          recurringId: rule.id,
          tax: rule.tax,
        });
      }
    }

    return { ...rule, generatedThrough: upper };
  });

  return { expenses, income, rules: nextRules };
}

/** First scheduled occurrence strictly after `today` (schedule-based; pause state does not affect it). */
export function nextOccurrence(rule: RecurringRule, today: string): string | null {
  return occurrenceDates(rule, today, '9999-12-31')[0] ?? null;
}

/**
 * Resume a paused rule without backfilling the skipped period: generation
 * resumes from `today` onward.
 */
export function resumeRule(rule: RecurringRule, today: string): RecurringRule {
  return {
    ...rule,
    paused: false,
    generatedThrough: rule.generatedThrough ? maxDate(rule.generatedThrough, today) : today,
  };
}
