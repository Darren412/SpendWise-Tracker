import { Category, Expense, RecurringRule } from '@/types';
import { getFinancialMonthRange } from '@/utils/financialCycle';
import { formatCurrency } from '@/utils/currency';
import { getSpendClass, SpendClass } from './spendClass';
import { budgetPortionExpenses, fundingParts } from './reserve';

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAY_MS = 24 * 60 * 60 * 1000;

export interface SavingsInput {
  expenses: Expense[];
  categories: Category[];
  recurring: RecurringRule[];
  categoryBudgets: Record<string, number>;
  financialCycleStart: number;
  selectedMonth: string;       // 'MM' financial period label
  selectedYear: number;
  selectedCity: string;
  excludedCategoryIds: string[];
  baselineWindow: 3 | 6 | 12;
  today: string;               // 'YYYY-MM-DD'
  dismissed: string[];         // '{periodKey}:{opportunityId}'
  mutedCategoryIds: string[];
  spendingTargets: Record<string, { target: number }>;
  currency: string;
}

export type OpportunityKind = 'category' | 'subscriptions';
export type OpportunityPriority = 'High' | 'Medium' | 'Low';

export interface OpportunityScoreBreakdown {
  pct: number;
  materiality: number;
  frequency: number;
  budget: number;
  recurring: number;
  anomalyPenalty: number;
  classWeight: number;
}

export interface Opportunity {
  id: string;                  // 'cat:{id}' | 'subscriptions'
  kind: OpportunityKind;
  catId?: string;
  name: string;
  icon: string;
  color: string;
  spendClass: SpendClass | null;
  currentToDate: number;
  projectedMonthly: number;
  avgMonthly: number;
  avgToDate: number;
  avg3: number | null;
  avg6: number | null;
  avg12: number | null;
  diffAmount: number;
  pctVsAvg: number | null;
  habitualToDate?: number;         // excluding recurring + one-offs
  habitualBaselineToDate?: number;
  habitualProjected?: number;      // additive month-end projection on habitual spend
  habitualPctVsAvg?: number | null;  // tiers/score use this (1 decimal)
  txnCount: number;
  suggestedReductionPct: number;
  suggestedTarget: number;
  estMonthly: number;
  estAnnual: number;
  score: number;
  scoreBreakdown: OpportunityScoreBreakdown;
  priority: OpportunityPriority;
  reasons: string[];
  method: string;
  relatedTxnIds: string[];
  anomalyTxnIds: string[];
  smallTxnIds: string[];
  recurringTxnIds: string[];
  recurringRuleIds: string[];
  /** subscriptions kind only: monthly-equivalent line items */
  subscriptionItems?: { key: string; name: string; catId?: string; monthly: number; isEssential: boolean; fromRule: boolean }[];
  essentialRecurringTotal?: number;  // subs opp: essential monthly total (excluded from estimate)
  history: { key: string; label: string; amount: number }[];
  includedInTotal: boolean;
}

export interface SavingsSplitEntry { key: SpendClass; total: number; pct: number; }
export interface SavingsWhatIf { text: string; estMonthly: number; estAnnual: number; }

export type SavingsAnalysis =
  | {
      status: 'ok';
      periodKey: string;
      periodLabel: string;
      basisNote?: string;
      inProgress: boolean;
      elapsedDays: number;
      totalDays: number;
      windowUsed: number;
      baselineLabels: string[];
      avgTotalMonthly: number;
      opportunities: Opportunity[];
      dismissedOpportunities: Opportunity[];
      whatIf: SavingsWhatIf;
      split: SavingsSplitEntry[];
      potentialMonthly: number;
      potentialAnnual: number;
      /** reserve-funded outflows in the analysed period — informational only */
      reserveOutflows: { id: string; date: string; description: string; categoryName: string; amount: number }[];
    }
  | { status: 'insufficient'; monthsAvailable: number; monthsNeeded: 3 };

interface PeriodMeta {
  key: string;
  month: string;
  year: number;
  label: string;
  start: Date;
  end: Date;
  startISO: string;
  endISO: string;
  totalDays: number;
  isComplete: boolean;
  isCurrent: boolean;
}

function isoOf(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function round1(n: number): number { return Math.round(n * 10) / 10; }
function round10(n: number): number { return Math.round(n / 10) * 10; }
function clamp(n: number, lo: number, hi: number) { return Math.min(hi, Math.max(lo, n)); }

/** normalise a description for subscription-like matching */
function normDesc(s: string): string {
  return s.toLowerCase().trim().replace(/\d+/g, '');
}

/** consecutive financial periods ending at (month, year), newest-first param → returns oldest→newest */
function enumeratePeriods(month: string, year: number, count: number, cycleStart: number, today: string): PeriodMeta[] {
  let m = parseInt(month, 10);
  let y = year;
  const out: PeriodMeta[] = [];
  for (let i = 0; i < count; i++) {
    const mm = String(m).padStart(2, '0');
    const { start, end } = getFinancialMonthRange(mm, y, cycleStart);
    const startISO = isoOf(start);
    const endISO = isoOf(end);
    out.unshift({
      key: `${y}-${mm}`,
      month: mm,
      year: y,
      label: `${MONTH_NAMES[m - 1]} '${String(y).slice(2)}`,
      start, end, startISO, endISO,
      totalDays: Math.round((end.getTime() - start.getTime()) / DAY_MS) + 1,
      isComplete: endISO < today,
      isCurrent: startISO <= today && today <= endISO,
    });
    m -= 1;
    if (m < 1) { m = 12; y -= 1; }
  }
  return out;
}

const PRIORITY_RANK: Record<OpportunityPriority, number> = { High: 3, Medium: 2, Low: 1 };

const CLASS_WEIGHT: Record<SpendClass, number> = { discretionary: 1, flexible: 0.75, essential: 0.4 };
const CLASS_REDUCTION: Record<SpendClass, number> = { discretionary: 0.10, flexible: 0.05, essential: 0 };

function median(nums: number[]): number {
  if (nums.length === 0) return 0;
  const s = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}
function mean(nums: number[]): number {
  return nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : 0;
}
function sd(nums: number[], avg: number): number {
  if (nums.length === 0) return 0;
  return Math.sqrt(mean(nums.map(n => (n - avg) ** 2)));
}
/** every pairwise amount within ±15% */
function amountsWithin15(a: number[]): boolean {
  for (let i = 0; i < a.length; i++)
    for (let j = i + 1; j < a.length; j++)
      if (Math.abs(a[i] - a[j]) > 0.15 * Math.max(a[i], a[j])) return false;
  return true;
}

export function analyzeSavings(input: SavingsInput): SavingsAnalysis {
  const fmt = (n: number) => formatCurrency(n, input.currency);
  const money = (n: number) => fmt(Math.round(n));
  const today = input.today;

  // ── Scope expenses exactly like buildMonthlySeries ────────────────────────
  // All savings logic runs on REGULAR spend: reserve-funded portions are
  // stripped out (split txns keep only their budget part) and reported
  // separately as reserveOutflows.
  const scopedActual = input.expenses.filter(e =>
    (input.selectedCity === 'Both' || (e.city ?? 'Bangalore') === input.selectedCity) &&
    (input.excludedCategoryIds.length === 0 || !input.excludedCategoryIds.includes(e.category)));
  const scoped = budgetPortionExpenses(scopedActual);

  // ── Periods: 24 back is plenty (baseline window ≤12 + history margin) ──────
  const periods = enumeratePeriods(input.selectedMonth, input.selectedYear, 24, input.financialCycleStart, today);
  const sel = periods[periods.length - 1];

  // Per-period expense buckets (by date)
  const byPeriod: Map<string, Expense[]> = new Map();
  for (const p of periods) byPeriod.set(p.key, []);
  for (const e of scoped) {
    const d = new Date(e.date + 'T00:00:00');
    for (const p of periods) {
      if (d >= p.start && d <= p.end) { byPeriod.get(p.key)!.push(e); break; }
    }
  }
  const spend = (p: PeriodMeta, catId?: string) =>
    (byPeriod.get(p.key) ?? []).reduce((s, e) => (!catId || e.category === catId ? s + e.amount : s), 0);
  const dayOfPeriod = (p: PeriodMeta, dateISO: string) =>
    Math.floor((new Date(dateISO + 'T00:00:00').getTime() - p.start.getTime()) / DAY_MS) + 1;
  const spendWithin = (p: PeriodMeta, days: number, catId: string) =>
    (byPeriod.get(p.key) ?? []).reduce((s, e) =>
      (e.category === catId && dayOfPeriod(p, e.date) <= days ? s + e.amount : s), 0);

  // ── Analysis period ───────────────────────────────────────────────────────
  let analysed = sel;
  let basisNote: string | undefined;
  let elapsedDays = sel.isCurrent
    ? Math.floor((new Date(today + 'T00:00:00').getTime() - sel.start.getTime()) / DAY_MS) + 1
    : sel.totalDays;
  if (sel.isCurrent && elapsedDays < 7) {
    const prevComplete = [...periods].reverse().find(p => p.isComplete);
    if (prevComplete) {
      basisNote = `Based on ${prevComplete.label} (last complete month) — this month has only ${elapsedDays} days of data`;
      analysed = prevComplete;
      elapsedDays = prevComplete.totalDays;
    }
  }
  const inProgress = !analysed.isComplete;
  const elapsedFraction = inProgress ? elapsedDays / analysed.totalDays : 1;
  const periodTxns = byPeriod.get(analysed.key) ?? [];

  // ── Baseline: complete periods immediately before analysed, ≥ history start ──
  const analysedIdx = periods.findIndex(p => p.key === analysed.key);
  const historyStartIdx = periods.findIndex(p => (byPeriod.get(p.key) ?? []).length > 0);
  const baselineCandidates = periods
    .slice(0, analysedIdx)
    .filter((p, i) => p.isComplete && i >= (historyStartIdx === -1 ? periods.length : historyStartIdx));
  const baseline = baselineCandidates.slice(-input.baselineWindow);
  const windowUsed = baseline.length;
  if (windowUsed < 3) {
    return { status: 'insufficient', monthsAvailable: windowUsed, monthsNeeded: 3 };
  }
  const baselineLabels = baseline.map(p => p.label);
  const windowText = `average of your last ${windowUsed} month${windowUsed === 1 ? '' : 's'}`;

  const avgTotalMonthly = mean(baseline.map(p => spend(p)));

  // avg3/6/12 per category for display
  const avgN = (n: number, catId: string) => {
    const pts = baselineCandidates.slice(-n);
    return pts.length >= n ? mean(pts.map(p => spend(p, catId))) : null;
  };

  // ── Subscription-like detection helpers ────────────────────────────────────
  const last3Baseline = baseline.slice(-3);

  /** monthly sums per normalised description within a set of periods */
  const descSeries = (pts: PeriodMeta[]) => {
    const map = new Map<string, Map<string, number>>(); // normDesc -> periodKey -> amount
    for (const p of pts) {
      for (const e of byPeriod.get(p.key) ?? []) {
        const nd = normDesc(e.description);
        if (!map.has(nd)) map.set(nd, new Map());
        const per = map.get(nd)!;
        per.set(p.key, (per.get(p.key) ?? 0) + e.amount);
      }
    }
    return map;
  };
  const baselineSeries = descSeries(baseline);
  const last3Series = descSeries(last3Baseline);

  /** is this (rule-less) txn part of a subscription-like series? */
  const isSubscriptionLike = (e: Expense): boolean => {
    const nd = normDesc(e.description);
    const per = last3Series.get(nd);
    if (!per || per.size < 2) return false;
    const baselineAmounts = [...per.values()];
    if (!amountsWithin15(baselineAmounts)) return false;
    const avg = mean(baselineAmounts);
    return Math.abs(e.amount - avg) <= 0.15 * avg;
  };

  const isRecurringTxn = (e: Expense) => !!e.recurringId || isSubscriptionLike(e);

  // ── Median small-purchase threshold over baseline txns ─────────────────────
  const allBaselineTxns = baseline.flatMap(p => byPeriod.get(p.key) ?? []);
  const smallThreshold = Math.max(1, median(allBaselineTxns.map(e => e.amount)));

  // ── Per-category analysis ─────────────────────────────────────────────────
  const muted = new Set(input.mutedCategoryIds);
  const expenseCats = input.categories.filter(c => c.type !== 'income');

  const opportunities: Opportunity[] = [];
  const dismissedOpportunities: Opportunity[] = [];

  interface CatMetrics {
    cat: Category;
    cls: SpendClass;
    monthly: number[];                // baseline monthly spend
    recurringMonthly: number[];       // baseline recurring spend per month
    avgMonthly: number;
    avgToDate: number;
    currentToDate: number;
    txnCount: number;
    recurringSpend: number;           // recurring spend so far this period
    recurringTxns: Expense[];
    anomalySpend: number;
    anomalyTxns: Expense[];
    smallTxns: Expense[];
    pctVsAvg: number | null;          // overall vs baseline to-date (display)
    amountAboveAvg: number;           // overall (display)
    habitualToDate: number;
    habitualBaselineToDate: number;
    habitualBaselineMonthly: number;
    habitualPctVsAvg: number | null;  // tiers, score and signal (a) use this
    habitualAboveAvg: number;
    habitualProjected: number;
    recurringMonthlyExpected: number; // recurring part of the projected month-end
    projectedMonthly: number;         // display: habitual + recurring + anomalies
    budget: number;
    budgetUsedPct: number | null;
    consistentlyOverBudget: boolean;
    frequentSmall: boolean;
    smallProjectedSum: number;
  }

  const metrics: CatMetrics[] = expenseCats.map(cat => {
    const monthly = baseline.map(p => spend(p, cat.id));
    const avgMonthly = mean(monthly);
    const avgToDate = inProgress
      ? mean(baseline.map(p => spendWithin(p, Math.min(elapsedDays, p.totalDays), cat.id)))
      : avgMonthly;
    const catTxns = periodTxns.filter(e => e.category === cat.id);
    const currentToDate = catTxns.reduce((s, e) => s + e.amount, 0);
    const recurringTxns = catTxns.filter(isRecurringTxn);
    const recurringSpend = recurringTxns.reduce((s, e) => s + e.amount, 0);

    // Baseline txns of this category (with their period for to-date math)
    const baselineCatTxns = baseline.flatMap(p =>
      (byPeriod.get(p.key) ?? [])
        .filter(e => e.category === cat.id)
        .map(e => ({ e, p })));

    // Anomaly rule: ALL of > mean + 2·sd, ≥ 2× baseline median, ≥5 txns, sd > 0
    const baseAmounts = baselineCatTxns.map(t => t.e.amount);
    const mu = mean(baseAmounts);
    const sigma = sd(baseAmounts, mu);
    const med = median(baseAmounts);
    const anomalyRuleOn = baselineCatTxns.length >= 5 && sigma > 0;
    const isAnomalyAmt = (amt: number) => anomalyRuleOn && amt > mu + 2 * sigma && amt >= 2 * med;
    // A txn counts in exactly one bucket — recurring wins over anomaly
    const anomalyTxns = catTxns.filter(e => !isRecurringTxn(e) && isAnomalyAmt(e.amount));
    const anomalySpend = anomalyTxns.reduce((s, e) => s + e.amount, 0);

    const smallTxns = catTxns.filter(e => e.amount <= smallThreshold && !isRecurringTxn(e));
    const smallSum = smallTxns.reduce((s, e) => s + e.amount, 0);

    // Baseline recurring detection (same rule applied inside the baseline window)
    const isRecurringBase = (e: Expense) => !!e.recurringId || (() => {
      const nd = normDesc(e.description);
      const per = baselineSeries.get(nd);
      if (!per || per.size < 2) return false;
      const amounts = [...per.values()];
      if (!amountsWithin15(amounts)) return false;
      const avg = mean(amounts);
      return Math.abs(e.amount - avg) <= 0.15 * avg;
    })();

    const recurringMonthly = baseline.map(p =>
      baselineCatTxns.filter(t => t.p.key === p.key && isRecurringBase(t.e))
        .reduce((s, t) => s + t.e.amount, 0));
    const anomalyMonthly = baseline.map(p =>
      baselineCatTxns.filter(t => t.p.key === p.key && !isRecurringBase(t.e) && isAnomalyAmt(t.e.amount))
        .reduce((s, t) => s + t.e.amount, 0));

    const recurringBaselineAvg = mean(recurringMonthly);
    const anomalyBaselineAvg = mean(anomalyMonthly);
    const habitualBaselineMonthly = Math.max(0, avgMonthly - recurringBaselineAvg - anomalyBaselineAvg);

    // Baseline habitual spend within the first elapsedDays of each baseline month
    const nDays = (p: PeriodMeta) => Math.min(elapsedDays, p.totalDays);
    const habitualBaselineToDate = inProgress
      ? Math.max(0, mean(baseline.map(p => {
          const inWindow = baselineCatTxns.filter(t => t.p.key === p.key && dayOfPeriod(p, t.e.date) <= nDays(p));
          const tot = inWindow.reduce((s, t) => s + t.e.amount, 0);
          const rec = inWindow.filter(t => isRecurringBase(t.e)).reduce((s, t) => s + t.e.amount, 0);
          const ano = inWindow.filter(t => !isRecurringBase(t.e) && isAnomalyAmt(t.e.amount)).reduce((s, t) => s + t.e.amount, 0);
          return tot - rec - ano;
        })))
      : habitualBaselineMonthly;

    // ── Habitual decomposition of the analysed period ───────────────────────
    const habitualToDate = Math.max(0, currentToDate - recurringSpend - anomalySpend);
    const habitualAboveAvg = habitualToDate - habitualBaselineToDate;
    const habitualPctVsAvg = habitualBaselineToDate > 0
      ? (habitualAboveAvg / habitualBaselineToDate) * 100 : null;

    // Additive projection — "if the rest of the month is typical"
    const habitualProjected = !inProgress
      ? habitualToDate
      : habitualAboveAvg >= 0
        ? habitualBaselineMonthly + habitualAboveAvg
        : Math.max(habitualToDate, habitualBaselineMonthly - Math.abs(habitualAboveAvg));

    // Displayed month-end projection = habitual + expected recurring + one-offs
    const recurringMonthlyExpected = inProgress
      ? Math.max(recurringBaselineAvg, recurringSpend)
      : recurringSpend;
    const projectedMonthly = !inProgress
      ? currentToDate
      : habitualProjected + recurringMonthlyExpected + anomalySpend;

    const pctVsAvg = avgToDate > 0 ? ((currentToDate - avgToDate) / avgToDate) * 100 : null;
    const amountAboveAvg = currentToDate - avgToDate;

    const budget = input.spendingTargets[cat.id]?.target ?? input.categoryBudgets[cat.id] ?? 0;
    const budgetUsedPct = budget > 0 ? (currentToDate / budget) * 100 : null;
    const last3Complete = baselineCandidates.slice(-3);
    const consistentlyOverBudget = budget > 0 &&
      last3Complete.filter(p => spend(p, cat.id) > budget).length >= 2;

    const frequentSmall = smallTxns.length >= 8 && smallSum >= 0.05 * avgTotalMonthly;
    // small-purchase sum projected the same way habitual spend projects
    const smallFactor = habitualToDate > 0 ? habitualProjected / habitualToDate : (inProgress ? 1 / elapsedFraction : 1);
    const smallProjectedSum = smallSum * smallFactor;

    return {
      cat, cls: getSpendClass(cat), monthly, recurringMonthly, avgMonthly, avgToDate,
      currentToDate, txnCount: catTxns.length, recurringSpend, recurringTxns,
      anomalySpend, anomalyTxns, smallTxns, pctVsAvg, amountAboveAvg,
      habitualToDate, habitualBaselineToDate, habitualBaselineMonthly,
      habitualPctVsAvg, habitualAboveAvg, habitualProjected, recurringMonthlyExpected,
      projectedMonthly, budget, budgetUsedPct, consistentlyOverBudget,
      frequentSmall, smallProjectedSum,
    };
  });

  const history12 = periods.slice(-12);
  const catHistory = (catId: string) =>
    history12.map(p => ({ key: p.key, label: p.label, amount: spend(p, catId) }));

  // ── Opportunity construction ──────────────────────────────────────────────
  for (const m of metrics) {
    if (muted.has(m.cat.id)) continue;

    const isNewCategory = m.pctVsAvg === null;
    const materiality = Math.max(0.01 * avgTotalMonthly, 200);
    // Signal (a) runs on habitual spend — recurring and one-offs excluded
    const signalA = !isNewCategory && m.habitualPctVsAvg !== null
      && m.habitualPctVsAvg >= 10 && m.habitualAboveAvg >= materiality;
    const signalANew = isNewCategory && m.currentToDate >= 0.05 * avgTotalMonthly;
    const signalB = m.frequentSmall && m.cls !== 'essential';
    const signalC = m.consistentlyOverBudget || (m.budgetUsedPct !== null && m.budgetUsedPct >= 100);
    const anomalyDriven = m.anomalySpend >= 0.5 * m.amountAboveAvg && m.amountAboveAvg > 0;

    let fires = false;
    if (m.cls === 'essential') {
      fires = !isNewCategory && m.habitualPctVsAvg !== null
        && m.habitualPctVsAvg >= 30 && !anomalyDriven && signalA;
    } else {
      fires = signalA || signalB || signalC;
    }
    if (signalANew) fires = m.cls !== 'essential'; // new-category path
    if (!fires) continue;

    // ── Tier from habitual change (one-offs don't lift the tier) ────────────
    let priority: OpportunityPriority =
      m.habitualPctVsAvg === null ? 'Low'
      : m.habitualPctVsAvg > 20 ? 'High'
      : m.habitualPctVsAvg >= 10 ? 'Medium' : 'Low';
    if (m.cls === 'essential' && priority === 'High' && !(m.habitualPctVsAvg! > 50)) priority = 'Medium';

    // ── Score ──
    const sb = {
      pct: Math.min(35, Math.max(0, m.habitualPctVsAvg ?? 0) * 0.7),
      materiality: Math.min(20, (Math.max(0, m.habitualAboveAvg) / (avgTotalMonthly || 1)) * 100 * 2),
      frequency: m.frequentSmall ? 10 : 0,
      budget: m.consistentlyOverBudget ? 15 : (m.budgetUsedPct !== null && m.budgetUsedPct >= 100 ? 8 : 0),
      recurring: 0,
      anomalyPenalty: anomalyDriven ? -10 : 0,
      classWeight: CLASS_WEIGHT[m.cls],
    };
    const score = clamp(Math.round(
      (sb.pct + sb.materiality + sb.frequency + sb.budget + sb.recurring + sb.anomalyPenalty) * sb.classWeight
    ), 0, 100);

    // ── Suggested target & savings (habitual, non-recurring spend only) ──────
    let target: number;
    if (signalA) {
      target = m.habitualBaselineMonthly * (1 - CLASS_REDUCTION[m.cls]);
    } else if (signalANew) {
      // no credible baseline — suggest trimming projected habitual spend by the class %
      target = m.habitualProjected * (1 - CLASS_REDUCTION[m.cls]);
    } else if (signalB) {
      const cut = m.cls === 'discretionary' ? 0.25 : 0.15;
      target = m.habitualProjected - cut * m.smallProjectedSum;
    } else {
      target = m.budget;
    }
    target = Math.max(0, Math.min(target, m.habitualProjected));
    const estMonthly = Math.min(
      Math.max(0, round10(m.habitualProjected - target)),
      Math.max(0, Math.floor(m.habitualProjected)),
    );
    const estAnnual = estMonthly * 12;
    const suggestedReductionPct = m.habitualProjected > 0
      ? round1((estMonthly / m.habitualProjected) * 100) : 0;

    if (estMonthly < 50 && PRIORITY_RANK[priority] < PRIORITY_RANK.Medium) continue;

    // ── Reasons & method ──
    const reasons: string[] = [];
    const fmtDay = (iso: string) =>
      new Date(iso + 'T12:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
    if (isNewCategory) {
      reasons.push(`${m.cat.name} is a new spending category — ${money(m.currentToDate)} so far this month with no prior history.`);
    } else if (m.pctVsAvg !== null) {
      const dir = m.pctVsAvg >= 0 ? 'higher' : 'lower';
      reasons.push(`${m.cat.name} spending is ${money(m.currentToDate)} so far this month, ${Math.abs(round1(m.pctVsAvg))}% ${dir} than the ${windowText} for this point in the month (${money(m.avgToDate)}).`);
    }
    if (m.habitualPctVsAvg !== null && (m.anomalySpend > 0 || m.recurringSpend > 0)) {
      const parts: string[] = [];
      if (m.anomalyTxns.length > 0) {
        const a = m.anomalyTxns.reduce((x, y) => (y.amount > x.amount ? y : x));
        parts.push(`one unusual expense (${money(a.amount)} on ${fmtDay(a.date)})`);
      }
      if (m.recurringSpend > 0) parts.push('recurring payments');
      reasons.push(`Excluding ${parts.join(' and ')}, you're ${m.habitualPctVsAvg >= 0 ? '+' : ''}${round1(m.habitualPctVsAvg)}% vs usual.`);
    }
    if (inProgress) {
      reasons.push(`If the rest of the month is typical, you'll spend about ${money(m.projectedMonthly)}.`);
    }
    if (m.frequentSmall) {
      reasons.push(`You spent ${money(m.smallTxns.reduce((s, e) => s + e.amount, 0))} on ${m.smallTxns.length} small purchases (≤ ${money(smallThreshold)} each).`);
    }
    if (m.consistentlyOverBudget) reasons.push('Over budget in 2 of the last 3 months.');
    else if (m.budgetUsedPct !== null && m.budgetUsedPct >= 100) reasons.push(`Already ${round1(m.budgetUsedPct)}% of your ${money(m.budget)} budget used.`);
    if (anomalyDriven && m.anomalyTxns.length > 0) {
      const a = m.anomalyTxns.reduce((x, y) => (y.amount > x.amount ? y : x));
      reasons.push(`Mostly one unusual expense on ${a.date} (${money(a.amount)}) — may not repeat.`);
    }

    const method = `Baseline: ${windowText} (${baselineLabels.join(', ')}). ` +
      (inProgress
        ? `Same-point comparison: average of baseline spend in the first ${elapsedDays} days of each period. ` +
          `If the rest of the month is typical, projected month-end = ${money(m.projectedMonthly)} ` +
          `(habitual ${money(m.habitualProjected)} + recurring ${money(m.recurringMonthlyExpected)} + one-offs ${money(m.anomalySpend)}). ` : '') +
      `Suggested target = ${signalA ? `baseline habitual spend (${money(m.habitualBaselineMonthly)}) minus ${Math.round(CLASS_REDUCTION[m.cls] * 100)}%` :
        signalANew ? `projected habitual spend minus ${Math.round(CLASS_REDUCTION[m.cls] * 100)}%` :
        signalB ? 'projected habitual spend minus a quarter of small-purchase spend' : `your budget (${money(m.budget)})`}. ` +
      `Estimates exclude recurring payments and one-off spikes.`;

    const opp: Opportunity = {
      id: `cat:${m.cat.id}`,
      kind: 'category',
      catId: m.cat.id,
      name: m.cat.name,
      icon: m.cat.icon,
      color: m.cat.color,
      spendClass: m.cls,
      currentToDate: m.currentToDate,
      projectedMonthly: m.projectedMonthly,
      avgMonthly: m.avgMonthly,
      avgToDate: m.avgToDate,
      avg3: avgN(3, m.cat.id),
      avg6: avgN(6, m.cat.id),
      avg12: avgN(12, m.cat.id),
      diffAmount: m.amountAboveAvg,
      pctVsAvg: m.pctVsAvg === null ? null : round1(m.pctVsAvg),
      habitualToDate: m.habitualToDate,
      habitualBaselineToDate: m.habitualBaselineToDate,
      habitualProjected: m.habitualProjected,
      habitualPctVsAvg: m.habitualPctVsAvg === null ? null : round1(m.habitualPctVsAvg),
      txnCount: m.txnCount,
      suggestedReductionPct,
      suggestedTarget: target,
      estMonthly,
      estAnnual,
      score,
      scoreBreakdown: sb,
      priority,
      reasons,
      method,
      relatedTxnIds: periodTxns.filter(e => e.category === m.cat.id).map(e => e.id),
      anomalyTxnIds: m.anomalyTxns.map(e => e.id),
      smallTxnIds: m.smallTxns.map(e => e.id),
      recurringTxnIds: m.recurringTxns.map(e => e.id),
      recurringRuleIds: [...new Set(m.recurringTxns.map(e => e.recurringId).filter((x): x is string => !!x))],
      history: catHistory(m.cat.id),
      includedInTotal: true,
    };

    if (input.dismissed.includes(`${analysed.key}:${opp.id}`)) dismissedOpportunities.push(opp);
    else opportunities.push(opp);
  }

  // ── Subscriptions opportunity (one, cross-category) ────────────────────────
  const monthlyEquiv = (r: RecurringRule) =>
    r.frequency === 'weekly' ? r.amount * 52 / 12 :
    r.frequency === 'monthly' ? r.amount :
    r.frequency === 'quarterly' ? r.amount / 3 : r.amount / 12;
  const ruleEnded = (r: RecurringRule) => !!r.endDate && r.endDate < today;

  const catById = new Map(input.categories.map(c => [c.id, c]));
  const subItems: NonNullable<Opportunity['subscriptionItems']> = [];
  const activeRules = input.recurring.filter(r => r.type === 'expense' && !r.paused && !ruleEnded(r));
  for (const r of activeRules) {
    const cat = catById.get(r.category);
    subItems.push({
      key: `rule:${r.id}`,
      name: r.description || cat?.name || 'Recurring payment',
      catId: r.category,
      monthly: monthlyEquiv(r),
      isEssential: cat ? getSpendClass(cat) === 'essential' : false,
      fromRule: true,
    });
  }
  // detected subscription-like series not covered by a rule (latest monthly amount)
  const ruleLessDescs = new Set<string>();
  for (const e of periodTxns) if (!e.recurringId && isSubscriptionLike(e)) ruleLessDescs.add(normDesc(e.description));
  const ruleAmountDescs = new Set(activeRules.map(r => normDesc(r.description)));
  for (const nd of ruleLessDescs) {
    if (ruleAmountDescs.has(nd)) continue;
    const per = last3Series.get(nd);
    if (!per) continue;
    // latest monthly amount = most recent period containing the desc
    const keys = [...per.keys()].sort();
    const latest = keys[keys.length - 1];
    const sampleTxn = periodTxns.find(e => !e.recurringId && normDesc(e.description) === nd);
    const cat = sampleTxn ? catById.get(sampleTxn.category) : undefined;
    subItems.push({
      key: `desc:${nd}`,
      name: sampleTxn?.description ?? nd,
      catId: sampleTxn?.category,
      monthly: per.get(latest) ?? 0,
      isEssential: cat ? getSpendClass(cat) === 'essential' : false,
      fromRule: false,
    });
  }
  const subsEssential = subItems.filter(i => i.isEssential).reduce((s, i) => s + i.monthly, 0);
  const subsNonEssential = subItems.filter(i => !i.isEssential).reduce((s, i) => s + i.monthly, 0);
  if (subsNonEssential > 0) {
    const subPriority: OpportunityPriority = subsNonEssential >= 0.05 * avgTotalMonthly ? 'Medium' : 'Low';
    const estMonthly = Math.min(Math.max(0, round10(0.25 * subsNonEssential)), Math.floor(subsNonEssential));
    if (!(estMonthly < 50 && PRIORITY_RANK[subPriority] < PRIORITY_RANK.Medium)) {
      const biggestEssential = subItems.filter(i => i.isEssential).sort((a, b) => b.monthly - a.monthly)[0];
      const reasons = [
        `Non-essential subscriptions & recurring payments total ${money(subsNonEssential)}/month. Review them for potential savings.`,
        ...(subsEssential > 0
          ? [`${money(subsEssential)}/month of essential recurring payments${biggestEssential ? ` (e.g. ${biggestEssential.name})` : ''} are listed but not counted.`]
          : []),
        `Savings estimate assumes cancelling or downgrading about a quarter of them.`,
      ];
      // capped at 60 — subscriptions never outrank a strong behavioural signal
      const subScore = clamp(Math.round((subsNonEssential / (avgTotalMonthly || 1)) * 100 * 2) * 1.0, 0, 60);
      const subOpp: Opportunity = {
        id: 'subscriptions',
        kind: 'subscriptions',
        name: 'Subscriptions & recurring',
        icon: '🔁',
        color: 'var(--purple-500)',
        spendClass: null,
        currentToDate: subsNonEssential,
        projectedMonthly: subsNonEssential,
        avgMonthly: subsNonEssential,
        avgToDate: subsNonEssential,
        avg3: null, avg6: null, avg12: null,
        diffAmount: 0,
        pctVsAvg: null,
        txnCount: subItems.length,
        suggestedReductionPct: 25,
        suggestedTarget: subsNonEssential * 0.75,
        estMonthly,
        estAnnual: estMonthly * 12,
        score: subScore,
        scoreBreakdown: { pct: 0, materiality: Math.min(60, (subsNonEssential / (avgTotalMonthly || 1)) * 100 * 2), frequency: 0, budget: 0, recurring: 0, anomalyPenalty: 0, classWeight: 1 },
        priority: subPriority,
        reasons,
        method: `Monthly-equivalent of ${activeRules.length} active recurring rule${activeRules.length === 1 ? '' : 's'} plus detected subscription-like spending (same amount in ≥2 of the last 3 months). Essential subscriptions are listed but excluded from the estimate. Score = 2× the non-essential share of your average monthly spend, capped at 60.`,
        essentialRecurringTotal: subsEssential,
        relatedTxnIds: periodTxns.filter(e => !!e.recurringId).map(e => e.id),
        anomalyTxnIds: [],
        smallTxnIds: [],
        recurringTxnIds: periodTxns.filter(isRecurringTxn).map(e => e.id),
        recurringRuleIds: activeRules.map(r => r.id),
        subscriptionItems: subItems.sort((a, b) => b.monthly - a.monthly),
        history: history12.map(p => ({
          key: p.key, label: p.label,
          amount: (byPeriod.get(p.key) ?? []).filter(isRecurringTxn).reduce((s, e) => s + e.amount, 0),
        })),
        includedInTotal: true,
      };
      if (input.dismissed.includes(`${analysed.key}:${subOpp.id}`)) dismissedOpportunities.push(subOpp);
      else opportunities.push(subOpp);
    }
  }

  // ── Sort: priority then score ──
  const sortOpps = (a: Opportunity, b: Opportunity) =>
    PRIORITY_RANK[b.priority] - PRIORITY_RANK[a.priority] || b.score - a.score;
  opportunities.sort(sortOpps);
  dismissedOpportunities.sort(sortOpps);

  // ── What-if (discretionary −10%) — never in totals ──
  const discretionaryHabitual = metrics
    .filter(m => m.cls === 'discretionary')
    .reduce((s, m) => s + m.habitualProjected, 0);
  const whatIfMonthly = Math.max(0, round10(0.10 * discretionaryHabitual));
  const whatIf: SavingsWhatIf = {
    text: `Reducing discretionary spending by 10% could save about ${money(whatIfMonthly)}/month or ${money(whatIfMonthly * 12)}/year.`,
    estMonthly: whatIfMonthly,
    estAnnual: whatIfMonthly * 12,
  };

  // ── Spend split (projected) ──
  const splitTotals: Record<SpendClass, number> = { essential: 0, flexible: 0, discretionary: 0 };
  for (const m of metrics) splitTotals[m.cls] += m.projectedMonthly;
  const splitTotalAll = splitTotals.essential + splitTotals.flexible + splitTotals.discretionary;
  const split: SavingsSplitEntry[] = (['essential', 'flexible', 'discretionary'] as SpendClass[]).map(k => ({
    key: k,
    total: splitTotals[k],
    pct: splitTotalAll > 0 ? round1(splitTotals[k] / splitTotalAll * 100) : 0,
  }));

  const potentialMonthly = opportunities.filter(o => o.includedInTotal).reduce((s, o) => s + o.estMonthly, 0);

  // Reserve-funded outflows in the analysed period — reported, never analysed
  const catName = (id: string) => input.categories.find(c => c.id === id)?.name ?? 'Unknown';
  const reserveOutflows = scopedActual
    .filter(e => {
      const d = new Date(e.date + 'T00:00:00');
      return d >= analysed.start && d <= analysed.end && fundingParts(e).reserve > 0;
    })
    .map(e => ({ id: e.id, date: e.date, description: e.description, categoryName: catName(e.category), amount: fundingParts(e).reserve }))
    .sort((a, b) => b.amount - a.amount);

  return {
    status: 'ok',
    periodKey: analysed.key,
    periodLabel: analysed.label,
    basisNote,
    inProgress,
    elapsedDays,
    totalDays: analysed.totalDays,
    windowUsed,
    baselineLabels,
    avgTotalMonthly,
    opportunities,
    dismissedOpportunities,
    whatIf,
    split,
    potentialMonthly,
    potentialAnnual: potentialMonthly * 12,
    reserveOutflows,
  };
}
