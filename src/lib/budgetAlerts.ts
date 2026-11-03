import { BudgetAlertThresholds } from '@/types';

export type AlertLevel = 'warning' | 'exceeded';

export interface BudgetAlert {
  /** `${periodKey}:${scopeId}:${level}` — stable across renders/devices. */
  key: string;
  periodKey: string;            // 'YYYY-MM'
  scope: 'overall' | 'category';
  scopeId: string;              // 'overall' | category id
  name: string;                 // display name ('Overall budget' or category name)
  level: AlertLevel;
  pct: number;                  // 1 decimal
  spent: number;
  budget: number;
}

export interface BudgetAlertInput {
  periodKey: string;
  overall: { budget: number; spent: number } | null;
  categories: { id: string; name: string; budget: number; spent: number }[];
  thresholds: BudgetAlertThresholds;
}

/** Validation message for the settings form — null when valid. */
export function validateThresholds(t: BudgetAlertThresholds): string | null {
  const { warning, exceeded } = t;
  if (!Number.isInteger(warning) || !Number.isInteger(exceeded)) {
    return 'Thresholds must be whole numbers.';
  }
  if (warning < 1) return 'Warning must be at least 1%.';
  if (exceeded > 200) return 'Exceeded must be at most 200%.';
  if (warning >= exceeded) return 'Warning must be lower than exceeded.';
  return null;
}

/**
 * One alert per budgeted scope (budget > 0) = highest threshold reached.
 * Sorted exceeded-first, then pct desc.
 */
export function evaluateBudgetAlerts(input: BudgetAlertInput): BudgetAlert[] {
  const { periodKey, overall, categories, thresholds } = input;
  const alerts: BudgetAlert[] = [];

  const check = (scope: 'overall' | 'category', scopeId: string, name: string, budget: number, spent: number) => {
    if (budget <= 0) return;
    const pct = Math.round((spent / budget) * 1000) / 10;
    const level: AlertLevel | null = pct >= thresholds.exceeded ? 'exceeded' : pct >= thresholds.warning ? 'warning' : null;
    if (!level) return;
    alerts.push({ key: `${periodKey}:${scopeId}:${level}`, periodKey, scope, scopeId, name, level, pct, spent, budget });
  };

  if (overall) check('overall', 'overall', 'Overall budget', overall.budget, overall.spent);
  for (const c of categories) check('category', c.id, c.name, c.budget, c.spent);

  return alerts.sort((a, b) =>
    (a.level === b.level ? b.pct - a.pct : a.level === 'exceeded' ? -1 : 1));
}

/**
 * Hide acknowledged alerts. Acknowledging 'exceeded' also suppresses that
 * scope's 'warning' in the same period; acknowledging 'warning' never hides
 * a later 'exceeded' (crossing the next threshold re-alerts).
 */
export function visibleAlerts(alerts: BudgetAlert[], acknowledged: string[]): BudgetAlert[] {
  const ack = new Set(acknowledged);
  const exceededAcked = (a: BudgetAlert) =>
    a.level === 'warning' && ack.has(`${a.periodKey}:${a.scopeId}:exceeded`);
  return alerts.filter(a => !ack.has(a.key) && !exceededAcked(a));
}

/** Alerts not yet shown as a toast (one-time notifications). */
export function newlyTriggered(alerts: BudgetAlert[], notified: string[]): BudgetAlert[] {
  const seen = new Set(notified);
  return alerts.filter(a => !seen.has(a.key));
}

/** Keep only keys whose `period:` prefix is in keepPeriods — bounds storage growth. */
export function pruneKeys(keys: string[], keepPeriods: string[]): string[] {
  const keep = new Set(keepPeriods);
  return keys.filter(k => keep.has(k.split(':')[0]));
}
