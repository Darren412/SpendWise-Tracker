/**
 * AI Insights Engine — SpendWise
 *
 * Pure computation layer — no side effects, no store mutations.
 * Every function is a deterministic transform of real transaction data.
 * Designed to be called inside useMemo() in the workspace.
 */

import { Expense, Income, Category } from '@/types';
import { getFinancialMonthRange } from './financialCycle';
import { currencySymbol } from './currency';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type InsightSeverity = 'critical' | 'warning' | 'positive' | 'info' | 'neutral';

export interface AIInsightCard {
  id: string;
  severity: InsightSeverity;
  category: 'spending' | 'savings' | 'trend' | 'anomaly' | 'behavior' | 'prediction' | 'recommendation';
  title: string;
  summary: string;               // 1-sentence headline
  detail: string;                // expanded explanation
  metric?: string;               // highlighted number, e.g. "₹3,200 over budget"
  metricDirection?: 'up' | 'down' | 'neutral';
  confidence: number;            // 0–100
  actionLabel?: string;
  actionHint?: string;
}

export interface HealthScore {
  total: number;                 // 0–100
  breakdown: {
    savings: number;             // 0–25
    discipline: number;          // 0–25
    volatility: number;          // 0–25
    consistency: number;         // 0–25
  };
  grade: 'A+' | 'A' | 'B+' | 'B' | 'C+' | 'C' | 'D' | 'F';
  label: string;                 // "Excellent", "Good", ...
  color: string;
  explanation: string[];         // bullet list of score drivers
}

export interface MonthSummary {
  month: string;                 // "03"
  year: number;
  label: string;                 // "Mar '25"
  expenses: number;
  income: number;
  savings: number;
  savingsRate: number;           // 0–100 or negative
  txnCount: number;
}

export interface CategoryTrend {
  catId: string;
  name: string;
  icon: string;
  color: string;
  currSpent: number;
  prevSpent: number;
  changePct: number;             // positive = increase
  pctOfTotal: number;            // % of total this period
}

export interface RecurringItem {
  desc: string;
  count: number;
  avgAmount: number;
  lastAmount: number;
  lastDate: string;
  monthlyImpact: number;        // estimated monthly cost
}

export interface SpendingAnomaly {
  expense: Expense;
  categoryName: string;
  categoryIcon: string;
  zscore: number;               // how many std devs from mean
  meanForCategory: number;
  label: string;                // "3.1× above average for Dining"
}

export interface PredictionData {
  projectedMonthEnd: number;
  projectedSavings: number;
  daysRemaining: number;
  dailyBurnRate: number;
  previousAvgMonthly: number;
  riskLevel: 'low' | 'medium' | 'high';
  riskReason: string;
}

export interface BehaviorProfile {
  weekdayVsWeekend: { weekday: number; weekend: number; weekdayPct: number };
  topSpendHour: string;          // "evenings", "mornings", etc. (derived from date only)
  impulseBuyRatio: number;       // % of txns under a threshold classified as impulse
  avgTransactionSize: number;
  bigTicketItems: Expense[];     // top 3 by amount in period
  categoryDependency: string;    // "Heavy reliance on Dining & Food"
}

export interface CityComparison {
  cities: string[];
  perCity: Record<string, { total: number; txnCount: number; topCat: string }>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function prevMonthKey(month: string, year: number): { month: string; year: number } {
  let m = parseInt(month, 10) - 1;
  let y = year;
  if (m < 1) { m = 12; y -= 1; }
  return { month: m.toString().padStart(2, '0'), year: y };
}

function monthLabel(month: string, year: number): string {
  return new Date(year, parseInt(month, 10) - 1, 1)
    .toLocaleDateString('en-IN', { month: 'short', year: '2-digit' });
}

function stdDev(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / values.length;
  return Math.sqrt(variance);
}

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. Monthly history (last N periods)
// ─────────────────────────────────────────────────────────────────────────────

export function buildMonthHistory(
  expenses: Expense[],
  income: Income[],
  selectedMonth: string,
  selectedYear: number,
  financialCycleStart: number,
  periodsBack: number = 6,
): MonthSummary[] {
  return Array.from({ length: periodsBack }, (_, i) => {
    let m = parseInt(selectedMonth, 10) - i;
    let y = selectedYear;
    while (m < 1) { m += 12; y -= 1; }
    const mStr = m.toString().padStart(2, '0');
    const { start, end } = getFinancialMonthRange(mStr, y, financialCycleStart);

    const periodExpenses = expenses.filter(e => {
      const d = new Date(e.date);
      return d >= start && d <= end;
    });
    const periodIncome = income.filter(inc => {
      const d = new Date(inc.date);
      return d >= start && d <= end;
    });

    const exp = periodExpenses.reduce((s, e) => s + e.amount, 0);
    const inc = periodIncome.reduce((s, i) => s + i.amount, 0);
    const sav = inc - exp;
    const savRate = inc > 0 ? Math.round((sav / inc) * 100) : 0;

    return {
      month: mStr,
      year: y,
      label: monthLabel(mStr, y),
      expenses: exp,
      income: inc,
      savings: sav,
      savingsRate: savRate,
      txnCount: periodExpenses.length,
    };
  }).reverse();
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. Category trends (current vs previous period)
// ─────────────────────────────────────────────────────────────────────────────

export function buildCategoryTrends(
  expenses: Expense[],
  categories: Category[],
  selectedMonth: string,
  selectedYear: number,
  selectedCity: string,
  financialCycleStart: number,
  excludedCategoryIds: string[],
): CategoryTrend[] {
  const { start, end } = getFinancialMonthRange(selectedMonth, selectedYear, financialCycleStart);
  const prev = prevMonthKey(selectedMonth, selectedYear);
  const { start: pStart, end: pEnd } = getFinancialMonthRange(prev.month, prev.year, financialCycleStart);

  const expCats = categories.filter(c =>
    c.type !== 'income' &&
    (excludedCategoryIds.length === 0 || !excludedCategoryIds.includes(c.id))
  );

  const currTotal = expenses
    .filter(e => {
      const d = new Date(e.date);
      return d >= start && d <= end &&
        (selectedCity === 'Both' || !e.city || e.city === selectedCity);
    })
    .reduce((s, e) => s + e.amount, 0);

  return expCats.map(c => {
    const currSpent = expenses
      .filter(e => {
        const d = new Date(e.date);
        return d >= start && d <= end &&
          e.category === c.id &&
          (selectedCity === 'Both' || !e.city || e.city === selectedCity);
      })
      .reduce((s, e) => s + e.amount, 0);

    const prevSpent = expenses
      .filter(e => {
        const d = new Date(e.date);
        return d >= pStart && d <= pEnd &&
          e.category === c.id &&
          (selectedCity === 'Both' || !e.city || e.city === selectedCity);
      })
      .reduce((s, e) => s + e.amount, 0);

    const changePct = prevSpent > 0
      ? Math.round(((currSpent - prevSpent) / prevSpent) * 100)
      : currSpent > 0 ? 100 : 0;

    const pctOfTotal = currTotal > 0 ? Math.round((currSpent / currTotal) * 100) : 0;

    return {
      catId: c.id,
      name: c.name,
      icon: c.icon,
      color: c.color,
      currSpent,
      prevSpent,
      changePct,
      pctOfTotal,
    };
  })
  .filter(t => t.currSpent > 0 || t.prevSpent > 0)
  .sort((a, b) => b.currSpent - a.currSpent);
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. Recurring payment detection
// ─────────────────────────────────────────────────────────────────────────────

export function detectRecurring(expenses: Expense[], limit = 6): RecurringItem[] {
  const grouped: Record<string, Expense[]> = {};
  expenses.forEach(e => {
    const key = e.description.toLowerCase().trim();
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(e);
  });

  return Object.entries(grouped)
    .filter(([, list]) => list.length >= 2)
    .map(([desc, list]) => {
      const sorted = [...list].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      const amounts = list.map(e => e.amount);
      const avgAmt  = mean(amounts);
      return {
        desc,
        count: list.length,
        avgAmount: avgAmt,
        lastAmount: sorted[0].amount,
        lastDate: sorted[0].date,
        monthlyImpact: avgAmt,
      };
    })
    .sort((a, b) => b.avgAmount - a.avgAmount)
    .slice(0, limit);
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. Anomaly detection (z-score per category)
// ─────────────────────────────────────────────────────────────────────────────

export function detectAnomalies(
  currentPeriodExpenses: Expense[],
  allExpenses: Expense[],
  categories: Category[],
  limit = 3,
): SpendingAnomaly[] {
  const anomalies: SpendingAnomaly[] = [];

  const catIds = [...new Set(currentPeriodExpenses.map(e => e.category))];

  for (const catId of catIds) {
    const allForCat  = allExpenses.filter(e => e.category === catId).map(e => e.amount);
    if (allForCat.length < 3) continue;

    const mu    = mean(allForCat);
    const sigma = stdDev(allForCat);
    if (sigma === 0) continue;

    const currentForCat = currentPeriodExpenses.filter(e => e.category === catId);
    for (const exp of currentForCat) {
      const z = (exp.amount - mu) / sigma;
      if (z >= 2.0) {
        const cat = categories.find(c => c.id === catId);
        anomalies.push({
          expense: exp,
          categoryName: cat?.name ?? 'Unknown',
          categoryIcon: cat?.icon ?? '📦',
          zscore: z,
          meanForCategory: mu,
          label: `${(exp.amount / mu).toFixed(1)}× above average for ${cat?.name ?? 'this category'}`,
        });
      }
    }
  }

  return anomalies
    .sort((a, b) => b.zscore - a.zscore)
    .slice(0, limit);
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. Prediction engine
// ─────────────────────────────────────────────────────────────────────────────

export function buildPrediction(
  currentPeriodExpenses: Expense[],
  monthHistory: MonthSummary[],
  periodStart: Date,
  periodEnd: Date,
  totalIncome: number,
): PredictionData {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const totalDays    = Math.round((periodEnd.getTime() - periodStart.getTime()) / 86400000) + 1;
  const elapsedDays  = Math.max(1, Math.round((today.getTime() - periodStart.getTime()) / 86400000) + 1);
  const daysRemaining = Math.max(0, totalDays - elapsedDays);

  const spentSoFar = currentPeriodExpenses.reduce((s, e) => s + e.amount, 0);
  const dailyBurnRate = spentSoFar / elapsedDays;
  const projectedMonthEnd = spentSoFar + dailyBurnRate * daysRemaining;

  const historicAvgs = monthHistory.filter(m => m.expenses > 0).map(m => m.expenses);
  const previousAvgMonthly = historicAvgs.length > 0 ? mean(historicAvgs) : 0;

  const projectedSavings = totalIncome > 0 ? totalIncome - projectedMonthEnd : 0;

  let riskLevel: 'low' | 'medium' | 'high' = 'low';
  let riskReason = 'Spending is on track';

  if (totalIncome > 0 && projectedMonthEnd > totalIncome) {
    riskLevel = 'high';
    riskReason = 'Projected to exceed income this period';
  } else if (previousAvgMonthly > 0 && projectedMonthEnd > previousAvgMonthly * 1.2) {
    riskLevel = 'medium';
    riskReason = '20%+ above your historical average';
  } else if (totalIncome > 0 && projectedMonthEnd > totalIncome * 0.85) {
    riskLevel = 'medium';
    riskReason = 'Approaching budget limit';
  }

  return {
    projectedMonthEnd,
    projectedSavings,
    daysRemaining,
    dailyBurnRate,
    previousAvgMonthly,
    riskLevel,
    riskReason,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 6. Financial health score
// ─────────────────────────────────────────────────────────────────────────────

export function computeHealthScore(
  totalExpenses: number,
  totalIncome: number,
  monthHistory: MonthSummary[],
  catBreakdown: CategoryTrend[],
  recurringItems: RecurringItem[],
): HealthScore {
  const explanation: string[] = [];

  // ── Savings score (0-25) ──────────────────────────────────────────────────
  const savingsRate = totalIncome > 0 ? (totalIncome - totalExpenses) / totalIncome : 0;
  let savingsScore = 0;
  if (savingsRate >= 0.30)      { savingsScore = 25; explanation.push('Excellent savings rate (30%+)'); }
  else if (savingsRate >= 0.20) { savingsScore = 20; explanation.push('Good savings rate (20–30%)'); }
  else if (savingsRate >= 0.10) { savingsScore = 13; explanation.push('Moderate savings rate (10–20%)'); }
  else if (savingsRate >= 0)    { savingsScore = 6;  explanation.push('Low savings rate (0–10%)'); }
  else                          { savingsScore = 0;  explanation.push('Overspending — spending exceeds income'); }

  // ── Spending discipline (0-25) — category concentration ──────────────────
  let disciplineScore = 25;
  if (catBreakdown.length > 0 && totalExpenses > 0) {
    const topCatPct = catBreakdown[0].currSpent / totalExpenses;
    if (topCatPct > 0.60)      { disciplineScore = 5;  explanation.push(`Heavy concentration: ${catBreakdown[0].name} = ${Math.round(topCatPct*100)}% of spend`); }
    else if (topCatPct > 0.45) { disciplineScore = 12; explanation.push(`High concentration in ${catBreakdown[0].name} (${Math.round(topCatPct*100)}%)`); }
    else if (topCatPct > 0.30) { disciplineScore = 18; explanation.push(`Moderate spread across categories`); }
    else                       { disciplineScore = 25; explanation.push(`Well-diversified spending across categories`); }
  }

  // ── Expense volatility (0-25) — month-over-month stability ───────────────
  const expHistory = monthHistory.filter(m => m.expenses > 0).map(m => m.expenses);
  let volatilityScore = 25;
  if (expHistory.length >= 3) {
    const cv = stdDev(expHistory) / mean(expHistory); // coefficient of variation
    if (cv > 0.4)      { volatilityScore = 5;  explanation.push('High spending volatility month-to-month'); }
    else if (cv > 0.2) { volatilityScore = 15; explanation.push('Moderate month-to-month fluctuation'); }
    else               { volatilityScore = 25; explanation.push('Stable, consistent spending pattern'); }
  } else {
    volatilityScore = 15;
    explanation.push('Not enough history to assess volatility');
  }

  // ── Recurring burden (0-25) — recurring as % of income ───────────────────
  const recurringTotal = recurringItems.reduce((s, r) => s + r.monthlyImpact, 0);
  const recurringBurden = totalIncome > 0 ? recurringTotal / totalIncome : 0;
  let consistencyScore = 25;
  if (recurringBurden > 0.60)      { consistencyScore = 5;  explanation.push(`High recurring burden (${Math.round(recurringBurden*100)}% of income)`); }
  else if (recurringBurden > 0.40) { consistencyScore = 13; explanation.push(`Moderate recurring commitments (${Math.round(recurringBurden*100)}% of income)`); }
  else if (recurringBurden > 0)    { consistencyScore = 22; explanation.push(`Manageable recurring expenses`); }
  else                             { consistencyScore = 25; explanation.push(`No significant recurring burden detected`); }

  const total = Math.round(savingsScore + disciplineScore + volatilityScore + consistencyScore);

  let grade: HealthScore['grade'] = 'F';
  let label = 'Critical';
  let color = '#ef4444';
  if (total >= 92)      { grade = 'A+'; label = 'Exceptional';  color = '#059669'; }
  else if (total >= 80) { grade = 'A';  label = 'Excellent';    color = '#16a34a'; }
  else if (total >= 70) { grade = 'B+'; label = 'Very Good';    color = '#22c55e'; }
  else if (total >= 60) { grade = 'B';  label = 'Good';         color = '#84cc16'; }
  else if (total >= 50) { grade = 'C+'; label = 'Fair';         color = '#eab308'; }
  else if (total >= 40) { grade = 'C';  label = 'Needs Work';   color = '#f59e0b'; }
  else if (total >= 25) { grade = 'D';  label = 'Poor';         color = '#f97316'; }
  else                  { grade = 'F';  label = 'Critical';     color = '#ef4444'; }

  return {
    total,
    breakdown: {
      savings:     savingsScore,
      discipline:  disciplineScore,
      volatility:  volatilityScore,
      consistency: consistencyScore,
    },
    grade, label, color, explanation,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 7. Behavioral analysis
// ─────────────────────────────────────────────────────────────────────────────

export function buildBehaviorProfile(
  periodExpenses: Expense[],
  categories: Category[],
): BehaviorProfile {
  let weekday = 0, weekend = 0;
  periodExpenses.forEach(e => {
    const day = new Date(e.date + 'T12:00:00').getDay(); // 0=Sun, 6=Sat
    if (day === 0 || day === 6) weekend += e.amount;
    else weekday += e.amount;
  });
  const totalForWW = weekday + weekend;
  const weekdayPct = totalForWW > 0 ? Math.round((weekday / totalForWW) * 100) : 0;

  // Impulse: transactions under a heuristic threshold (< avg/2) — many small txns
  const amounts = periodExpenses.map(e => e.amount);
  const avgAmt = mean(amounts);
  const impulseTxns = amounts.filter(a => a < avgAmt * 0.4).length;
  const impulseBuyRatio = periodExpenses.length > 0 ? Math.round((impulseTxns / periodExpenses.length) * 100) : 0;

  // Big ticket = top 3 by amount
  const bigTicketItems = [...periodExpenses].sort((a, b) => b.amount - a.amount).slice(0, 3);

  // Category dependency
  const catTotals: Record<string, number> = {};
  periodExpenses.forEach(e => {
    catTotals[e.category] = (catTotals[e.category] ?? 0) + e.amount;
  });
  const topCatId = Object.entries(catTotals).sort((a, b) => b[1] - a[1])[0]?.[0] ?? '';
  const topCat = categories.find(c => c.id === topCatId);
  const topPct = totalForWW > 0 && topCat ? Math.round((catTotals[topCatId] / (weekday + weekend)) * 100) : 0;
  const categoryDependency = topCat && topPct > 30
    ? `${topPct}% of spending goes to ${topCat.name}`
    : 'Spending spread across multiple categories';

  return {
    weekdayVsWeekend: { weekday, weekend, weekdayPct },
    topSpendHour: 'N/A',
    impulseBuyRatio,
    avgTransactionSize: Math.round(avgAmt),
    bigTicketItems,
    categoryDependency,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 8. City comparison
// ─────────────────────────────────────────────────────────────────────────────

export function buildCityComparison(
  periodExpenses: Expense[],
  categories: Category[],
): CityComparison {
  const cities = [...new Set(periodExpenses.map(e => e.city ?? 'Unknown'))];
  const perCity: CityComparison['perCity'] = {};

  for (const city of cities) {
    const cityExp = periodExpenses.filter(e => (e.city ?? 'Unknown') === city);
    const total   = cityExp.reduce((s, e) => s + e.amount, 0);

    const catTotals: Record<string, number> = {};
    cityExp.forEach(e => { catTotals[e.category] = (catTotals[e.category] ?? 0) + e.amount; });
    const topCatId = Object.entries(catTotals).sort((a, b) => b[1] - a[1])[0]?.[0] ?? '';
    const topCat = categories.find(c => c.id === topCatId);

    perCity[city] = { total, txnCount: cityExp.length, topCat: topCat ? `${topCat.icon} ${topCat.name}` : '—' };
  }

  return { cities, perCity };
}

// ─────────────────────────────────────────────────────────────────────────────
// 9. AI narrative summary
// ─────────────────────────────────────────────────────────────────────────────

export function buildNarrativeSummary(
  totalExpenses: number,
  totalIncome: number,
  catTrends: CategoryTrend[],
  prediction: PredictionData,
  healthScore: HealthScore,
  sym: string,
): string[] {
  const lines: string[] = [];

  if (totalIncome > 0 && totalExpenses > 0) {
    const savePct = Math.round(((totalIncome - totalExpenses) / totalIncome) * 100);
    if (savePct > 0) {
      lines.push(`You've spent ${sym}${Math.round(totalExpenses).toLocaleString('en-IN')} this period, saving ${savePct}% of your income — ${savePct >= 20 ? 'above' : 'below'} the recommended 20% mark.`);
    } else {
      lines.push(`You've spent ${sym}${Math.round(totalExpenses).toLocaleString('en-IN')} this period, which is ${sym}${Math.round(totalExpenses - totalIncome).toLocaleString('en-IN')} more than your income — review your largest categories.`);
    }
  } else if (totalExpenses > 0) {
    lines.push(`You've recorded ${sym}${Math.round(totalExpenses).toLocaleString('en-IN')} in expenses this period. Add your income to unlock savings analysis.`);
  } else {
    lines.push('No expenses recorded yet this period. Start adding transactions to see your financial picture.');
    return lines;
  }

  const riser = catTrends.find(t => t.changePct >= 15 && t.prevSpent > 0);
  const faller = catTrends.find(t => t.changePct <= -15 && t.prevSpent > 0);
  if (riser) lines.push(`${riser.icon} ${riser.name} spending is up ${riser.changePct}% vs last period (${sym}${Math.round(riser.currSpent).toLocaleString('en-IN')} vs ${sym}${Math.round(riser.prevSpent).toLocaleString('en-IN')}).`);
  if (faller) lines.push(`${faller.icon} ${faller.name} dropped ${Math.abs(faller.changePct)}% — freeing up ${sym}${Math.round(faller.prevSpent - faller.currSpent).toLocaleString('en-IN')} compared to last period.`);

  if (prediction.daysRemaining > 0) {
    lines.push(`At your current daily burn rate of ${sym}${Math.round(prediction.dailyBurnRate).toLocaleString('en-IN')}/day, you're projected to spend ${sym}${Math.round(prediction.projectedMonthEnd).toLocaleString('en-IN')} by period end.`);
  }

  lines.push(`Financial health score: ${healthScore.total}/100 — ${healthScore.label}.`);

  return lines;
}

// ─────────────────────────────────────────────────────────────────────────────
// 10. Smart insight cards
// ─────────────────────────────────────────────────────────────────────────────

export function generateInsightCards(
  totalExpenses: number,
  totalIncome: number,
  savingsRate: number,
  catTrends: CategoryTrend[],
  monthHistory: MonthSummary[],
  anomalies: SpendingAnomaly[],
  prediction: PredictionData,
  recurringItems: RecurringItem[],
  sym: string,
): AIInsightCard[] {
  const cards: AIInsightCard[] = [];

  // ── Overspending / savings ────────────────────────────────────────────────
  if (totalIncome > 0 && totalExpenses > totalIncome) {
    const over = Math.round(totalExpenses - totalIncome);
    cards.push({
      id: 'overspend',
      severity: 'critical',
      category: 'spending',
      title: 'Over Budget This Period',
      summary: `Spending exceeds income by ${sym}${over.toLocaleString('en-IN')}`,
      detail: `Your total expenses (${sym}${Math.round(totalExpenses).toLocaleString('en-IN')}) have crossed your income (${sym}${Math.round(totalIncome).toLocaleString('en-IN')}). Reduce discretionary spending in your top categories to get back in the green.`,
      metric: `−${sym}${over.toLocaleString('en-IN')}`,
      metricDirection: 'down',
      confidence: 100,
      actionLabel: 'Review Top Categories',
    });
  } else if (totalIncome > 0 && savingsRate >= 20) {
    cards.push({
      id: 'savings_good',
      severity: 'positive',
      category: 'savings',
      title: 'Strong Savings Rate',
      summary: `You're saving ${savingsRate}% — above the 20% benchmark`,
      detail: `Saving ${savingsRate}% of income puts you in a strong financial position. The 50/30/20 rule recommends at least 20% for savings. Keep this momentum to build your emergency fund and investments.`,
      metric: `${savingsRate}% saved`,
      metricDirection: 'up',
      confidence: 100,
    });
  } else if (totalIncome > 0) {
    cards.push({
      id: 'savings_low',
      severity: 'warning',
      category: 'savings',
      title: 'Savings Below Target',
      summary: `Only saving ${savingsRate}% vs recommended 20%`,
      detail: `You're currently saving ${savingsRate}% of income. The recommended minimum is 20% (${sym}${Math.round(totalIncome * 0.2).toLocaleString('en-IN')} for your income level). Reducing ${catTrends[0] ? catTrends[0].name : 'top spending'} could close the gap.`,
      metric: `${sym}${Math.round(totalIncome * 0.2 - Math.max(0, totalIncome - totalExpenses)).toLocaleString('en-IN')} shortfall`,
      metricDirection: 'down',
      confidence: 95,
      actionLabel: 'Find Savings',
    });
  }

  // ── Category spike ────────────────────────────────────────────────────────
  const bigRiser = catTrends.find(t => t.changePct >= 20 && t.prevSpent > 0 && t.currSpent > 500);
  if (bigRiser) {
    cards.push({
      id: `cat_spike_${bigRiser.catId}`,
      severity: bigRiser.changePct >= 40 ? 'warning' : 'info',
      category: 'trend',
      title: `${bigRiser.icon} ${bigRiser.name} Spiked`,
      summary: `Up ${bigRiser.changePct}% vs last period`,
      detail: `${bigRiser.name} jumped from ${sym}${Math.round(bigRiser.prevSpent).toLocaleString('en-IN')} to ${sym}${Math.round(bigRiser.currSpent).toLocaleString('en-IN')} — an increase of ${bigRiser.changePct}%. This could be a one-time event or a trend to watch.`,
      metric: `+${bigRiser.changePct}%`,
      metricDirection: 'up',
      confidence: 85,
      actionLabel: 'Inspect Transactions',
    });
  }

  // ── Category drop (positive news) ────────────────────────────────────────
  const bigFaller = catTrends.find(t => t.changePct <= -20 && t.prevSpent > 0);
  if (bigFaller) {
    cards.push({
      id: `cat_drop_${bigFaller.catId}`,
      severity: 'positive',
      category: 'trend',
      title: `${bigFaller.icon} ${bigFaller.name} Reduced`,
      summary: `Down ${Math.abs(bigFaller.changePct)}% vs last period`,
      detail: `Nice work — ${bigFaller.name} fell from ${sym}${Math.round(bigFaller.prevSpent).toLocaleString('en-IN')} to ${sym}${Math.round(bigFaller.currSpent).toLocaleString('en-IN')}, saving you ${sym}${Math.round(bigFaller.prevSpent - bigFaller.currSpent).toLocaleString('en-IN')}.`,
      metric: `−${Math.abs(bigFaller.changePct)}%`,
      metricDirection: 'down',
      confidence: 90,
    });
  }

  // ── Spending trend (multi-month) ──────────────────────────────────────────
  const activePeriods = monthHistory.filter(m => m.expenses > 0);
  if (activePeriods.length >= 3) {
    const prior    = activePeriods.slice(0, -1);
    const priorAvg = mean(prior.map(m => m.expenses));
    const latest   = activePeriods[activePeriods.length - 1].expenses;
    const diff     = Math.round(((latest - priorAvg) / priorAvg) * 100);
    if (Math.abs(diff) >= 10) {
      cards.push({
        id: 'monthly_trend',
        severity: diff > 0 ? 'warning' : 'positive',
        category: 'trend',
        title: diff > 0 ? 'Spending Trend: Up' : 'Spending Trend: Down',
        summary: `${diff > 0 ? '+' : ''}${diff}% vs your ${prior.length}-period average`,
        detail: `Your current period spending (${sym}${Math.round(latest).toLocaleString('en-IN')}) is ${Math.abs(diff)}% ${diff > 0 ? 'above' : 'below'} your ${prior.length}-period average of ${sym}${Math.round(priorAvg).toLocaleString('en-IN')}. ${diff > 0 ? 'Monitor discretionary categories.' : 'Great cost discipline.'}`,
        metric: `${diff > 0 ? '+' : ''}${diff}%`,
        metricDirection: diff > 0 ? 'up' : 'down',
        confidence: 88,
      });
    }
  }

  // ── Anomalies ─────────────────────────────────────────────────────────────
  if (anomalies.length > 0) {
    const a = anomalies[0];
    cards.push({
      id: `anomaly_${a.expense.id}`,
      severity: 'warning',
      category: 'anomaly',
      title: `Unusual Spend: ${a.expense.description}`,
      summary: a.label,
      detail: `"${a.expense.description}" (${sym}${a.expense.amount.toLocaleString('en-IN')}) is ${a.label}. The typical transaction in ${a.categoryName} is around ${sym}${Math.round(a.meanForCategory).toLocaleString('en-IN')}. Check if this was intentional.`,
      metric: `${sym}${a.expense.amount.toLocaleString('en-IN')}`,
      metricDirection: 'up',
      confidence: Math.min(99, Math.round(60 + a.zscore * 8)),
      actionLabel: 'Review Transaction',
    });
  }

  // ── Projection risk ───────────────────────────────────────────────────────
  if (prediction.riskLevel !== 'low' && prediction.daysRemaining > 0) {
    cards.push({
      id: 'projection_risk',
      severity: prediction.riskLevel === 'high' ? 'critical' : 'warning',
      category: 'prediction',
      title: prediction.riskLevel === 'high' ? 'Budget Risk: High' : 'Budget Risk: Medium',
      summary: prediction.riskReason,
      detail: `At ${sym}${Math.round(prediction.dailyBurnRate).toLocaleString('en-IN')}/day, you'll spend ${sym}${Math.round(prediction.projectedMonthEnd).toLocaleString('en-IN')} by period end. ${prediction.riskReason}. ${prediction.daysRemaining} days remain — you have time to course-correct.`,
      metric: `${sym}${Math.round(prediction.projectedMonthEnd).toLocaleString('en-IN')} projected`,
      metricDirection: 'up',
      confidence: Math.min(95, 70 + Math.round((1 - prediction.daysRemaining / 30) * 25)),
      actionLabel: 'See Projection',
    });
  }

  // ── Recurring burden ──────────────────────────────────────────────────────
  if (recurringItems.length >= 3 && totalIncome > 0) {
    const recurringTotal = recurringItems.reduce((s, r) => s + r.monthlyImpact, 0);
    const recurBurden = Math.round((recurringTotal / totalIncome) * 100);
    if (recurBurden >= 30) {
      cards.push({
        id: 'recurring_burden',
        severity: recurBurden >= 50 ? 'warning' : 'info',
        category: 'behavior',
        title: 'High Recurring Commitment',
        summary: `Recurring payments = ${recurBurden}% of income`,
        detail: `You have ${recurringItems.length} recurring expense patterns totalling ~${sym}${Math.round(recurringTotal).toLocaleString('en-IN')}. This locks up ${recurBurden}% of your income. Review whether all subscriptions/fixed costs are necessary.`,
        metric: `${recurBurden}% of income`,
        metricDirection: recurBurden >= 50 ? 'up' : 'neutral',
        confidence: 80,
        actionLabel: 'Review Recurring',
      });
    }
  }

  // ── High concentration ────────────────────────────────────────────────────
  if (catTrends.length > 0 && totalExpenses > 0) {
    const top = catTrends[0];
    if (top.pctOfTotal >= 45) {
      cards.push({
        id: 'cat_concentration',
        severity: top.pctOfTotal >= 60 ? 'warning' : 'info',
        category: 'recommendation',
        title: 'High Category Concentration',
        summary: `${top.icon} ${top.name} = ${top.pctOfTotal}% of all spending`,
        detail: `Over ${top.pctOfTotal}% of your expenses come from one category: ${top.name}. A healthy spending profile distributes across multiple categories. Consider setting a monthly cap on ${top.name}.`,
        metric: `${top.pctOfTotal}% concentrated`,
        metricDirection: 'neutral',
        confidence: 92,
        actionLabel: 'Set Budget Cap',
      });
    }
  }

  // ── Pad with data-needed if few cards ────────────────────────────────────
  if (cards.length === 0) {
    cards.push({
      id: 'no_data',
      severity: 'neutral',
      category: 'behavior',
      title: 'Add More Transactions',
      summary: 'Build your financial picture',
      detail: 'Track at least 2 months of expenses and income to unlock anomaly detection, trend analysis, behavioral insights, and AI-powered projections.',
      confidence: 100,
    });
  }

  return cards;
}

// ─────────────────────────────────────────────────────────────────────────────
// 11. Chat message processing
// ─────────────────────────────────────────────────────────────────────────────

export interface ChatMessage {
  role: 'user' | 'assistant';
  text: string;
  timestamp: Date;
}

interface ChatContext {
  totalExpenses: number;
  totalIncome: number;
  savingsRate: number;
  catTrends: CategoryTrend[];
  monthHistory: MonthSummary[];
  anomalies: SpendingAnomaly[];
  prediction: PredictionData;
  recurringItems: RecurringItem[];
  cityComparison: CityComparison;
  behaviorProfile: BehaviorProfile;
  healthScore: HealthScore;
  sym: string;
}

export function processChat(input: string, ctx: ChatContext): string {
  const q = input.toLowerCase().trim();
  const sym = ctx.sym;

  // ── Overspend query ───────────────────────────────────────────────────────
  if (q.includes('oversp') || q.includes('over budget') || q.includes('too much')) {
    if (ctx.totalIncome > 0 && ctx.totalExpenses > ctx.totalIncome) {
      const over = Math.round(ctx.totalExpenses - ctx.totalIncome);
      const topCat = ctx.catTrends[0];
      return `You're ${sym}${over.toLocaleString('en-IN')} over budget this period. Your biggest category is ${topCat ? `${topCat.icon} ${topCat.name} (${sym}${Math.round(topCat.currSpent).toLocaleString('en-IN')})` : 'not yet determined'}. Try cutting spending there first to get back on track.`;
    }
    return `Good news — you're not overspending this period. You have ${ctx.totalIncome > 0 ? `${sym}${Math.round(ctx.totalIncome - ctx.totalExpenses).toLocaleString('en-IN')} remaining` : 'no income recorded to compare against'}.`;
  }

  // ── Savings query ─────────────────────────────────────────────────────────
  if (q.includes('save') || q.includes('saving')) {
    const savAmt = ctx.totalIncome > 0 ? ctx.totalIncome - ctx.totalExpenses : 0;
    const savRate = ctx.savingsRate;
    if (savAmt <= 0 && ctx.totalIncome > 0) {
      const bigCat = ctx.catTrends[0];
      return `You're not saving anything this period — expenses exceed income. Consider reducing ${bigCat ? bigCat.name : 'your top categories'} by at least ${sym}${Math.round(ctx.totalExpenses - ctx.totalIncome + ctx.totalIncome * 0.1).toLocaleString('en-IN')} to save 10%.`;
    }
    return `You're saving ${sym}${Math.round(Math.max(0, savAmt)).toLocaleString('en-IN')} (${savRate}% of income) this period. ${savRate >= 20 ? "That's above the 20% benchmark — well done! 🎉" : `The goal is 20% (${sym}${Math.round(ctx.totalIncome * 0.2).toLocaleString('en-IN')}). You need ${sym}${Math.round(Math.max(0, ctx.totalIncome * 0.2 - savAmt)).toLocaleString('en-IN')} more in savings.`}`;
  }

  // ── Category increase ─────────────────────────────────────────────────────
  if (q.includes('increase') || q.includes('most') || q.includes('highest') || q.includes('went up')) {
    const risers = ctx.catTrends.filter(t => t.changePct > 0 && t.prevSpent > 0)
      .sort((a, b) => b.changePct - a.changePct).slice(0, 3);
    if (risers.length === 0) return 'No categories increased compared to last period.';
    return `The biggest increases vs last period:\n${risers.map((r, i) => `${i+1}. ${r.icon} ${r.name}: +${r.changePct}% (${sym}${Math.round(r.prevSpent).toLocaleString('en-IN')} → ${sym}${Math.round(r.currSpent).toLocaleString('en-IN')})`).join('\n')}`;
  }

  // ── Category decrease ─────────────────────────────────────────────────────
  if (q.includes('decreas') || q.includes('went down') || q.includes('reduc') || q.includes('lower')) {
    const fallers = ctx.catTrends.filter(t => t.changePct < 0 && t.prevSpent > 0)
      .sort((a, b) => a.changePct - b.changePct).slice(0, 3);
    if (fallers.length === 0) return 'No categories decreased compared to last period.';
    return `The biggest decreases vs last period:\n${fallers.map((r, i) => `${i+1}. ${r.icon} ${r.name}: ${r.changePct}% (${sym}${Math.round(r.prevSpent).toLocaleString('en-IN')} → ${sym}${Math.round(r.currSpent).toLocaleString('en-IN')})`).join('\n')}`;
  }

  // ── City comparison ───────────────────────────────────────────────────────
  if (q.includes('city') || q.includes('bangalore') || q.includes('bengaluru') || q.includes('mangalore') || q.includes('compare')) {
    const c = ctx.cityComparison;
    if (c.cities.length < 2) {
      const city = c.cities[0] ?? 'your location';
      const info = c.perCity[city];
      return info
        ? `All expenses in this period are from ${city}: ${sym}${Math.round(info.total).toLocaleString('en-IN')} across ${info.txnCount} transactions. Top category: ${info.topCat}.`
        : 'No city data available for this period.';
    }
    const lines = c.cities.map(city => {
      const d = c.perCity[city];
      return `${city}: ${sym}${Math.round(d.total).toLocaleString('en-IN')} (${d.txnCount} txns, top: ${d.topCat})`;
    });
    return `City breakdown this period:\n${lines.join('\n')}`;
  }

  // ── Unusual / anomaly ─────────────────────────────────────────────────────
  if (q.includes('unusual') || q.includes('anomaly') || q.includes('odd') || q.includes('spike')) {
    if (ctx.anomalies.length === 0) return 'No unusual transactions detected this period. All spending looks within normal range.';
    return `Found ${ctx.anomalies.length} unusual transaction${ctx.anomalies.length > 1 ? 's' : ''}:\n${ctx.anomalies.map((a, i) => `${i+1}. ${a.expense.description} (${sym}${a.expense.amount.toLocaleString('en-IN')}) — ${a.label}`).join('\n')}`;
  }

  // ── Projection ────────────────────────────────────────────────────────────
  if (q.includes('project') || q.includes('predict') || q.includes('forecast') || q.includes('end of month')) {
    const p = ctx.prediction;
    if (p.daysRemaining === 0) return 'The period has ended — projection is not applicable.';
    return `At your current burn rate of ${sym}${Math.round(p.dailyBurnRate).toLocaleString('en-IN')}/day, you'll spend approximately ${sym}${Math.round(p.projectedMonthEnd).toLocaleString('en-IN')} by period end (${p.daysRemaining} days remaining). ${ctx.totalIncome > 0 ? `Projected savings: ${sym}${Math.round(Math.max(0, ctx.totalIncome - p.projectedMonthEnd)).toLocaleString('en-IN')}.` : ''}`;
  }

  // ── Health score ──────────────────────────────────────────────────────────
  if (q.includes('health') || q.includes('score') || q.includes('rating') || q.includes('grade')) {
    const h = ctx.healthScore;
    return `Your financial health score is **${h.total}/100 (${h.grade} — ${h.label})**.\n\nBreakdown:\n• Savings: ${h.breakdown.savings}/25\n• Spending Discipline: ${h.breakdown.discipline}/25\n• Volatility: ${h.breakdown.volatility}/25\n• Recurring Burden: ${h.breakdown.consistency}/25\n\n${h.explanation.join('\n• ')}`;
  }

  // ── Biggest expense ───────────────────────────────────────────────────────
  if (q.includes('biggest') || q.includes('largest') || q.includes('most expensive')) {
    const bigItems = ctx.behaviorProfile.bigTicketItems;
    if (bigItems.length === 0) return 'No expenses recorded this period.';
    return `Biggest expenses this period:\n${bigItems.map((e, i) => `${i+1}. ${e.description} — ${sym}${e.amount.toLocaleString('en-IN')}`).join('\n')}`;
  }

  // ── Recurring ─────────────────────────────────────────────────────────────
  if (q.includes('recurring') || q.includes('subscription') || q.includes('repeat')) {
    if (ctx.recurringItems.length === 0) return 'No recurring payments detected in your transaction history.';
    return `${ctx.recurringItems.length} recurring payment${ctx.recurringItems.length > 1 ? 's' : ''} detected:\n${ctx.recurringItems.map(r => `• ${r.desc} — ${sym}${Math.round(r.avgAmount).toLocaleString('en-IN')} avg (${r.count}× total)`).join('\n')}`;
  }

  // ── Top category ──────────────────────────────────────────────────────────
  if (q.includes('top') || q.includes('category') || q.includes('categor')) {
    if (ctx.catTrends.length === 0) return 'No category data for this period.';
    const top3 = ctx.catTrends.slice(0, 3);
    return `Top spending categories this period:\n${top3.map((c, i) => `${i+1}. ${c.icon} ${c.name}: ${sym}${Math.round(c.currSpent).toLocaleString('en-IN')} (${c.pctOfTotal}% of total)`).join('\n')}`;
  }

  // ── Catch-all ─────────────────────────────────────────────────────────────
  return `I can help you understand your finances. Try asking:\n• "Where did I overspend?"\n• "How can I save more?"\n• "What category increased most?"\n• "Show unusual transactions"\n• "Compare city spending"\n• "What's my projected spend?"\n• "What's my health score?"`;
}
