import { SavingsGoal } from '@/types';

// Pure Y/M/D date math — no `new Date('YYYY-MM-DD')` parsing (UTC drift).
function parseISO(d: string): { y: number; m: number; dd: number } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(d);
  if (!m) return null;
  const y = +m[1], mo = +m[2], dd = +m[3];
  if (mo < 1 || mo > 12 || dd < 1 || dd > new Date(y, mo, 0).getDate()) return null;
  return { y, m: mo, dd };
}

/** Whole days from `from` to `to` ('YYYY-MM-DD'), negative when `to` is past. */
function daysBetween(from: string, to: string): number {
  const a = parseISO(from), b = parseISO(to);
  if (!a || !b) return 0;
  return Math.round((Date.UTC(b.y, b.m - 1, b.dd) - Date.UTC(a.y, a.m - 1, a.dd)) / 86400000);
}

export type GoalStatus = 'completed' | 'overdue' | 'active' | 'no-deadline';

export interface GoalProgress {
  pct: number;                    // 0–100, 1 decimal, clamped
  remaining: number;              // ≥ 0
  isComplete: boolean;            // saved ≥ target (target > 0)
  daysLeft: number | null;        // null when no targetDate
  monthsLeft: number | null;      // ceil(daysLeft / 30.44), min 1 while daysLeft > 0
  requiredPerMonth: number | null;// remaining / monthsLeft; null w/o date, when complete or overdue
  status: GoalStatus;
}

export function goalProgress(goal: Pick<SavingsGoal, 'targetAmount' | 'savedAmount' | 'targetDate'>, today: string): GoalProgress {
  const { targetAmount, savedAmount, targetDate } = goal;
  const pct = targetAmount > 0
    ? Math.max(0, Math.min(100, Math.round((savedAmount / targetAmount) * 1000) / 10))
    : 0;
  const remaining = Math.max(0, targetAmount - savedAmount);
  const isComplete = targetAmount > 0 && savedAmount >= targetAmount;

  if (isComplete) {
    const daysLeft = targetDate ? daysBetween(today, targetDate) : null;
    return { pct, remaining, isComplete, daysLeft, monthsLeft: null, requiredPerMonth: null, status: 'completed' };
  }

  if (!targetDate) {
    return { pct, remaining, isComplete, daysLeft: null, monthsLeft: null, requiredPerMonth: null, status: 'no-deadline' };
  }

  const daysLeft = daysBetween(today, targetDate);
  if (daysLeft < 0) {
    return { pct, remaining, isComplete, daysLeft, monthsLeft: null, requiredPerMonth: null, status: 'overdue' };
  }

  const monthsLeft = daysLeft > 0 ? Math.max(1, Math.ceil(daysLeft / 30.44)) : 1;
  return {
    pct, remaining, isComplete, daysLeft, monthsLeft,
    requiredPerMonth: Math.round((remaining / monthsLeft) * 100) / 100,
    status: 'active',
  };
}

export interface GoalInput {
  name: string;
  targetAmount: number;
  savedAmount: number;
  targetDate?: string;
}

export type GoalErrors = Partial<Record<'name' | 'targetAmount' | 'savedAmount' | 'targetDate', string>>;

/** Field → error message map; empty object = valid. Saving more than the target is allowed. */
export function validateGoal(input: GoalInput, today: string, opts: { isNew: boolean }): GoalErrors {
  const errors: GoalErrors = {};
  const name = input.name.trim();
  if (!name) errors.name = 'Name is required.';
  else if (name.length > 60) errors.name = 'Keep the name to 60 characters or less.';

  if (!Number.isFinite(input.targetAmount) || input.targetAmount <= 0) {
    errors.targetAmount = 'Target amount must be greater than 0.';
  }
  if (!Number.isFinite(input.savedAmount) || input.savedAmount < 0) {
    errors.savedAmount = 'Saved amount must be 0 or more.';
  }
  if (input.targetDate) {
    if (!parseISO(input.targetDate)) {
      errors.targetDate = 'Enter a valid date (YYYY-MM-DD).';
    } else if (opts.isNew && input.targetDate < today) {
      errors.targetDate = 'Target date must be today or later.';
    }
  }
  return errors;
}

/** Active (soonest deadline first, no-date by createdAt), then completed, then archived. */
export function sortGoals(goals: SavingsGoal[]): SavingsGoal[] {
  const rank = (g: SavingsGoal): number => {
    if (g.archived) return 2;
    const complete = g.targetAmount > 0 && g.savedAmount >= g.targetAmount;
    return complete ? 1 : 0;
  };
  return [...goals].sort((a, b) => {
    const r = rank(a) - rank(b);
    if (r !== 0) return r;
    if (rank(a) === 0) {
      // Active: dated goals first, soonest deadline; undated by createdAt
      if (a.targetDate && b.targetDate) return a.targetDate.localeCompare(b.targetDate);
      if (a.targetDate) return -1;
      if (b.targetDate) return 1;
    }
    return a.createdAt.localeCompare(b.createdAt);
  });
}
