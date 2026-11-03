'use client';

import { useMemo, useState } from 'react';
import {
  ComposedChart, BarChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, ReferenceLine, Cell,
} from 'recharts';
import {
  LineChart as LineChartIcon, TrendingUp, TrendingDown, Minus,
  BarChart2, GitCompareArrows, CalendarClock, CalendarRange, Info,
} from 'lucide-react';
import YearlySummary from '@/components/YearlySummary';
import { useBudgetStore } from '@/store/budgetStore';
import { formatCurrency, formatCurrencyShort } from '@/utils/currency';
import { todayLocalISO } from '@/utils/financialCycle';
import { buildMonthlySeries, withMoM, categoryTrends, MonthPointMoM } from '@/lib/trends';
import { forecast, ForecastPoint } from '@/lib/forecast';
import { useChartTheme } from '@/components/charts/chartTheme';
import ChartTooltip from '@/components/charts/ChartTooltip';

type Tab = 'trends' | 'yearly' | 'compare' | 'forecast';
const PERIODS = [3, 6, 12] as const;

const srOnly: React.CSSProperties = {
  position: 'absolute', width: 1, height: 1, padding: 0, margin: -1,
  overflow: 'hidden', clip: 'rect(0,0,0,0)', whiteSpace: 'nowrap', border: 0,
};

const panelTitle: React.CSSProperties = {
  fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-400)',
  textTransform: 'uppercase', letterSpacing: '0.09em', marginBottom: 14,
};

const thStyle: React.CSSProperties = {
  fontSize: '0.625rem', fontWeight: 700, color: 'var(--text-400)',
  textTransform: 'uppercase', letterSpacing: '0.07em', textAlign: 'right',
  padding: '0 10px 8px', borderBottom: '1px solid var(--border-default)',
};

const tdStyle: React.CSSProperties = {
  padding: '9px 10px', borderBottom: '1px solid var(--bg-muted)',
  fontSize: '0.8125rem', fontVariantNumeric: 'tabular-nums',
  color: 'var(--text-700)', textAlign: 'right', whiteSpace: 'nowrap',
};

/** ▲/▼ MoM cell — direction icon + signed text; invert=true flips the sentiment colour (expenses: up is bad). */
function MomCell({ value, invert = false }: { value: number | null; invert?: boolean }) {
  if (value === null) return <td style={{ ...tdStyle, color: 'var(--text-300)' }}>—</td>;
  const up = value > 0;
  const good = invert ? !up : up;
  const color = Math.abs(value) < 0.05 ? 'var(--text-400)' : good ? 'var(--green-600)' : 'var(--red-500)';
  return (
    <td style={{ ...tdStyle, color, fontWeight: 600 }}>
      {Math.abs(value) < 0.05 ? '•' : up ? '▲' : '▼'} {value > 0 ? '+' : '−'}{Math.abs(value).toFixed(1)}%
    </td>
  );
}

/** Tiny inline-SVG sparkline (no recharts overhead per row). */
function Sparkline({ values, color }: { values: number[]; color: string }) {
  const W = 88, H = 26, pad = 2;
  const max = Math.max(1, ...values);
  const pts = values.map((v, i) => {
    const x = pad + (i / Math.max(1, values.length - 1)) * (W - 2 * pad);
    const y = H - pad - (v / max) * (H - 2 * pad);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} aria-hidden="true" style={{ display: 'block' }}>
      <polyline points={pts.join(' ')} fill="none" stroke={color} strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

function ChartBox({ label, summary, height = 260, children }: {
  label: string; summary: string; height?: number; children: React.ReactNode;
}) {
  return (
    <div role="img" aria-label={label}>
      <span style={srOnly}>{summary}</span>
      <div style={{ width: '100%', height }}>{children}</div>
    </div>
  );
}

export default function TrendsWorkspace() {
  const {
    expenses, income, categories,
    selectedMonth, selectedYear, selectedCity,
    excludedCategoryIds, budgetCategoryIds, getMonthlyBudget,
    financialCycleStart, currency,
  } = useBudgetStore();

  const today = todayLocalISO();
  const theme = useChartTheme();

  const [months, setMonths] = useState<3 | 6 | 12>(6);
  const [tab, setTab] = useState<Tab>('trends');
  const [compareKeys, setCompareKeys] = useState<string[] | null>(null); // null = not yet customised

  // ── Series for the selected period ────────────────────────────────────────
  const seriesOpts = useMemo(() => ({
    financialCycleStart, selectedCity, excludedCategoryIds,
    budgetCategoryIds, getBudget: getMonthlyBudget, today,
  }), [financialCycleStart, selectedCity, excludedCategoryIds, budgetCategoryIds, getMonthlyBudget, today]);

  const series = useMemo(() =>
    withMoM(buildMonthlySeries(expenses, income, {
      ...seriesOpts, endMonth: selectedMonth, endYear: selectedYear, months,
    })),
    [expenses, income, seriesOpts, selectedMonth, selectedYear, months]);

  // ── Compare pool: last 24 financial months that have any activity ─────────
  const comparePool = useMemo(() =>
    buildMonthlySeries(expenses, income, {
      ...seriesOpts, endMonth: selectedMonth, endYear: selectedYear, months: 24,
    }).filter(p => p.txnCount > 0 || p.income > 0),
    [expenses, income, seriesOpts, selectedMonth, selectedYear]);

  const selected = useMemo(() => {
    const keys = compareKeys ?? comparePool.slice(-3).map(p => p.key);
    return comparePool.filter(p => keys.includes(p.key));
  }, [compareKeys, comparePool]);

  const toggleCompare = (key: string) => {
    const cur = (compareKeys ?? comparePool.slice(-3).map(p => p.key));
    const next = cur.includes(key) ? cur.filter(k => k !== key) : [...cur, key];
    if (next.length <= 6) setCompareKeys(next);
  };

  // ── KPIs ──────────────────────────────────────────────────────────────────
  const kpis = useMemo(() => {
    const n = Math.max(1, series.length);
    const avgIncome = series.reduce((s, p) => s + p.income, 0) / n;
    const avgExpenses = series.reduce((s, p) => s + p.expenses, 0) / n;
    const rates = series.map(p => p.savingsRate).filter((r): r is number => r !== null);
    const avgRate = rates.length ? rates.reduce((s, r) => s + r, 0) / rates.length : null;
    const totalSavings = series.reduce((s, p) => s + p.savings, 0);
    return { avgIncome, avgExpenses, avgRate, totalSavings };
  }, [series]);

  const catTrends = useMemo(() => categoryTrends(series, categories), [series, categories]);

  // ── Forecast ──────────────────────────────────────────────────────────────
  const fc = useMemo(() => forecast(series, 3), [series]);

  // Combined actual + forecast chart data (last 6 actuals + forecast points)
  const forecastChartData = useMemo(() => {
    if (fc.status !== 'ok') return [];
    const actuals = series.slice(-6).map(p => ({
      label: p.label, expenses: p.expenses, kind: p.isComplete ? 'actual' : 'todate',
      low: undefined as number | undefined, high: undefined as number | undefined,
    }));
    const fwd = fc.points.map((p: ForecastPoint) => ({
      label: p.label, expenses: p.expenses, kind: 'forecast' as const,
      low: p.low, high: p.high,
    }));
    return [...actuals, ...fwd];
  }, [fc, series]);

  // ── Compare aggregations ──────────────────────────────────────────────────
  const compareCats = useMemo(() => {
    const totals = new Map<string, number>();
    for (const p of selected) {
      for (const [catId, v] of Object.entries(p.byCategory)) {
        totals.set(catId, (totals.get(catId) ?? 0) + v);
      }
    }
    const sorted = [...totals.entries()].sort((a, b) => b[1] - a[1]);
    return sorted.slice(0, 6).map(([id]) => id);
  }, [selected]);

  const catCompareData = useMemo(() => {
    const rows: Record<string, unknown>[] = [];
    const names = compareCats.map(id => categories.find(c => c.id === id)?.name ?? id);
    const hasOther = selected.some(p => Object.keys(p.byCategory).some(c => !compareCats.includes(c)));
    const keys = hasOther ? [...names, 'Other'] : names;
    keys.forEach((name, i) => {
      const row: Record<string, unknown> = { category: name };
      const catId = i < compareCats.length ? compareCats[i] : null;
      for (const p of selected) {
        const val = catId
          ? (p.byCategory[catId] ?? 0)
          : Object.entries(p.byCategory)
              .filter(([c]) => !compareCats.includes(c))
              .reduce((s, [, v]) => s + v, 0);
        row[p.label] = val;
      }
      rows.push(row);
    });
    return rows;
  }, [selected, compareCats, categories]);

  const kpiCard = (label: string, value: string, sub: string, color: string, icon: React.ReactNode) => (
    <div className="panel" style={{ padding: '16px 18px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <span style={{ width: 28, height: 28, borderRadius: 8, background: `${color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', color }}>{icon}</span>
        <span style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-400)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>{label}</span>
      </div>
      <div style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--text-900)', fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.02em' }}>{value}</div>
      <div style={{ fontSize: '0.7rem', color: 'var(--text-400)', marginTop: 3 }}>{sub}</div>
    </div>
  );

  const trendBadge = (t: 'up' | 'down' | 'flat') => t === 'up'
    ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: 'var(--red-500)', fontWeight: 700, fontSize: '0.75rem' }}><TrendingUp size={12} /> Rising</span>
    : t === 'down'
      ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: 'var(--green-600)', fontWeight: 700, fontSize: '0.75rem' }}><TrendingDown size={12} /> Falling</span>
      : <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: 'var(--text-400)', fontWeight: 700, fontSize: '0.75rem' }}><Minus size={12} /> Flat</span>;

  return (
    <div>
      {/* ── Header ── */}
      <div className="ws-header">
        <div>
          <h1 className="ws-title">Trends</h1>
          <p className="ws-subtitle">Monthly patterns, comparisons and forward estimates</p>
        </div>
        {/* Period length (not used by the Yearly Overview, which has its own year picker) */}
        {tab !== 'yearly' && (
          <div className="ws-tab-bar" role="group" aria-label="Period length">
            {PERIODS.map(p => (
              <button key={p} className={`ws-tab${months === p ? ' active' : ''}`} onClick={() => setMonths(p)}>
                {p}M
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── Tabs ── */}
      <div className="ws-tab-bar" style={{ marginBottom: 16, alignSelf: 'flex-start' }}>
        {([
          { id: 'trends', label: 'Monthly Trends', Icon: BarChart2 },
          { id: 'yearly', label: 'Yearly Overview', Icon: CalendarRange },
          { id: 'compare', label: 'Compare', Icon: GitCompareArrows },
          { id: 'forecast', label: 'Forecast', Icon: CalendarClock },
        ] as const).map(({ id, label, Icon }) => (
          <button key={id} className={`ws-tab${tab === id ? ' active' : ''}`} onClick={() => setTab(id)} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <Icon size={13} /> {label}
          </button>
        ))}
      </div>

      {/* ════════════════════ TAB: YEARLY OVERVIEW ════════════════════ */}
      {tab === 'yearly' && <YearlySummary />}

      {/* ════════════════════ TAB: MONTHLY TRENDS ════════════════════ */}
      {tab === 'trends' && (
        <>
          {/* KPI cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 16 }}>
            {kpiCard('Avg income', formatCurrency(kpis.avgIncome, currency), `per month over ${months} months`, 'var(--green-600)', <TrendingUp size={14} />)}
            {kpiCard('Avg expenses', formatCurrency(kpis.avgExpenses, currency), `per month over ${months} months`, 'var(--red-500)', <TrendingDown size={14} />)}
            {kpiCard('Avg savings rate', kpis.avgRate !== null ? `${kpis.avgRate.toFixed(1)}%` : '—', kpis.avgRate !== null ? 'of monthly income' : 'no income recorded', 'var(--brand-600)', <LineChartIcon size={14} />)}
            {kpiCard('Total savings', formatCurrency(kpis.totalSavings, currency), kpis.totalSavings >= 0 ? 'across the period' : 'overspent across the period', kpis.totalSavings >= 0 ? 'var(--green-600)' : 'var(--red-500)', <Minus size={14} />)}
          </div>

          {/* Composed chart */}
          <div className="panel" style={{ padding: '20px 24px', marginBottom: 16 }}>
            <div style={panelTitle}>Income · Expenses · Savings</div>
            <ChartBox
              label="Monthly income, expenses and savings chart"
              summary={`Bar chart of monthly income and expenses with a savings line for the last ${months} months.`}
            >
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={series} margin={{ top: 4, right: 8, bottom: 0, left: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={theme.grid} vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: theme.axis }} axisLine={{ stroke: theme.grid }} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: theme.axis }} axisLine={false} tickLine={false} tickFormatter={v => formatCurrencyShort(v, currency)} width={64} />
                  <Tooltip content={<ChartTooltip currency={currency} />} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="income" name="Income" fill={theme.income} radius={[4, 4, 0, 0]} maxBarSize={36} />
                  <Bar dataKey="expenses" name="Expenses" fill={theme.expenses} radius={[4, 4, 0, 0]} maxBarSize={36} />
                  <Line type="monotone" dataKey="savings" name="Savings" stroke={theme.savings} strokeWidth={2.4} dot={{ r: 3, fill: theme.savings }} />
                </ComposedChart>
              </ResponsiveContainer>
            </ChartBox>
          </div>

          {/* Monthly table */}
          <div className="panel" style={{ padding: '20px 24px', marginBottom: 16 }}>
            <div style={panelTitle}>Month by month</div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 700 }}>
                <thead>
                  <tr>
                    <th style={{ ...thStyle, textAlign: 'left' }}>Month</th>
                    <th style={thStyle}>Income</th>
                    <th style={thStyle}>Expenses</th>
                    <th style={thStyle}>Savings</th>
                    <th style={thStyle}>Savings rate</th>
                    <th style={thStyle}>Budget used</th>
                    <th style={thStyle}>Inc Δ</th>
                    <th style={thStyle}>Exp Δ</th>
                    <th style={thStyle}>Sav Δ</th>
                  </tr>
                </thead>
                <tbody>
                  {series.map((p: MonthPointMoM) => (
                    <tr key={p.key} style={{ background: p.isCurrent ? 'var(--brand-50)' : 'transparent' }}>
                      <td style={{ ...tdStyle, textAlign: 'left', fontWeight: 700, color: 'var(--text-900)' }}>
                        {p.label}{p.isCurrent && <span style={{ marginLeft: 6, fontSize: '0.62rem', fontWeight: 800, color: 'var(--brand-600)', textTransform: 'uppercase' }}>current</span>}
                      </td>
                      <td style={{ ...tdStyle, color: 'var(--green-600)', fontWeight: 600 }}>{formatCurrencyShort(p.income, currency)}</td>
                      <td style={{ ...tdStyle, color: 'var(--red-500)', fontWeight: 600 }}>{formatCurrencyShort(p.expenses, currency)}</td>
                      <td style={{ ...tdStyle, color: p.savings >= 0 ? 'var(--green-600)' : 'var(--red-500)', fontWeight: 700 }}>{formatCurrencyShort(p.savings, currency)}</td>
                      <td style={tdStyle}>{p.savingsRate !== null ? `${p.savingsRate}%` : '—'}</td>
                      <td style={tdStyle}>{p.budgetUsedPct !== null ? `${p.budgetUsedPct}%` : '—'}</td>
                      <MomCell value={p.incomeMoM} />
                      <MomCell value={p.expensesMoM} invert />
                      <MomCell value={p.savingsMoM} />
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Category trends */}
          {catTrends.length > 0 && (
            <div className="panel" style={{ padding: '20px 24px' }}>
              <div style={panelTitle}>Category trends</div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 560 }}>
                  <thead>
                    <tr>
                      <th style={{ ...thStyle, textAlign: 'left' }}>Category</th>
                      <th style={thStyle}>Trend</th>
                      <th style={thStyle}>Total</th>
                      <th style={thStyle}>Avg / month</th>
                      <th style={thStyle}>Latest Δ</th>
                      <th style={{ ...thStyle, textAlign: 'left' }}>Direction</th>
                    </tr>
                  </thead>
                  <tbody>
                    {catTrends.map(t => (
                      <tr key={t.catId}>
                        <td style={{ ...tdStyle, textAlign: 'left', fontWeight: 700, color: 'var(--text-900)' }}>
                          {t.icon} {t.name}
                        </td>
                        <td style={tdStyle}><Sparkline values={t.values} color={t.color} /></td>
                        <td style={{ ...tdStyle, fontWeight: 700 }}>{formatCurrency(t.total, currency)}</td>
                        <td style={tdStyle}>{formatCurrency(t.avg, currency)}</td>
                        <MomCell value={t.latestMoM} invert />
                        <td style={{ ...tdStyle, textAlign: 'left' }}>{trendBadge(t.trend)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* ════════════════════ TAB: COMPARE ════════════════════ */}
      {tab === 'compare' && (
        <>
          {/* Month chips */}
          <div className="panel" style={{ padding: '16px 20px', marginBottom: 16 }}>
            <div style={{ ...panelTitle, marginBottom: 10 }}>Pick 2–6 months to compare</div>
            {comparePool.length === 0 ? (
              <div style={{ fontSize: '0.8125rem', color: 'var(--text-400)' }}>No months with data yet.</div>
            ) : (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }} role="group" aria-label="Months to compare">
                {comparePool.map(p => {
                  const active = selected.some(s => s.key === p.key);
                  const atMax = !active && selected.length >= 6;
                  return (
                    <button
                      key={p.key}
                      onClick={() => toggleCompare(p.key)}
                      disabled={atMax}
                      aria-pressed={active}
                      style={{
                        padding: '6px 12px', borderRadius: 99, cursor: atMax ? 'default' : 'pointer', fontFamily: 'inherit',
                        fontSize: '0.75rem', fontWeight: 600,
                        background: active ? 'var(--brand-600)' : 'var(--bg-surface)',
                        color: active ? '#fff' : atMax ? 'var(--text-300)' : 'var(--text-600)',
                        border: active ? '1px solid var(--brand-600)' : '1px solid var(--border-default)',
                      }}
                    >
                      {p.label}
                    </button>
                  );
                })}
              </div>
            )}
            {selected.length < 2 && comparePool.length > 0 && (
              <div role="alert" style={{ marginTop: 10, fontSize: '0.78rem', color: 'var(--amber-600)', fontWeight: 600 }}>
                Select at least 2 months to compare.
              </div>
            )}
          </div>

          {selected.length >= 2 && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16 }}>
              {/* Income vs expenses */}
              <div className="panel" style={{ padding: '18px 20px' }}>
                <div style={panelTitle}>Income vs expenses</div>
                <ChartBox label="Income vs expenses comparison" summary="Grouped bars of income and expenses per selected month." height={220}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={selected} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={theme.grid} vertical={false} />
                      <XAxis dataKey="label" tick={{ fontSize: 10, fill: theme.axis }} axisLine={{ stroke: theme.grid }} tickLine={false} />
                      <YAxis tick={{ fontSize: 10, fill: theme.axis }} axisLine={false} tickLine={false} tickFormatter={v => formatCurrencyShort(v, currency)} width={58} />
                      <Tooltip content={<ChartTooltip currency={currency} />} />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      <Bar dataKey="income" name="Income" fill={theme.income} radius={[3, 3, 0, 0]} maxBarSize={24} />
                      <Bar dataKey="expenses" name="Expenses" fill={theme.expenses} radius={[3, 3, 0, 0]} maxBarSize={24} />
                    </BarChart>
                  </ResponsiveContainer>
                </ChartBox>
              </div>

              {/* Category spending grouped by month */}
              <div className="panel" style={{ padding: '18px 20px' }}>
                <div style={panelTitle}>Category spending (top {compareCats.length})</div>
                <ChartBox label="Category spending by month" summary="Grouped bars of spending per top category for the selected months." height={220}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={catCompareData} layout="vertical" margin={{ top: 4, right: 8, bottom: 0, left: 8 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={theme.grid} horizontal={false} />
                      <XAxis type="number" tick={{ fontSize: 10, fill: theme.axis }} axisLine={false} tickLine={false} tickFormatter={v => formatCurrencyShort(v, currency)} />
                      <YAxis type="category" dataKey="category" tick={{ fontSize: 10, fill: theme.axis }} axisLine={{ stroke: theme.grid }} tickLine={false} width={86} />
                      <Tooltip content={<ChartTooltip currency={currency} />} />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      {selected.map((p, i) => (
                        <Bar key={p.key} dataKey={p.label} name={p.label} fill={theme.series[i % theme.series.length]} maxBarSize={14} />
                      ))}
                    </BarChart>
                  </ResponsiveContainer>
                </ChartBox>
              </div>

              {/* Savings */}
              <div className="panel" style={{ padding: '18px 20px' }}>
                <div style={panelTitle}>Savings</div>
                <ChartBox label="Monthly savings comparison" summary="Bar chart of net savings per selected month; negative bars are red." height={220}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={selected} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={theme.grid} vertical={false} />
                      <XAxis dataKey="label" tick={{ fontSize: 10, fill: theme.axis }} axisLine={{ stroke: theme.grid }} tickLine={false} />
                      <YAxis tick={{ fontSize: 10, fill: theme.axis }} axisLine={false} tickLine={false} tickFormatter={v => formatCurrencyShort(v, currency)} width={58} />
                      <Tooltip content={<ChartTooltip currency={currency} />} />
                      <ReferenceLine y={0} stroke={theme.axis} />
                      <Bar dataKey="savings" name="Savings" radius={[3, 3, 0, 0]} maxBarSize={28}>
                        {selected.map((p, i) => (
                          <Cell key={i} fill={p.savings >= 0 ? theme.savings : theme.expenses} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </ChartBox>
              </div>

              {/* Budget utilisation */}
              <div className="panel" style={{ padding: '18px 20px' }}>
                <div style={panelTitle}>Budget utilisation</div>
                <ChartBox label="Budget utilisation percent per month" summary="Bar chart of budget utilisation with 80 and 100 percent reference lines." height={220}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={selected} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={theme.grid} vertical={false} />
                      <XAxis dataKey="label" tick={{ fontSize: 10, fill: theme.axis }} axisLine={{ stroke: theme.grid }} tickLine={false} />
                      <YAxis tick={{ fontSize: 10, fill: theme.axis }} axisLine={false} tickLine={false} tickFormatter={v => `${v}%`} width={44} />
                      <Tooltip content={({ active, label, payload }) => {
                        if (!active || !payload?.length) return null;
                        const p = selected.find(s => s.label === label);
                        if (p && p.budget === null) {
                          return (
                            <div style={{ background: theme.tooltipBg, border: `1px solid ${theme.tooltipBorder}`, borderRadius: 8, padding: '8px 12px', fontSize: '0.72rem', color: theme.tooltipText }}>
                              <strong>{label}</strong><br />No budget
                            </div>
                          );
                        }
                        return <ChartTooltip active={active} label={label} payload={payload} currency={currency} format="percent" />;
                      }} />
                      <ReferenceLine y={100} stroke={theme.expenses} strokeDasharray="4 3" label={{ value: '100%', fontSize: 9, fill: theme.expenses, position: 'right' }} />
                      <ReferenceLine y={80} stroke={theme.budget} strokeDasharray="4 3" label={{ value: '80%', fontSize: 9, fill: theme.budget, position: 'right' }} />
                      <Bar dataKey="budgetUsedPct" name="Budget used" radius={[3, 3, 0, 0]} maxBarSize={28}>
                        {selected.map((p, i) => (
                          <Cell key={i} fill={p.budgetUsedPct === null ? 'transparent' : p.budgetUsedPct >= 100 ? theme.expenses : p.budgetUsedPct >= 80 ? theme.budget : theme.income} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </ChartBox>
              </div>
            </div>
          )}
        </>
      )}

      {/* ════════════════════ TAB: FORECAST ════════════════════ */}
      {tab === 'forecast' && (
        <>
          {fc.status === 'insufficient' ? (
            <div className="panel" style={{ padding: '48px 24px', textAlign: 'center' }}>
              <div style={{ fontSize: 36, marginBottom: 12 }}>📉</div>
              <div style={{ fontSize: '0.9375rem', fontWeight: 700, color: 'var(--text-700)', marginBottom: 6 }}>
                Need {fc.monthsNeeded} complete months of data — you have {fc.monthsAvailable}
              </div>
              <div style={{ fontSize: '0.8125rem', color: 'var(--text-400)' }}>
                Keep logging transactions — forecasts appear once enough complete months exist.
              </div>
            </div>
          ) : (
            <>
              <div className="panel" style={{ padding: '20px 24px', marginBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
                  <div style={panelTitle}>Next 3 months</div>
                  {/* Legend */}
                  <div style={{ display: 'flex', gap: 14, fontSize: '0.72rem', color: 'var(--text-500)' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                      <span style={{ width: 10, height: 10, borderRadius: 2, background: theme.expenses, display: 'inline-block' }} /> Actual
                    </span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                      <span style={{ width: 10, height: 10, borderRadius: 2, background: 'transparent', border: `2px solid ${theme.expenses}`, display: 'inline-block' }} /> Actual to date
                    </span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                      <span style={{ width: 10, height: 10, borderRadius: 2, background: theme.forecastDim, border: `1.5px dashed ${theme.forecast}`, display: 'inline-block' }} /> Forecast (estimate)
                    </span>
                  </div>
                </div>

                <ChartBox
                  label="Expense forecast chart"
                  summary={`Bar chart of the last ${Math.min(6, series.length)} actual months plus 3 forecast months using a rolling average.`}
                >
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={forecastChartData} margin={{ top: 4, right: 8, bottom: 0, left: 8 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={theme.grid} vertical={false} />
                      <XAxis dataKey="label" tick={{ fontSize: 10, fill: theme.axis }} axisLine={{ stroke: theme.grid }} tickLine={false} />
                      <YAxis tick={{ fontSize: 10, fill: theme.axis }} axisLine={false} tickLine={false} tickFormatter={v => formatCurrencyShort(v, currency)} width={58} />
                      <Tooltip content={({ active, label, payload }) => {
                        if (!active || !payload?.length) return null;
                        const d = payload[0]?.payload as { kind?: string; low?: number; high?: number } | undefined;
                        const footer = d?.kind === 'forecast' && d.low !== undefined && d.high !== undefined
                          ? [`Expected range: ${formatCurrencyShort(d.low, currency)} – ${formatCurrencyShort(d.high, currency)}`]
                          : d?.kind === 'todate' ? ['Month still in progress — actual to date'] : undefined;
                        return <ChartTooltip active={active} label={label} payload={payload} currency={currency} footer={footer} />;
                      }} />
                      <Bar dataKey="expenses" name="Expenses" maxBarSize={32} radius={[4, 4, 0, 0]}>
                        {forecastChartData.map((d, i) => (
                          <Cell
                            key={i}
                            fill={d.kind === 'forecast' ? theme.forecastDim : d.kind === 'todate' ? 'transparent' : theme.expenses}
                            stroke={d.kind === 'forecast' ? theme.forecast : d.kind === 'todate' ? theme.expenses : 'none'}
                            strokeWidth={d.kind === 'actual' ? 0 : 1.5}
                            strokeDasharray={d.kind === 'actual' ? undefined : '4 3'}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </ChartBox>

                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginTop: 12, fontSize: '0.72rem', color: 'var(--text-400)' }}>
                  <Info size={12} style={{ flexShrink: 0, marginTop: 1 }} />
                  <span>
                    <strong style={{ color: 'var(--text-600)' }}>{fc.method}</strong>
                    {' — '}estimates based on your past {fc.basis.length} complete months, not a guarantee.
                  </span>
                </div>
              </div>

              {/* Forecast table */}
              <div className="panel" style={{ padding: '20px 24px' }}>
                <div style={panelTitle}>Forecast breakdown</div>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 560 }}>
                    <thead>
                      <tr>
                        <th style={{ ...thStyle, textAlign: 'left' }}>Month</th>
                        <th style={thStyle}>Est. income</th>
                        <th style={thStyle}>Est. expenses</th>
                        <th style={thStyle}>Est. savings</th>
                        <th style={thStyle}>Expense range</th>
                      </tr>
                    </thead>
                    <tbody>
                      {fc.points.map(p => (
                        <tr key={p.key}>
                          <td style={{ ...tdStyle, textAlign: 'left', fontWeight: 700, color: 'var(--text-900)' }}>
                            {p.label}
                            <span style={{ marginLeft: 6, fontSize: '0.62rem', fontWeight: 800, color: 'var(--brand-600)', textTransform: 'uppercase' }}>estimate</span>
                          </td>
                          <td style={{ ...tdStyle, color: 'var(--green-600)', fontWeight: 600 }}>{formatCurrency(p.income, currency)}</td>
                          <td style={{ ...tdStyle, color: 'var(--red-500)', fontWeight: 600 }}>{formatCurrency(p.expenses, currency)}</td>
                          <td style={{ ...tdStyle, color: p.savings >= 0 ? 'var(--green-600)' : 'var(--red-500)', fontWeight: 700 }}>{formatCurrency(p.savings, currency)}</td>
                          <td style={tdStyle}>{formatCurrencyShort(p.low, currency)} – {formatCurrencyShort(p.high, currency)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
