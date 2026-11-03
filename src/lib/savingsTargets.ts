import { SpendingTarget } from '@/types';

export interface TargetPeriodHistory {
  key: string;      // 'YYYY-MM' financial period
  label: string;    // "Mar '26"
  start: string;    // 'YYYY-MM-DD' period start
  amount: number;   // category spend in that period
  isComplete: boolean;
}

export interface TargetProgress {
  spent: number;
  remaining: number;         // ≥ 0
  usedPct: number;           // spent / target × 100
  status: 'on-track' | 'approaching' | 'over';
  projected: number;         // month-end projection at current pace
  achievedSavings: { periodKey: string; label: string; saved: number }[];
  totalAchieved: number;
}

/**
 * Progress on a savings target for the current period plus realised savings
 * in completed periods since the target was created. Only periods that
 * STARTED on/after `createdAt` count toward achievedSavings — the creation
 * period is excluded when it was already under way (partial data would be
 * misleading). `saved` may be negative for months over the baseline.
 *
 * `warningPct` mirrors the budget-alert warning threshold (default 80) so the
 * status language matches the alerts the mirrored categoryBudget produces.
 */
export function targetProgress(
  target: SpendingTarget,
  catSpendThisPeriod: number,
  elapsedFraction: number,
  history: TargetPeriodHistory[],
  warningPct = 80,
): TargetProgress {
  const spent = catSpendThisPeriod;
  const remaining = Math.max(0, target.target - spent);
  const usedPct = target.target > 0 ? (spent / target.target) * 100 : 0;
  const status: TargetProgress['status'] =
    usedPct >= 100 ? 'over' : usedPct >= warningPct ? 'approaching' : 'on-track';
  const projected = elapsedFraction > 0 ? spent / elapsedFraction : spent;

  const createdDay = target.createdAt.slice(0, 10); // 'YYYY-MM-DD' — ISO strings compare cleanly
  const achievedSavings = history
    .filter(h => h.isComplete && h.start >= createdDay)
    .map(h => ({ periodKey: h.key, label: h.label, saved: target.baselineMonthly - h.amount }));

  return {
    spent,
    remaining,
    usedPct,
    status,
    projected,
    achievedSavings,
    totalAchieved: achievedSavings.reduce((s, a) => s + a.saved, 0),
  };
}
