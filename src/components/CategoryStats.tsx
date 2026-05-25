'use client';

import { TrendingUp, TrendingDown, Wallet, ArrowUpRight, ArrowDownRight, Minus, Zap } from 'lucide-react';
import { useBudgetStore } from '@/store/budgetStore';
import { formatCurrency, currencySymbol } from '@/utils/currency';
import { getFinancialMonthRange } from '@/utils/financialCycle';

// ── Standard KPI Card ──────────────────────────────────────────────────────

interface KPICardProps {
  label: string;
  value: string;
  subtext: string;
  trend?: 'up' | 'down' | 'flat';
  trendLabel?: string;
  accent: string;
  accentBg: string;
  icon: React.ReactNode;
  isPositiveTrend?: boolean;
}

function KPICard({ label, value, subtext, trend, trendLabel, accent, accentBg, icon, isPositiveTrend }: KPICardProps) {
  const TrendIcon = trend === 'up' ? ArrowUpRight : trend === 'down' ? ArrowDownRight : Minus;
  const trendColor = trend === 'flat' ? '#9ca3af' : isPositiveTrend
    ? (trend === 'up' ? '#10b981' : '#ef4444')
    : (trend === 'up' ? '#ef4444' : '#10b981');

  return (
    <div
      className="dark-card p-5 flex flex-col gap-3 transition-all duration-200"
      style={{ borderTop: `3px solid ${accent}` }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-2px)';
        (e.currentTarget as HTMLDivElement).style.boxShadow = `0 8px 24px rgba(0,0,0,0.08), 0 0 0 1px ${accent}22`;
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLDivElement).style.transform = '';
        (e.currentTarget as HTMLDivElement).style.boxShadow = '';
      }}
    >
      <div className="flex items-start justify-between">
        <p className="card-header-label">{label}</p>
        <div className="icon-pill" style={{ background: accentBg }}>
          {icon}
        </div>
      </div>
      <div>
        <p className="text-2xl font-bold num-mono" style={{ color: '#111827', lineHeight: 1.1 }}>{value}</p>
        <p className="text-xs mt-1" style={{ color: '#6b7280' }}>{subtext}</p>
      </div>
      {trend && trendLabel && (
        <div className="flex items-center gap-1">
          <TrendIcon size={13} style={{ color: trendColor }} />
          <span className="text-xs font-semibold" style={{ color: trendColor }}>{trendLabel}</span>
        </div>
      )}
    </div>
  );
}

// ── Financial Health Score Card ────────────────────────────────────────────

interface HealthCardProps {
  score: number;
  color: string;
  accentBg: string;
  statusLabel: string;
  insight: string;
  trend: 'up' | 'down' | 'flat';
  sparkData: number[];
}

function HealthScoreCard({ score, color, accentBg, statusLabel, insight, trend, sparkData }: HealthCardProps) {
  const r = 27;
  const circumference = 2 * Math.PI * r;
  const dashOffset = circumference * (1 - Math.min(100, Math.max(0, score)) / 100);

  // Sparkline (expense trend)
  const maxSpark = Math.max(...sparkData, 1);
  const W = 56, H = 20;
  const pts = sparkData
    .map((v, i) => {
      const x = sparkData.length > 1 ? (i / (sparkData.length - 1)) * W : W / 2;
      const y = H - 2 - (v / maxSpark) * (H - 4);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
  const lastX = sparkData.length > 1 ? W : W / 2;
  const lastY = H - 2 - (sparkData[sparkData.length - 1] / maxSpark) * (H - 4);

  const TrendIcon = trend === 'up' ? ArrowUpRight : trend === 'down' ? ArrowDownRight : Minus;
  const trendColor = trend === 'flat' ? '#9ca3af' : trend === 'up' ? color : '#ef4444';
  const trendText  = trend === 'up' ? 'Improving' : trend === 'down' ? 'Declining' : 'Stable';

  return (
    <div
      className="dark-card p-5 flex flex-col gap-3 transition-all duration-200"
      style={{ borderTop: `3px solid ${color}` }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-2px)';
        (e.currentTarget as HTMLDivElement).style.boxShadow = `0 8px 28px rgba(0,0,0,0.09), 0 0 0 1px ${color}33`;
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLDivElement).style.transform = '';
        (e.currentTarget as HTMLDivElement).style.boxShadow = '';
      }}
    >
      {/* Header row */}
      <div className="flex items-start justify-between">
        <p className="card-header-label">Health Score</p>
        {/* Expense sparkline */}
        <svg width={W} height={H} style={{ opacity: 0.85, overflow: 'visible' }}>
          <defs>
            <linearGradient id="sparkGrad" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor={color} stopOpacity={0.4} />
              <stop offset="100%" stopColor={color} stopOpacity={1} />
            </linearGradient>
          </defs>
          {sparkData.some(v => v > 0) && (
            <polyline
              points={pts}
              fill="none"
              stroke="url(#sparkGrad)"
              strokeWidth={1.8}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}
          {sparkData[sparkData.length - 1] > 0 && (
            <circle cx={lastX} cy={lastY} r={2.5} fill={color} />
          )}
        </svg>
      </div>

      {/* Ring + status */}
      <div className="flex items-center gap-3">
        <div style={{ position: 'relative', flexShrink: 0 }}>
          <svg width={68} height={68} viewBox="0 0 68 68">
            <defs>
              <filter id="ringGlow" x="-30%" y="-30%" width="160%" height="160%">
                <feGaussianBlur stdDeviation="2.5" result="blur" />
                <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
              </filter>
            </defs>
            {/* Track */}
            <circle r={r} cx={34} cy={34} fill="none" stroke="#f0f2f5" strokeWidth={5} />
            {/* Progress arc */}
            <circle
              r={r} cx={34} cy={34}
              fill="none"
              stroke={color}
              strokeWidth={5}
              strokeLinecap="round"
              strokeDasharray={`${circumference}`}
              strokeDashoffset={dashOffset}
              transform="rotate(-90 34 34)"
              filter="url(#ringGlow)"
              style={{ transition: 'stroke-dashoffset 1s cubic-bezier(0.4,0,0.2,1)' }}
            />
            {/* Score */}
            <text x={34} y={31} textAnchor="middle" fill="#111827" fontSize={15} fontWeight={800}
              style={{ fontVariantNumeric: 'tabular-nums', fontFamily: 'inherit' }}>
              {score}
            </text>
            <text x={34} y={43} textAnchor="middle" fill="#9ca3af" fontSize={8} style={{ fontFamily: 'inherit' }}>
              /100
            </text>
          </svg>
          {/* Soft glow */}
          <div style={{
            position: 'absolute', inset: 6, borderRadius: '50%',
            background: `radial-gradient(circle, ${color}18 0%, transparent 70%)`,
            pointerEvents: 'none',
          }} />
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <p className="text-sm font-bold" style={{ color: '#111827', lineHeight: 1.2 }}>{statusLabel}</p>
          <p className="text-xs mt-1" style={{ color: '#6b7280', lineHeight: 1.45 }}>{insight}</p>
          <span style={{
            display: 'inline-block', marginTop: 5, padding: '2px 8px',
            borderRadius: 100, fontSize: 9, fontWeight: 700, letterSpacing: '0.04em',
            background: accentBg, color: color, border: `1px solid ${color}33`,
          }}>
            {statusLabel.split(' ')[0].toUpperCase()}
          </span>
        </div>
      </div>

      {/* Trend row */}
      <div className="flex items-center gap-1">
        <TrendIcon size={13} style={{ color: trendColor }} />
        <span className="text-xs font-semibold" style={{ color: trendColor }}>{trendText}</span>
      </div>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────

export default function CategoryStats() {
  const { categories, getMonthlyTotal, getMonthlyIncome, selectedMonth, selectedYear, selectedCity, expenses, currency, financialCycleStart } = useBudgetStore();

  const monthlyExpenses   = getMonthlyTotal(selectedMonth, selectedYear);   // already respects selectedCity
  const monthlyIncome     = getMonthlyIncome(selectedMonth, selectedYear);
  const netBalance        = monthlyIncome - monthlyExpenses;
  const savings           = netBalance;
  const savingsRate       = monthlyIncome > 0 ? (savings / monthlyIncome) * 100 : 0;
  const savingsPositive   = savings >= 0;
  const sym               = currencySymbol(currency);

  // Daily average spend — uses elapsed days in financial period
  const { start, end } = getFinancialMonthRange(selectedMonth, selectedYear, financialCycleStart);
  const now = new Date();
  const endNorm = new Date(end); endNorm.setHours(23, 59, 59, 999);
  const isCurrentPeriod = now >= start && now <= endNorm;
  const periodLength = Math.round((endNorm.getTime() - start.getTime()) / 86400000) + 1;
  const daysElapsed  = isCurrentPeriod
    ? Math.max(1, Math.ceil((now.getTime() - start.getTime()) / 86400000) + 1)
    : periodLength;
  const dailyAvg = daysElapsed > 0 ? monthlyExpenses / daysElapsed : 0;
  const daysLeft = isCurrentPeriod ? Math.max(0, periodLength - daysElapsed) : 0;

  // ── Health Score computation ────────────────────────────────────────────
  const hasData = monthlyIncome > 0 || monthlyExpenses > 0;

  // 1. Savings ratio (0-25)
  const savingsScore = monthlyIncome === 0 ? 12
    : savingsRate >= 30 ? 25
    : savingsRate >= 20 ? 20
    : savingsRate >= 10 ? 15
    : savingsRate >= 5  ? 10
    : savingsRate > 0   ? 7 : 0;

  // 2. Cash flow health (0-25)
  const cashFlowScore = monthlyIncome === 0 ? 12 : (() => {
    const ratio = netBalance / monthlyIncome;
    return ratio >= 0.3 ? 25 : ratio >= 0.1 ? 20 : ratio >= 0 ? 15 : ratio >= -0.2 ? 8 : 0;
  })();

  // 3. Income cushion — how well income covers expenses (0-25)
  const incomeCushionScore = monthlyIncome === 0 ? 12 : (() => {
    const ratio = monthlyIncome / Math.max(monthlyExpenses, 1);
    return ratio >= 2.0 ? 25 : ratio >= 1.5 ? 22 : ratio >= 1.2 ? 18 : ratio >= 1.0 ? 12 : ratio >= 0.8 ? 6 : 0;
  })();

  // 4. Expense / income ratio (0-25)
  const expenseRatioScore = monthlyIncome === 0 ? 12 : (() => {
    const ratio = monthlyExpenses / monthlyIncome;
    return ratio <= 0.5 ? 25 : ratio <= 0.7 ? 20 : ratio <= 0.85 ? 15 : ratio <= 1.0 ? 10 : ratio <= 1.2 ? 5 : 0;
  })();

  const healthScore = hasData
    ? Math.min(100, Math.round(savingsScore + cashFlowScore + incomeCushionScore + expenseRatioScore))
    : 50;

  const healthColor = healthScore >= 80 ? '#10b981'
    : healthScore >= 65 ? '#3b82f6'
    : healthScore >= 50 ? '#f59e0b'
    : healthScore >= 35 ? '#f97316' : '#ef4444';

  const healthBg = healthScore >= 80 ? '#ecfdf5'
    : healthScore >= 65 ? '#eff6ff'
    : healthScore >= 50 ? '#fffbeb'
    : healthScore >= 35 ? '#fff7ed' : '#fef2f2';

  const healthStatusLabel = healthScore >= 80 ? 'Excellent Stability'
    : healthScore >= 65 ? 'Healthy Pattern'
    : healthScore >= 50 ? 'Moderate - Monitor'
    : healthScore >= 35 ? 'Warning - Review'
    : 'Critical - Act Now';

  const healthInsight = (() => {
    if (!hasData)            return 'Add transactions to see insights';
    if (savingsRate >= 20)   return `Saving ${savingsRate.toFixed(0)}% of income - great discipline`;
    if (savingsRate > 0)     return `Saving ${savingsRate.toFixed(0)}% - aim for 20%+`;
    if (netBalance < 0)      return `Outflows exceed income by ${sym}${Math.abs(netBalance).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
    if (monthlyExpenses > 0) {
      const txCount = expenses.filter(e =>
        e.month === selectedMonth && e.year === selectedYear &&
        (selectedCity === 'Both' || (e.city ?? 'Bangalore') === selectedCity)
      ).length;
      return `Spent ${sym}${monthlyExpenses.toLocaleString('en-IN', { maximumFractionDigits: 0 })} across ${txCount} transaction${txCount !== 1 ? 's' : ''}`;
    }
    return 'No spend recorded this period yet';
  })();

  // Sparkline: last 6 financial periods' expense totals (city-filtered via getMonthlyTotal)
  const sparkData = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(selectedYear, parseInt(selectedMonth) - 1 - (5 - i), 1);
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const y = d.getFullYear();
    return getMonthlyTotal(m, y);
  });

  // Expense trending down = health improving
  const prev = sparkData[sparkData.length - 2];
  const last = sparkData[sparkData.length - 1];
  const healthTrend: 'up' | 'down' | 'flat' =
    prev === 0 ? 'flat'
    : (last - prev) / prev < -0.05 ? 'up'
    : (last - prev) / prev >  0.05 ? 'down'
    : 'flat';

  return (
    <div className="space-y-4">
      {/* KPI Grid - 6 cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
        <KPICard
          label="Total Income"
          value={`${sym}${monthlyIncome.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`}
          subtext="This period"
          accent="#10b981"
          accentBg="#ecfdf5"
          icon={<TrendingUp size={15} color="#10b981" />}
          trend="up"
          trendLabel="Inflows"
          isPositiveTrend
        />
        <KPICard
          label="Total Expenses"
          value={`${sym}${monthlyExpenses.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`}
          subtext="This period"
          accent="#ef4444"
          accentBg="#fef2f2"
          icon={<TrendingDown size={15} color="#ef4444" />}
          trend={monthlyExpenses > monthlyIncome ? 'up' : 'down'}
          trendLabel={monthlyExpenses > monthlyIncome ? 'Over income' : 'Within income'}
          isPositiveTrend={false}
        />
        <KPICard
          label="Net Balance"
          value={`${netBalance >= 0 ? '+' : ''}${sym}${Math.abs(netBalance).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`}
          subtext={netBalance >= 0 ? 'Surplus this period' : 'Deficit this period'}
          accent={netBalance >= 0 ? '#10b981' : '#ef4444'}
          accentBg={netBalance >= 0 ? '#ecfdf5' : '#fef2f2'}
          icon={<Wallet size={15} color={netBalance >= 0 ? '#10b981' : '#ef4444'} />}
          trend={netBalance >= 0 ? 'up' : 'down'}
          trendLabel={netBalance >= 0 ? 'Positive cash flow' : 'Negative cash flow'}
          isPositiveTrend
        />
        <KPICard
          label="Daily Avg Spend"
          value={formatCurrency(dailyAvg, currency)}
          subtext={isCurrentPeriod ? `${daysLeft} day${daysLeft !== 1 ? 's' : ''} left in period` : `Over ${periodLength} days`}
          accent="#8b5cf6"
          accentBg="#f5f3ff"
          icon={<Zap size={15} color="#8b5cf6" />}
          trend={dailyAvg > 0 && monthlyIncome > 0
            ? (dailyAvg * periodLength < monthlyIncome ? 'up' : 'down')
            : 'flat'}
          trendLabel={dailyAvg > 0 ? `${sym}${Math.round(dailyAvg * periodLength).toLocaleString('en-IN')} projected` : 'No spend yet'}
          isPositiveTrend
        />
        <KPICard
          label="Savings Rate"
          value={`${savingsRate.toFixed(1)}%`}
          subtext={formatCurrency(Math.max(0, savings), currency) + ' saved'}
          accent={savingsPositive ? '#f59e0b' : '#ef4444'}
          accentBg={savingsPositive ? '#fffbeb' : '#fef2f2'}
          icon={<TrendingUp size={15} color={savingsPositive ? '#f59e0b' : '#ef4444'} />}
          trend={savingsPositive ? 'up' : 'down'}
          trendLabel={savingsPositive ? 'On track' : 'Overspending'}
          isPositiveTrend
        />
        <HealthScoreCard
          score={healthScore}
          color={healthColor}
          accentBg={healthBg}
          statusLabel={healthStatusLabel}
          insight={healthInsight}
          trend={healthTrend}
          sparkData={sparkData}
        />
      </div>

      {/* Cash Flow Banner */}
      <div className="dark-card p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-3">
          <div>
            <p className="card-header-label mb-0.5">Cash Flow - {new Date(parseInt(selectedYear.toString()), parseInt(selectedMonth) - 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</p>
            <p className="text-sm" style={{ color: '#6b7280' }}>Income vs spending at a glance</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="badge" style={{
              background: savingsPositive ? '#ecfdf5' : '#fef2f2',
              color: savingsPositive ? '#065f46' : '#991b1b',
            }}>
              {savingsPositive ? '↑' : '↓'} {savingsRate.toFixed(1)}% savings rate
            </span>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex justify-between text-xs font-medium mb-1" style={{ color: '#6b7280' }}>
            <span>Spent: {formatCurrency(monthlyExpenses, currency)}</span>
            <span>Income: {formatCurrency(monthlyIncome, currency)}</span>
          </div>
          <div className="progress-track">
            <div
              className="progress-fill"
              style={{
                width: `${monthlyIncome > 0 ? Math.min(100, (monthlyExpenses / monthlyIncome) * 100) : 0}%`,
                background: savingsPositive
                  ? 'linear-gradient(90deg, #10b981, #34d399)'
                  : 'linear-gradient(90deg, #ef4444, #f87171)',
              }}
            />
          </div>
          <div className="flex justify-between text-xs" style={{ color: '#9ca3af' }}>
            <span>Expense ratio: {monthlyIncome > 0 ? ((monthlyExpenses / monthlyIncome) * 100).toFixed(0) : 0}% of income</span>
            <span>Saved: {formatCurrency(Math.max(0, savings), currency)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
