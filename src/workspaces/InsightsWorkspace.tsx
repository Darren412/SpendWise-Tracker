'use client';

import { useMemo, useState, useRef, useCallback, useEffect } from 'react';
import {
  Brain, Sparkles, TrendingUp, AlertTriangle,
  CheckCircle, Info, Zap, MessageCircle, Send, ChevronDown,
  ChevronUp, Target, Activity, BarChart2, RefreshCw,
  ArrowUpRight, ArrowDownRight, Minus, ShieldCheck, X, Clock,
  CalendarRange, ChevronLeft, ChevronRight,
} from 'lucide-react';
import { useBudgetStore } from '@/store/budgetStore';
import { currencySymbol } from '@/utils/currency';
import { getFinancialMonthRange } from '@/utils/financialCycle';
import {
  buildMonthHistory,
  buildCategoryTrends,
  detectRecurring,
  detectAnomalies,
  buildPrediction,
  computeHealthScore,
  buildBehaviorProfile,
  buildCityComparison,
  buildNarrativeSummary,
  generateInsightCards,
  processChat,
  buildYearSummary,
  buildYearlyCategoryBreakdown,
  buildYearlyNarrativeSummary,
  generateYearlyInsightCards,
  type AIInsightCard,
  type ChatMessage,
  type InsightSeverity,
} from '@/utils/aiInsights';

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────

function ConfidenceDot({ confidence }: { confidence: number }) {
  const color = confidence >= 90 ? '#16a34a' : confidence >= 75 ? '#d97706' : '#6b7280';
  return (
    <span title={`${confidence}% confidence`} style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: '0.625rem', fontWeight: 700, color, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: color, display: 'inline-block' }} />
      {confidence}%
    </span>
  );
}

function MetricPill({ metric, direction }: { metric: string; direction?: 'up' | 'down' | 'neutral' }) {
  const color = direction === 'up' ? '#ef4444' : direction === 'down' ? '#16a34a' : '#6366f1';
  const Icon = direction === 'up' ? ArrowUpRight : direction === 'down' ? ArrowDownRight : Minus;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, padding: '2px 8px', borderRadius: 99, background: `${color}14`, color, fontSize: '0.75rem', fontWeight: 800, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
      <Icon size={10} />
      {metric}
    </span>
  );
}

const SEVERITY_CFG: Record<InsightSeverity, { border: string; iconBg: string; iconColor: string; bg: string; label: string }> = {
  critical:    { bg: '#fef2f2', border: '#fecaca', iconBg: '#fee2e2', iconColor: '#dc2626', label: 'Critical' },
  warning:     { bg: '#fffbeb', border: '#fde68a', iconBg: '#fef3c7', iconColor: '#d97706', label: 'Warning' },
  positive:    { bg: '#f0fdf4', border: '#bbf7d0', iconBg: '#dcfce7', iconColor: '#16a34a', label: 'Positive' },
  info:        { bg: '#eff6ff', border: '#bfdbfe', iconBg: '#dbeafe', iconColor: '#2563eb', label: 'Info' },
  neutral:     { bg: '#f8fafc', border: '#e2e8f0', iconBg: '#f1f5f9', iconColor: '#64748b', label: 'Neutral' },
};

const SEVERITY_ICON: Record<InsightSeverity, React.ElementType> = {
  critical: AlertTriangle,
  warning:  AlertTriangle,
  positive: CheckCircle,
  info:     Info,
  neutral:  Brain,
};

function InsightCardFull({ card, onOpenModal }: { card: AIInsightCard; onOpenModal: (card: AIInsightCard) => void }) {
  const cfg  = SEVERITY_CFG[card.severity];
  const Icon = SEVERITY_ICON[card.severity];

  return (
    <div
      className="ai-insight-card"
      style={{
        background: cfg.bg,
        borderColor: cfg.border,
        borderLeft: `3px solid ${cfg.iconColor}`,
        cursor: 'pointer',
      }}
      onClick={() => onOpenModal(card)}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <div style={{
          width: 36, height: 36, borderRadius: 10,
          background: `linear-gradient(135deg, ${cfg.iconBg}, ${cfg.bg})`,
          color: cfg.iconColor,
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          boxShadow: `0 2px 8px ${cfg.iconColor}22`,
        }}>
          <Icon size={15} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
            <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#0f172a' }}>{card.title}</span>
            {card.metric && <MetricPill metric={card.metric} direction={card.metricDirection} />}
          </div>
          <p style={{ fontSize: '0.8125rem', color: '#475569', lineHeight: 1.5, margin: 0 }}>{card.summary}</p>
        </div>
        <span style={{ flexShrink: 0 }}><ConfidenceDot confidence={card.confidence} /></span>
      </div>
    </div>
  );
}

/** Fullscreen insight modal with detailed analysis */
function InsightModal({ card, onClose }: { card: AIInsightCard; onClose: () => void }) {
  const cfg  = SEVERITY_CFG[card.severity];
  const Icon = SEVERITY_ICON[card.severity];

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 10000,
        background: 'rgba(15,23,42,0.5)', backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 24,
        animation: 'fadeIn 0.15s ease',
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        background: '#fff', borderRadius: 20, maxWidth: 520, width: '100%',
        boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
        overflow: 'hidden',
        animation: 'slideUp 0.2s ease',
      }}>
        {/* Modal header */}
        <div style={{
          background: `linear-gradient(135deg, ${cfg.bg} 0%, #fff 100%)`,
          padding: '24px 28px 20px',
          borderBottom: `1px solid ${cfg.border}`,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{
              width: 44, height: 44, borderRadius: 12,
              background: `linear-gradient(135deg, ${cfg.iconBg}, ${cfg.bg})`,
              color: cfg.iconColor,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: `0 4px 12px ${cfg.iconColor}22`,
            }}>
              <Icon size={20} />
            </div>
            <div style={{ flex: 1 }}>
              <h3 style={{ fontSize: '1.0625rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>{card.title}</h3>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                <span style={{
                  fontSize: '0.625rem', fontWeight: 700, color: cfg.iconColor,
                  background: cfg.iconBg, padding: '2px 8px', borderRadius: 99,
                  textTransform: 'uppercase', letterSpacing: '0.06em',
                }}>
                  {cfg.label}
                </span>
                <ConfidenceDot confidence={card.confidence} />
                {card.metric && <MetricPill metric={card.metric} direction={card.metricDirection} />}
              </div>
            </div>
            <button
              onClick={onClose}
              style={{
                width: 32, height: 32, borderRadius: 8, background: '#f8fafc',
                border: '1px solid #e2e8f0', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#94a3b8', flexShrink: 0,
              }}
            >
              <X size={14} />
            </button>
          </div>
        </div>

        {/* Modal body */}
        <div style={{ padding: '24px 28px' }}>
          <div style={{ marginBottom: 16 }}>
            <p style={{ fontSize: '0.6875rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 }}>Summary</p>
            <p style={{ fontSize: '0.9375rem', color: '#334155', lineHeight: 1.65 }}>{card.summary}</p>
          </div>

          {card.detail && (
            <div style={{
              padding: '16px 18px', borderRadius: 12,
              background: 'linear-gradient(135deg, #f8fafc, #f0f4ff)',
              border: '1px solid #e2e8f0',
            }}>
              <p style={{ fontSize: '0.6875rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 }}>Detailed Analysis</p>
              <p style={{ fontSize: '0.875rem', color: '#334155', lineHeight: 1.65 }}>{card.detail}</p>
            </div>
          )}

          {card.actionLabel && (
            <div style={{ marginTop: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{
                width: 24, height: 24, borderRadius: 6, background: cfg.iconBg, color: cfg.iconColor,
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}>
                <Zap size={11} />
              </div>
              <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: cfg.iconColor }}>
                Recommended: {card.actionLabel}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main workspace
// ─────────────────────────────────────────────────────────────────────────────

export default function InsightsWorkspace() {
  const {
    expenses, income, categories,
    selectedMonth, selectedYear, selectedCity,
    excludedCategoryIds,
    financialCycleStart, currency,
  } = useBudgetStore();

  const sym = currencySymbol(currency);
  const { start, end } = getFinancialMonthRange(selectedMonth, selectedYear, financialCycleStart);

  // ── Chat state ─────────────────────────────────────────────────────────────
  const [chatOpen,    setChatOpen]    = useState(false);
  const [chatInput,   setChatInput]   = useState('');
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([
    { role: 'assistant', text: "Hi! I'm your AI financial assistant. Ask me anything about your spending, savings, or trends — I'll use your real data to answer.", timestamp: new Date() }
  ]);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // ── Expanded sections ──────────────────────────────────────────────────────
  const [showAllInsights,  setShowAllInsights]  = useState(false);
  const [showCityComp,     setShowCityComp]     = useState(false);
  const [showHealthDrilldown, setShowHealthDrilldown] = useState(false);
  const [activeTab,        setActiveTab]        = useState<'insights' | 'trends' | 'forecast' | 'behavior'>('insights');
  const [modalCard,        setModalCard]        = useState<AIInsightCard | null>(null);

  // ── Scope toggle: Monthly vs Yearly ────────────────────────────────────────
  const [scope, setScope] = useState<'monthly' | 'yearly'>('monthly');
  const [yearlyYear, setYearlyYear] = useState(selectedYear);

  // Available years from data
  const availableYears = useMemo(() => {
    const years = new Set<number>();
    expenses.forEach(e => years.add(e.year));
    income.forEach(i => years.add(i.year));
    if (years.size === 0) years.add(selectedYear);
    return [...years].sort((a, b) => b - a);
  }, [expenses, income, selectedYear]);

  // ── Computed data ──────────────────────────────────────────────────────────

  const periodExpenses = useMemo(() =>
    expenses.filter(e => {
      const d = new Date(e.date + 'T00:00:00');
      return d >= start && d <= end &&
        (selectedCity === 'Both' || !e.city || e.city === selectedCity) &&
        (excludedCategoryIds.length === 0 || !excludedCategoryIds.includes(e.category));
    }),
    [expenses, start, end, selectedCity, excludedCategoryIds]);

  const periodIncome = useMemo(() =>
    income.filter(i => { const d = new Date(i.date + 'T00:00:00'); return d >= start && d <= end; }),
    [income, start, end]);

  const totalExpenses = useMemo(() => periodExpenses.reduce((s, e) => s + e.amount, 0), [periodExpenses]);
  const totalIncome   = useMemo(() => periodIncome.reduce((s, i) => s + i.amount, 0), [periodIncome]);
  const savingsRate   = totalIncome > 0 ? Math.round(((totalIncome - totalExpenses) / totalIncome) * 100) : 0;

  const monthHistory  = useMemo(() => buildMonthHistory(expenses, income, selectedMonth, selectedYear, financialCycleStart, 6), [expenses, income, selectedMonth, selectedYear, financialCycleStart]);
  const catTrends     = useMemo(() => buildCategoryTrends(expenses, categories, selectedMonth, selectedYear, selectedCity, financialCycleStart, excludedCategoryIds), [expenses, categories, selectedMonth, selectedYear, selectedCity, financialCycleStart, excludedCategoryIds]);
  const recurringItems = useMemo(() => detectRecurring(expenses, 6), [expenses]);
  const anomalies     = useMemo(() => detectAnomalies(periodExpenses, expenses, categories, 3), [periodExpenses, expenses, categories]);
  const prediction    = useMemo(() => buildPrediction(periodExpenses, monthHistory, start, end, totalIncome), [periodExpenses, monthHistory, start, end, totalIncome]);
  const behaviorProfile = useMemo(() => buildBehaviorProfile(periodExpenses, categories), [periodExpenses, categories]);
  const cityComparison  = useMemo(() => buildCityComparison(periodExpenses, categories), [periodExpenses, categories]);
  const healthScore   = useMemo(() => computeHealthScore(totalExpenses, totalIncome, monthHistory, catTrends, recurringItems), [totalExpenses, totalIncome, monthHistory, catTrends, recurringItems]);
  const insightCards  = useMemo(() => generateInsightCards(totalExpenses, totalIncome, savingsRate, catTrends, monthHistory, anomalies, prediction, recurringItems, sym), [totalExpenses, totalIncome, savingsRate, catTrends, monthHistory, anomalies, prediction, recurringItems, sym]);
  const narrativeLines = useMemo(() => buildNarrativeSummary(totalExpenses, totalIncome, catTrends, prediction, healthScore, sym), [totalExpenses, totalIncome, catTrends, prediction, healthScore, sym]);

  // ── Yearly computed data ───────────────────────────────────────────────────
  const yearSummary = useMemo(() =>
    buildYearSummary(expenses, income, yearlyYear, financialCycleStart),
    [expenses, income, yearlyYear, financialCycleStart]);

  const yearlyCatTrends = useMemo(() =>
    buildYearlyCategoryBreakdown(expenses, categories, yearlyYear, selectedCity, financialCycleStart, excludedCategoryIds, yearlyYear - 1),
    [expenses, categories, yearlyYear, selectedCity, financialCycleStart, excludedCategoryIds]);

  const yearlyNarrative = useMemo(() =>
    buildYearlyNarrativeSummary(yearSummary, yearlyCatTrends, sym),
    [yearSummary, yearlyCatTrends, sym]);

  const yearlyInsightCards = useMemo(() =>
    generateYearlyInsightCards(yearSummary, yearlyCatTrends, sym),
    [yearSummary, yearlyCatTrends, sym]);

  const yearlyVisibleInsights = showAllInsights ? yearlyInsightCards : yearlyInsightCards.slice(0, 4);

  // Yearly savings rate
  const yearlySavingsRate = yearSummary.totalIncome > 0
    ? Math.round(((yearSummary.totalIncome - yearSummary.totalExpenses) / yearSummary.totalIncome) * 100) : 0;

  // ── Chat auto-scroll ───────────────────────────────────────────────────────
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory, chatOpen]);

  const handleChat = useCallback(() => {
    const q = chatInput.trim();
    if (!q) return;
    const userMsg: ChatMessage = { role: 'user', text: q, timestamp: new Date() };
    const response = processChat(q, { totalExpenses, totalIncome, savingsRate, catTrends, monthHistory, anomalies, prediction, recurringItems, cityComparison, behaviorProfile, healthScore, sym });
    const aiMsg: ChatMessage = { role: 'assistant', text: response, timestamp: new Date() };
    setChatHistory(prev => [...prev, userMsg, aiMsg]);
    setChatInput('');
  }, [chatInput, totalExpenses, totalIncome, savingsRate, catTrends, monthHistory, anomalies, prediction, recurringItems, cityComparison, behaviorProfile, healthScore, sym]);

  // ── Computed display values ────────────────────────────────────────────────
  const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const selectedMonthLabel = `${MONTH_NAMES[parseInt(selectedMonth) - 1]} ${selectedYear}`;
  const visibleInsights = showAllInsights ? insightCards : insightCards.slice(0, 4);

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div style={{ maxWidth: 1400 }} className="ai-insights-root">

      {/* ══════════════════════════════════════════════════════════════════════
          HEADER
      ══════════════════════════════════════════════════════════════════════ */}
      <div className="ws-header">
        <div>
          <h1 className="ws-title" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span className="ai-icon-glow" style={{ width: 36, height: 36, borderRadius: 'var(--r-md)' }}><Sparkles size={16} /></span>
            AI Insights
            <span style={{ fontSize: '0.6875rem', fontWeight: 700, padding: '3px 10px', borderRadius: 99, background: 'var(--brand-50)', color: 'var(--brand-600)', border: '1px solid var(--brand-200)' }}>
              {scope === 'monthly' ? selectedMonthLabel : String(yearlyYear)}
            </span>
          </h1>
          <p className="ws-subtitle">Intelligent analysis of your real financial data · Updated live</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {/* Scope toggle */}
          <div style={{ display: 'flex', borderRadius: 10, overflow: 'hidden', border: '1.5px solid #e2e8f0' }}>
            {(['monthly', 'yearly'] as const).map(s => (
              <button
                key={s}
                onClick={() => { setScope(s); setShowAllInsights(false); }}
                style={{
                  padding: '7px 16px', fontSize: '0.75rem', fontWeight: 700,
                  cursor: 'pointer', border: 'none', fontFamily: 'inherit',
                  background: scope === s ? 'var(--brand-600)' : '#fff',
                  color: scope === s ? '#fff' : '#64748b',
                  transition: 'all 0.15s',
                  textTransform: 'capitalize',
                }}
              >
                {s}
              </button>
            ))}
          </div>
          {/* Year selector (yearly scope) */}
          {scope === 'yearly' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <button
                onClick={() => { const idx = availableYears.indexOf(yearlyYear); if (idx < availableYears.length - 1) setYearlyYear(availableYears[idx + 1]); }}
                disabled={availableYears.indexOf(yearlyYear) >= availableYears.length - 1}
                style={{ padding: '5px 8px', borderRadius: 8, border: '1px solid #e2e8f0', background: '#fff', cursor: 'pointer', color: '#64748b', display: 'flex', alignItems: 'center' }}
              >
                <ChevronLeft size={14} />
              </button>
              <span style={{ fontSize: '0.875rem', fontWeight: 800, color: '#1e293b', minWidth: 44, textAlign: 'center' }}>{yearlyYear}</span>
              <button
                onClick={() => { const idx = availableYears.indexOf(yearlyYear); if (idx > 0) setYearlyYear(availableYears[idx - 1]); }}
                disabled={availableYears.indexOf(yearlyYear) <= 0}
                style={{ padding: '5px 8px', borderRadius: 8, border: '1px solid #e2e8f0', background: '#fff', cursor: 'pointer', color: '#64748b', display: 'flex', alignItems: 'center' }}
              >
                <ChevronRight size={14} />
              </button>
            </div>
          )}
          <button
            onClick={() => setChatOpen(v => !v)}
            className="ai-chat-trigger-btn"
            style={{ background: chatOpen ? 'var(--brand-600)' : undefined, color: chatOpen ? '#fff' : undefined, borderColor: chatOpen ? 'var(--brand-600)' : undefined }}
          >
            <MessageCircle size={14} />
            Ask AI
            {chatOpen && <X size={12} style={{ marginLeft: 2 }} />}
          </button>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          MONTHLY VIEW
      ══════════════════════════════════════════════════════════════════════ */}
      {scope === 'monthly' && (<>

      {/* ── HERO KPI STRIP ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, marginBottom: 20 }}>
        {/* Health Score — hero card */}
        <div
          onClick={() => setShowHealthDrilldown(v => !v)}
          style={{
            padding: '16px 18px', borderRadius: 16, cursor: 'pointer',
            background: `linear-gradient(135deg, ${healthScore.color}0d, ${healthScore.color}05)`,
            border: `1.5px solid ${healthScore.color}30`,
            transition: 'all 0.2s ease',
            position: 'relative', overflow: 'hidden',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div className="ai-score-ring" style={{ '--score-color': healthScore.color, '--score-pct': `${healthScore.total}%`, width: 56, height: 56, fontSize: '0.625rem' } as React.CSSProperties}>
              <span style={{ fontSize: '1.25rem', fontWeight: 900, color: healthScore.color, lineHeight: 1 }}>{healthScore.total}</span>
            </div>
            <div>
              <div style={{ fontSize: '0.625rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Health Score</div>
              <div style={{ fontSize: '0.875rem', fontWeight: 800, color: healthScore.color, marginTop: 2 }}>{healthScore.grade}</div>
              <div style={{ fontSize: '0.6875rem', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: 3, marginTop: 2 }}>
                {showHealthDrilldown ? <ChevronUp size={10}/> : <ChevronDown size={10}/>} details
              </div>
            </div>
          </div>
        </div>

        {/* KPI Cards */}
        {[
          { label: 'Total Spent', value: `${sym}${Math.round(totalExpenses).toLocaleString('en-IN')}`, sub: `${periodExpenses.length} txns`, color: '#ef4444', Icon: TrendingUp },
          { label: 'Income', value: totalIncome > 0 ? `${sym}${Math.round(totalIncome).toLocaleString('en-IN')}` : '—', sub: totalIncome > 0 ? 'this period' : 'not set', color: '#16a34a', Icon: ArrowUpRight },
          { label: 'Savings Rate', value: totalIncome > 0 ? `${savingsRate}%` : '—', sub: savingsRate >= 20 ? 'Healthy' : savingsRate > 0 ? 'Below target' : '—', color: savingsRate >= 20 ? '#16a34a' : savingsRate > 0 ? '#d97706' : '#94a3b8', Icon: ShieldCheck },
          { label: 'Daily Burn', value: `${sym}${Math.round(prediction.dailyBurnRate).toLocaleString('en-IN')}`, sub: `${prediction.daysRemaining}d remaining`, color: '#6366f1', Icon: Activity },
        ].map(kpi => (
          <div key={kpi.label} style={{
            padding: '16px 18px', borderRadius: 16,
            background: '#fff', border: '1.5px solid #e8ecf0',
            transition: 'all 0.2s ease',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontSize: '0.625rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.07em' }}>{kpi.label}</span>
              <div style={{ width: 26, height: 26, borderRadius: 7, background: `${kpi.color}0d`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <kpi.Icon size={12} color={kpi.color} />
              </div>
            </div>
            <div style={{ fontSize: '1.125rem', fontWeight: 800, color: kpi.color, fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>{kpi.value}</div>
            <div style={{ fontSize: '0.6875rem', color: '#94a3b8', marginTop: 4 }}>{kpi.sub}</div>
          </div>
        ))}
      </div>

      {/* Health Score Drilldown Panel */}
      {showHealthDrilldown && (
        <div style={{
          marginBottom: 20, padding: '20px 24px', borderRadius: 16,
          background: 'linear-gradient(135deg, #fafbff 0%, #f0f4ff 100%)',
          border: '1.5px solid #e2e8f0',
          animation: 'slideUp 0.2s ease',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
            <ShieldCheck size={16} color={healthScore.color} />
            <span style={{ fontSize: '0.9375rem', fontWeight: 800, color: '#1e293b' }}>Health Score Breakdown</span>
            <button onClick={() => setShowHealthDrilldown(false)} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}><X size={14}/></button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
            {[
              { label: 'Savings',    score: healthScore.breakdown.savings,    max: 25, desc: 'Income saved this period' },
              { label: 'Discipline', score: healthScore.breakdown.discipline, max: 25, desc: 'Spending consistency' },
              { label: 'Stability',  score: healthScore.breakdown.volatility, max: 25, desc: 'Month-over-month variance' },
              { label: 'Recurring',  score: healthScore.breakdown.consistency, max: 25, desc: 'Predictable payments' },
            ].map(row => (
              <div key={row.label} style={{ padding: '14px 16px', borderRadius: 12, background: '#fff', border: '1px solid #e8ecf0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#1e293b' }}>{row.label}</span>
                  <span style={{ fontSize: '0.875rem', fontWeight: 900, color: healthScore.color }}>{row.score}<span style={{ fontSize: '0.625rem', color: '#94a3b8', fontWeight: 600 }}>/{row.max}</span></span>
                </div>
                <div style={{ height: 6, background: '#f1f5f9', borderRadius: 99, overflow: 'hidden', marginBottom: 6 }}>
                  <div style={{ height: '100%', width: `${(row.score / row.max) * 100}%`, background: `linear-gradient(90deg, ${healthScore.color}, ${healthScore.color}aa)`, borderRadius: 99, transition: 'width 0.6s ease' }} />
                </div>
                <div style={{ fontSize: '0.6875rem', color: '#94a3b8' }}>{row.desc}</div>
              </div>
            ))}
          </div>
          {healthScore.explanation.length > 0 && (
            <div style={{ marginTop: 14, padding: '12px 16px', borderRadius: 10, background: '#fff', border: '1px solid #e8ecf0' }}>
              {healthScore.explanation.map((line, i) => (
                <div key={i} style={{ fontSize: '0.8125rem', color: '#475569', lineHeight: 1.6, display: 'flex', gap: 8, padding: '2px 0' }}>
                  <span style={{ color: healthScore.color, flexShrink: 0, fontWeight: 700 }}>•</span>
                  <span>{line}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          AI NARRATIVE SUMMARY
      ══════════════════════════════════════════════════════════════════════ */}
      <div className="ai-narrative-card" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <div className="ai-icon-glow" style={{ width: 28, height: 28, borderRadius: 8, flexShrink: 0 }}><Brain size={13} /></div>
          <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#1e293b' }}>AI Financial Summary</span>
          <span style={{ marginLeft: 'auto', fontSize: '0.625rem', color: '#16a34a', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#16a34a', display: 'inline-block', animation: 'aiPulse 2s infinite' }} />
            Live
          </span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {narrativeLines.map((line, i) => (
            <p key={i} style={{ fontSize: '0.875rem', color: i === 0 ? '#1e293b' : '#475569', lineHeight: 1.6, fontWeight: i === 0 ? 600 : 400 }}>
              {line}
            </p>
          ))}
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          AI CHAT PANEL (inline, toggleable)
      ══════════════════════════════════════════════════════════════════════ */}
      {chatOpen && (
        <div className="ai-chat-panel">
          <div className="ai-chat-header">
            <div className="ai-icon-glow" style={{ width: 26, height: 26, borderRadius: 8, flexShrink: 0 }}><MessageCircle size={12} /></div>
            <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#1e293b' }}>AI Assistant</span>
            <span style={{ fontSize: '0.6875rem', color: '#16a34a', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4, marginLeft: 6 }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#16a34a', display: 'inline-block', animation: 'aiPulse 2s infinite' }} />
              Online · Using real data
            </span>
            <button onClick={() => setChatOpen(false)} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', display: 'flex' }}>
              <X size={14} />
            </button>
          </div>

          {/* Suggested prompts */}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', padding: '8px 14px', borderBottom: '1px solid #f1f5f9' }}>
            {[
              'Where did I overspend?',
              'How can I save more?',
              'Show unusual transactions',
              "What's my health score?",
              'Top spending categories',
            ].map(prompt => (
              <button
                key={prompt}
                onClick={() => { setChatInput(prompt); }}
                style={{ padding: '4px 10px', borderRadius: 99, fontSize: '0.6875rem', fontWeight: 600, cursor: 'pointer', background: '#f8fafc', color: '#475569', border: '1px solid #e2e8f0', fontFamily: 'inherit', transition: 'all 0.15s', whiteSpace: 'nowrap' }}
                onMouseEnter={e => { e.currentTarget.style.background = '#eef2ff'; e.currentTarget.style.color = '#4f46e5'; e.currentTarget.style.borderColor = '#a5b4fc'; }}
                onMouseLeave={e => { e.currentTarget.style.background = '#f8fafc'; e.currentTarget.style.color = '#475569'; e.currentTarget.style.borderColor = '#e2e8f0'; }}
              >
                {prompt}
              </button>
            ))}
          </div>

          {/* Messages */}
          <div className="ai-chat-messages">
            {chatHistory.map((msg, i) => (
              <div
                key={i}
                style={{
                  display: 'flex',
                  justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
                  marginBottom: 10,
                }}
              >
                {msg.role === 'assistant' && (
                  <div style={{ width: 22, height: 22, borderRadius: 6, background: 'var(--brand-600)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginRight: 8, marginTop: 2 }}>
                    <Brain size={11} color="#fff" />
                  </div>
                )}
                <div
                  style={{
                    maxWidth: '80%',
                    padding: '9px 13px',
                    borderRadius: msg.role === 'user' ? '14px 14px 4px 14px' : '4px 14px 14px 14px',
                    background: msg.role === 'user' ? 'var(--brand-600)' : '#f8fafc',
                    color: msg.role === 'user' ? '#fff' : '#334155',
                    fontSize: '0.8125rem',
                    lineHeight: 1.55,
                    border: msg.role === 'assistant' ? '1px solid #e2e8f0' : 'none',
                    whiteSpace: 'pre-line',
                  }}
                >
                  {msg.text}
                </div>
              </div>
            ))}
            <div ref={chatEndRef} />
          </div>

          {/* Input */}
          <div className="ai-chat-input-row">
            <input
              value={chatInput}
              onChange={e => setChatInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleChat()}
              placeholder="Ask about your finances…"
              className="ai-chat-input"
            />
            <button onClick={handleChat} className="ai-chat-send-btn" disabled={!chatInput.trim()}>
              <Send size={14} />
            </button>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          TAB NAVIGATION
      ══════════════════════════════════════════════════════════════════════ */}
      <div className="ws-tab-bar" style={{ marginBottom: 16 }}>
        {([
          { key: 'insights',  label: 'Smart Insights', Icon: Zap },
          { key: 'trends',    label: 'Trends & Categories', Icon: BarChart2 },
          { key: 'forecast',  label: 'Forecast', Icon: Activity },
          { key: 'behavior',  label: 'Behavior', Icon: Target },
        ] as { key: typeof activeTab; label: string; Icon: React.ElementType }[]).map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`ws-tab${activeTab === tab.key ? ' active' : ''}`}
            style={{ display: 'flex', alignItems: 'center', gap: 5 }}
          >
            <tab.Icon size={12} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          TAB: SMART INSIGHTS
      ══════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'insights' && (
        <div>
          {/* Insight cards grid */}
          <div className="ai-insights-grid">
            {visibleInsights.map(card => (
              <InsightCardFull key={card.id} card={card} onOpenModal={setModalCard} />
            ))}
          </div>

          {insightCards.length > 4 && (
            <button
              onClick={() => setShowAllInsights(v => !v)}
              style={{ display: 'flex', alignItems: 'center', gap: 6, margin: '8px auto 0', padding: '7px 18px', borderRadius: 99, fontSize: '0.8125rem', fontWeight: 600, cursor: 'pointer', background: 'var(--brand-50)', color: 'var(--brand-600)', border: '1px solid var(--brand-200)', fontFamily: 'inherit' }}
            >
              {showAllInsights ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
              {showAllInsights ? 'Show less' : `Show ${insightCards.length - 4} more insight${insightCards.length - 4 > 1 ? 's' : ''}`}
            </button>
          )}

          {/* Anomalies section */}
          {anomalies.length > 0 && (
            <div className="panel" style={{ marginTop: 16, padding: 0, overflow: 'hidden' }}>
              <div style={{ padding: '14px 18px 10px', background: 'var(--bg-subtle)', borderBottom: '1px solid var(--border-default)', display: 'flex', alignItems: 'center', gap: 8 }}>
                <AlertTriangle size={14} style={{ color: '#d97706' }} />
                <span style={{ fontSize: '0.875rem', fontWeight: 700, color: '#1e293b' }}>Anomaly Detection</span>
                <span className="badge badge-amber" style={{ marginLeft: 'auto' }}>{anomalies.length} flagged</span>
              </div>
              {anomalies.map(a => (
                <div key={a.expense.id} style={{ padding: '12px 18px', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 32, height: 32, borderRadius: 8, background: '#fef3c7', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, flexShrink: 0 }}>
                    {a.categoryIcon}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#1e293b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.expense.description}</div>
                    <div style={{ fontSize: '0.6875rem', color: '#94a3b8', marginTop: 1 }}>{a.label}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.9375rem', fontWeight: 800, color: '#ef4444', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                      {sym}{a.expense.amount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                    </div>
                    <div style={{ fontSize: '0.625rem', color: '#94a3b8', textAlign: 'right' }}>
                      z={a.zscore.toFixed(1)}σ
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Recurring payments */}
          {recurringItems.length > 0 && (
            <div className="panel" style={{ marginTop: 16, padding: 0, overflow: 'hidden' }}>
              <div style={{ padding: '14px 18px 10px', background: 'var(--bg-subtle)', borderBottom: '1px solid var(--border-default)', display: 'flex', alignItems: 'center', gap: 8 }}>
                <RefreshCw size={13} style={{ color: '#6366f1' }} />
                <span style={{ fontSize: '0.875rem', fontWeight: 700, color: '#1e293b' }}>Recurring Payments Detected</span>
                <span className="badge badge-blue" style={{ marginLeft: 'auto' }}>{recurringItems.length} found</span>
              </div>
              {recurringItems.map(item => (
                <div key={item.desc} style={{ padding: '10px 18px', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 32, height: 32, borderRadius: 8, background: '#eef2ff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem', flexShrink: 0 }}>🔁</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#1e293b', textTransform: 'capitalize', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.desc}</div>
                    <div style={{ fontSize: '0.6875rem', color: '#94a3b8', marginTop: 1 }}>{item.count}× in history · last: {new Date(item.lastDate + 'T12:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '0.9375rem', fontWeight: 800, color: '#ef4444', fontVariantNumeric: 'tabular-nums' }}>
                      {sym}{item.lastAmount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                    </div>
                    <div style={{ fontSize: '0.6875rem', color: '#94a3b8' }}>avg {sym}{Math.round(item.avgAmount).toLocaleString('en-IN')}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          TAB: TRENDS & CATEGORIES
      ══════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'trends' && (
        <div>
          {/* 6-month bar chart */}
          <div className="panel" style={{ marginBottom: 16 }}>
            <div style={{ padding: '14px 18px 12px', borderBottom: '1px solid var(--border-default)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <BarChart2 size={14} style={{ color: '#6366f1' }} />
              <span style={{ fontSize: '0.875rem', fontWeight: 700, color: '#1e293b' }}>6-Period Spending vs Income</span>
            </div>
            <div style={{ padding: '16px 18px 8px' }}>
              {/* Legend */}
              <div style={{ display: 'flex', gap: 16, marginBottom: 12 }}>
                {[{ label: 'Expenses', color: '#ef4444' }, { label: 'Income', color: '#16a34a' }].map(l => (
                  <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.6875rem', fontWeight: 600, color: '#64748b' }}>
                    <span style={{ width: 10, height: 10, borderRadius: 2, background: l.color, display: 'inline-block' }} />
                    {l.label}
                  </div>
                ))}
              </div>
              {/* Bars */}
              <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', height: 100 }}>
                {monthHistory.map((m, i) => {
                  const isLatest = i === monthHistory.length - 1;
                  const maxVal = Math.max(...monthHistory.map(h => Math.max(h.expenses, h.income)), 1);
                  const expH = m.expenses > 0 ? Math.max(6, Math.round((m.expenses / maxVal) * 88)) : 3;
                  const incH = m.income > 0 ? Math.max(6, Math.round((m.income / maxVal) * 88)) : 3;
                  return (
                    <div key={m.label} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                      <div style={{ display: 'flex', gap: 2, alignItems: 'flex-end', width: '100%', justifyContent: 'center' }}>
                        <div
                          title={`Expenses: ${sym}${Math.round(m.expenses).toLocaleString('en-IN')}`}
                          style={{ width: '42%', height: expH, background: isLatest ? '#ef4444' : '#fca5a5', borderRadius: '3px 3px 0 0', transition: 'height 0.4s ease', cursor: 'help' }}
                        />
                        <div
                          title={`Income: ${sym}${Math.round(m.income).toLocaleString('en-IN')}`}
                          style={{ width: '42%', height: incH, background: isLatest ? '#16a34a' : '#86efac', borderRadius: '3px 3px 0 0', transition: 'height 0.4s ease', cursor: 'help' }}
                        />
                      </div>
                      <div style={{ fontSize: '0.625rem', fontWeight: isLatest ? 700 : 400, color: isLatest ? '#6366f1' : '#94a3b8', whiteSpace: 'nowrap' }}>{m.label}</div>
                      {m.savings !== 0 && (
                        <div style={{ fontSize: '0.5625rem', fontWeight: 700, color: m.savings >= 0 ? '#16a34a' : '#ef4444' }}>
                          {m.savings >= 0 ? '+' : '−'}{sym}{(Math.abs(m.savings)/1000).toFixed(0)}k
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Category trend table */}
          <div className="panel" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '14px 18px 12px', background: 'var(--bg-subtle)', borderBottom: '1px solid var(--border-default)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <TrendingUp size={14} style={{ color: '#6366f1' }} />
              <span style={{ fontSize: '0.875rem', fontWeight: 700, color: '#1e293b' }}>Category Trends vs Last Period</span>
            </div>

            {catTrends.length === 0 ? (
              <div style={{ padding: '32px', textAlign: 'center', color: '#94a3b8', fontSize: '0.875rem' }}>No category data this period</div>
            ) : (
              <>
                {/* Table header */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 90px 90px 80px 100px', padding: '8px 18px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                  {['Category', 'This Period', 'Last Period', 'Change', 'Share'].map(h => (
                    <span key={h} style={{ fontSize: '0.625rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.07em', textAlign: h === 'Change' || h === 'Share' ? 'right' : 'left' }}>{h}</span>
                  ))}
                </div>
                {catTrends.map(t => (
                  <div key={t.catId} style={{ display: 'grid', gridTemplateColumns: '1fr 90px 90px 80px 100px', padding: '10px 18px', borderBottom: '1px solid #f1f5f9', alignItems: 'center' }}>
                    {/* Category */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 28, height: 28, borderRadius: 7, background: `${t.color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, flexShrink: 0 }}>{t.icon}</div>
                      <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#1e293b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.name}</span>
                    </div>
                    {/* This period */}
                    <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#1e293b', fontVariantNumeric: 'tabular-nums' }}>{sym}{Math.round(t.currSpent).toLocaleString('en-IN')}</span>
                    {/* Last period */}
                    <span style={{ fontSize: '0.8125rem', color: '#64748b', fontVariantNumeric: 'tabular-nums' }}>{t.prevSpent > 0 ? `${sym}${Math.round(t.prevSpent).toLocaleString('en-IN')}` : '—'}</span>
                    {/* Change */}
                    <div style={{ textAlign: 'right' }}>
                      {t.prevSpent > 0 ? (
                        <span style={{ fontSize: '0.75rem', fontWeight: 800, color: t.changePct > 0 ? '#ef4444' : t.changePct < 0 ? '#16a34a' : '#6366f1', display: 'inline-flex', alignItems: 'center', gap: 2 }}>
                          {t.changePct > 0 ? <ArrowUpRight size={11}/> : t.changePct < 0 ? <ArrowDownRight size={11}/> : <Minus size={11}/>}
                          {t.changePct > 0 ? '+' : ''}{t.changePct}%
                        </span>
                      ) : <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>New</span>}
                    </div>
                    {/* Bar + pct */}
                    <div style={{ paddingLeft: 8 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <div style={{ flex: 1, height: 4, background: '#f1f5f9', borderRadius: 99, overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${t.pctOfTotal}%`, background: t.color, borderRadius: 99 }} />
                        </div>
                        <span style={{ fontSize: '0.6875rem', fontWeight: 700, color: '#64748b', minWidth: 28, textAlign: 'right' }}>{t.pctOfTotal}%</span>
                      </div>
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>

          {/* City comparison */}
          {cityComparison.cities.length > 0 && (
            <div className="panel" style={{ marginTop: 16, padding: 0, overflow: 'hidden' }}>
              <div
                style={{ padding: '14px 18px 12px', background: 'var(--bg-subtle)', borderBottom: '1px solid var(--border-default)', display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}
                onClick={() => setShowCityComp(v => !v)}
              >
                <span style={{ fontSize: '0.875rem' }}>📍</span>
                <span style={{ fontSize: '0.875rem', fontWeight: 700, color: '#1e293b' }}>City Spending Comparison</span>
                <span style={{ marginLeft: 'auto', color: '#94a3b8' }}>{showCityComp ? <ChevronUp size={14}/> : <ChevronDown size={14}/>}</span>
              </div>
              {showCityComp && cityComparison.cities.map(city => {
                const d = cityComparison.perCity[city];
                const pct = (periodExpenses.reduce((s, e) => s + e.amount, 0)) > 0 ?
                  Math.round((d.total / periodExpenses.reduce((s, e) => s + e.amount, 0)) * 100) : 0;
                return (
                  <div key={city} style={{ padding: '12px 18px', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 32, height: 32, borderRadius: 8, background: '#eef2ff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem', flexShrink: 0 }}>🏙️</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#1e293b' }}>{city}</div>
                      <div style={{ fontSize: '0.6875rem', color: '#94a3b8', marginTop: 1 }}>{d.txnCount} transactions · Top: {d.topCat}</div>
                      <div style={{ marginTop: 5, height: 3, background: '#f1f5f9', borderRadius: 99, overflow: 'hidden', width: '100%' }}>
                        <div style={{ height: '100%', width: `${pct}%`, background: '#6366f1', borderRadius: 99 }} />
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '0.9375rem', fontWeight: 800, color: '#1e293b', fontVariantNumeric: 'tabular-nums' }}>{sym}{Math.round(d.total).toLocaleString('en-IN')}</div>
                      <div style={{ fontSize: '0.6875rem', color: '#94a3b8' }}>{pct}% of total</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          TAB: FORECAST
      ══════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'forecast' && (
        <div>
          {/* Prediction banner */}
          <div
            className="ai-forecast-banner"
            style={{
              background: prediction.riskLevel === 'high' ? '#fef2f2' : prediction.riskLevel === 'medium' ? '#fffbeb' : '#f0fdf4',
              borderColor: prediction.riskLevel === 'high' ? '#fecaca' : prediction.riskLevel === 'medium' ? '#fde68a' : '#bbf7d0',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <div style={{
                width: 36, height: 36, borderRadius: 10,
                background: prediction.riskLevel === 'high' ? '#fee2e2' : prediction.riskLevel === 'medium' ? '#fef3c7' : '#dcfce7',
                color: prediction.riskLevel === 'high' ? '#dc2626' : prediction.riskLevel === 'medium' ? '#d97706' : '#16a34a',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Activity size={16} />
              </div>
              <div>
                <div style={{ fontSize: '0.9375rem', fontWeight: 800, color: '#1e293b' }}>Spend Projection — {selectedMonthLabel}</div>
                <div style={{ fontSize: '0.75rem', color: prediction.riskLevel === 'high' ? '#dc2626' : prediction.riskLevel === 'medium' ? '#d97706' : '#16a34a', fontWeight: 600 }}>
                  Risk: {prediction.riskLevel.charAt(0).toUpperCase() + prediction.riskLevel.slice(1)} · {prediction.riskReason}
                </div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12 }}>
              {[
                { label: 'Spent So Far',      value: `${sym}${Math.round(periodExpenses.reduce((s,e)=>s+e.amount,0)).toLocaleString('en-IN')}`, note: `${prediction.daysRemaining} days left` },
                { label: 'Daily Burn Rate',   value: `${sym}${Math.round(prediction.dailyBurnRate).toLocaleString('en-IN')}`, note: 'per day avg' },
                { label: 'Projected Total',   value: `${sym}${Math.round(prediction.projectedMonthEnd).toLocaleString('en-IN')}`, note: 'by period end', bold: true },
                { label: 'Projected Savings', value: totalIncome > 0 ? `${sym}${Math.round(Math.max(0, prediction.projectedSavings)).toLocaleString('en-IN')}` : '—', note: totalIncome > 0 ? `${Math.max(0, Math.round(prediction.projectedSavings / totalIncome * 100))}% of income` : 'add income' },
                { label: 'Historical Avg',    value: prediction.previousAvgMonthly > 0 ? `${sym}${Math.round(prediction.previousAvgMonthly).toLocaleString('en-IN')}` : '—', note: 'past periods' },
              ].map(item => (
                <div key={item.label} style={{ padding: '10px 14px', background: 'rgba(255,255,255,0.7)', borderRadius: 10, border: '1px solid rgba(0,0,0,0.06)' }}>
                  <div style={{ fontSize: '0.6875rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>{item.label}</div>
                  <div style={{ fontSize: item.bold ? '1.0625rem' : '0.9375rem', fontWeight: 800, color: '#1e293b', fontVariantNumeric: 'tabular-nums' }}>{item.value}</div>
                  <div style={{ fontSize: '0.625rem', color: '#94a3b8', marginTop: 2 }}>{item.note}</div>
                </div>
              ))}
            </div>

            {/* Progress bar: spent vs projected vs income */}
            {totalIncome > 0 && (
              <div style={{ marginTop: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                  <span style={{ fontSize: '0.6875rem', fontWeight: 700, color: '#64748b' }}>Budget Progress</span>
                  <span style={{ fontSize: '0.6875rem', fontWeight: 700, color: '#64748b' }}>
                    {Math.round((periodExpenses.reduce((s,e)=>s+e.amount,0) / totalIncome) * 100)}% of income used
                  </span>
                </div>
                <div style={{ height: 8, background: '#e2e8f0', borderRadius: 99, overflow: 'hidden', position: 'relative' }}>
                  {/* Spent */}
                  <div style={{
                    position: 'absolute', left: 0, top: 0, height: '100%',
                    width: `${Math.min(100, Math.round((periodExpenses.reduce((s,e)=>s+e.amount,0) / totalIncome) * 100))}%`,
                    background: '#ef4444', borderRadius: 99, transition: 'width 0.5s ease',
                  }} />
                  {/* Projected overlay */}
                  {prediction.daysRemaining > 0 && (
                    <div style={{
                      position: 'absolute', left: 0, top: 0, height: '100%',
                      width: `${Math.min(100, Math.round((prediction.projectedMonthEnd / totalIncome) * 100))}%`,
                      background: 'rgba(239,68,68,0.25)', borderRadius: 99,
                    }} />
                  )}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 3 }}>
                  <span style={{ fontSize: '0.5625rem', color: '#94a3b8' }}>{sym}0</span>
                  <span style={{ fontSize: '0.5625rem', color: '#ef4444', fontWeight: 700 }}>Projected: {Math.min(100, Math.round((prediction.projectedMonthEnd / totalIncome) * 100))}%</span>
                  <span style={{ fontSize: '0.5625rem', color: '#94a3b8' }}>Income {sym}{Math.round(totalIncome).toLocaleString('en-IN')}</span>
                </div>
              </div>
            )}
          </div>

          {/* Savings rate history */}
          <div className="panel" style={{ marginTop: 16 }}>
            <div style={{ padding: '14px 18px 12px', borderBottom: '1px solid var(--border-default)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <ShieldCheck size={14} style={{ color: '#16a34a' }} />
              <span style={{ fontSize: '0.875rem', fontWeight: 700, color: '#1e293b' }}>Savings Rate History</span>
            </div>
            <div style={{ padding: '16px 18px' }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', height: 80 }}>
                {monthHistory.map((m, i) => {
                  const isLatest = i === monthHistory.length - 1;
                  const rate = m.income > 0 ? Math.max(0, m.savingsRate) : 0;
                  const h = rate > 0 ? Math.max(6, Math.round((rate / 100) * 68)) : 4;
                  const color = rate >= 20 ? '#16a34a' : rate > 0 ? '#d97706' : '#e2e8f0';
                  return (
                    <div key={m.label} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                      <div
                        title={`${m.label}: ${rate}% savings rate`}
                        style={{ width: '70%', height: h, background: isLatest ? color : `${color}80`, borderRadius: '3px 3px 0 0', transition: 'height 0.4s ease', cursor: 'help', position: 'relative' }}
                      />
                      <div style={{ fontSize: '0.625rem', fontWeight: isLatest ? 700 : 400, color: isLatest ? '#6366f1' : '#94a3b8', whiteSpace: 'nowrap' }}>{m.label}</div>
                      <div style={{ fontSize: '0.5625rem', fontWeight: 700, color }}>{rate}%</div>
                    </div>
                  );
                })}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8 }}>
                <div style={{ flex: 1, height: 1, borderTop: '1px dashed #e2e8f0' }} />
                <span style={{ fontSize: '0.625rem', fontWeight: 700, color: '#16a34a', whiteSpace: 'nowrap' }}>20% target</span>
                <div style={{ flex: 1, height: 1, borderTop: '1px dashed #e2e8f0' }} />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          TAB: BEHAVIOR
      ══════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'behavior' && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>

            {/* Weekday vs Weekend */}
            <div className="panel">
              <div style={{ padding: '14px 18px 12px', borderBottom: '1px solid var(--border-default)', display: 'flex', alignItems: 'center', gap: 8 }}>
                <Clock size={14} style={{ color: '#6366f1' }} />
                <span style={{ fontSize: '0.875rem', fontWeight: 700, color: '#1e293b' }}>Weekday vs Weekend</span>
              </div>
              <div style={{ padding: '16px 18px' }}>
                {behaviorProfile.weekdayVsWeekend.weekday + behaviorProfile.weekdayVsWeekend.weekend === 0 ? (
                  <p style={{ fontSize: '0.8125rem', color: '#94a3b8' }}>No data yet</p>
                ) : (
                  <>
                    <div style={{ display: 'flex', gap: 12, marginBottom: 14 }}>
                      {[
                        { label: 'Weekdays', value: behaviorProfile.weekdayVsWeekend.weekday, pct: behaviorProfile.weekdayVsWeekend.weekdayPct, color: '#6366f1' },
                        { label: 'Weekends', value: behaviorProfile.weekdayVsWeekend.weekend, pct: 100 - behaviorProfile.weekdayVsWeekend.weekdayPct, color: '#8b5cf6' },
                      ].map(item => (
                        <div key={item.label} style={{ flex: 1, padding: '12px', borderRadius: 10, background: `${item.color}0a`, border: `1px solid ${item.color}22` }}>
                          <div style={{ fontSize: '0.6875rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>{item.label}</div>
                          <div style={{ fontSize: '1rem', fontWeight: 800, color: item.color, fontVariantNumeric: 'tabular-nums' }}>{sym}{Math.round(item.value).toLocaleString('en-IN')}</div>
                          <div style={{ fontSize: '0.6875rem', color: '#94a3b8', marginTop: 2 }}>{item.pct}% of spend</div>
                        </div>
                      ))}
                    </div>
                    <div style={{ height: 8, background: '#f1f5f9', borderRadius: 99, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${behaviorProfile.weekdayVsWeekend.weekdayPct}%`, background: 'linear-gradient(90deg, #6366f1, #8b5cf6)', borderRadius: 99 }} />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                      <span style={{ fontSize: '0.5625rem', color: '#6366f1', fontWeight: 700 }}>Weekday {behaviorProfile.weekdayVsWeekend.weekdayPct}%</span>
                      <span style={{ fontSize: '0.5625rem', color: '#8b5cf6', fontWeight: 700 }}>Weekend {100 - behaviorProfile.weekdayVsWeekend.weekdayPct}%</span>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Transaction profile */}
            <div className="panel">
              <div style={{ padding: '14px 18px 12px', borderBottom: '1px solid var(--border-default)', display: 'flex', alignItems: 'center', gap: 8 }}>
                <Zap size={14} style={{ color: '#d97706' }} />
                <span style={{ fontSize: '0.875rem', fontWeight: 700, color: '#1e293b' }}>Transaction Profile</span>
              </div>
              <div style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                {[
                  { label: 'Avg Transaction Size', value: `${sym}${behaviorProfile.avgTransactionSize.toLocaleString('en-IN')}`, sub: 'per expense' },
                  { label: 'Small Txns Ratio', value: `${behaviorProfile.impulseBuyRatio}%`, sub: behaviorProfile.impulseBuyRatio > 40 ? 'Many small purchases' : 'Controlled impulse spending' },
                  { label: 'Total Transactions', value: `${periodExpenses.length}`, sub: `${Math.round(periodExpenses.length / 30 * 7)} per week avg` },
                  { label: 'Category Dependency', value: '', sub: behaviorProfile.categoryDependency },
                ].map(item => (
                  <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #f8fafc' }}>
                    <span style={{ fontSize: '0.8125rem', color: '#64748b', fontWeight: 500 }}>{item.label}</span>
                    <div style={{ textAlign: 'right' }}>
                      {item.value && <div style={{ fontSize: '0.875rem', fontWeight: 800, color: '#1e293b', fontVariantNumeric: 'tabular-nums' }}>{item.value}</div>}
                      <div style={{ fontSize: '0.6875rem', color: '#94a3b8' }}>{item.sub}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Big ticket items */}
            <div className="panel">
              <div style={{ padding: '14px 18px 12px', borderBottom: '1px solid var(--border-default)', display: 'flex', alignItems: 'center', gap: 8 }}>
                <ArrowUpRight size={14} style={{ color: '#ef4444' }} />
                <span style={{ fontSize: '0.875rem', fontWeight: 700, color: '#1e293b' }}>Biggest Purchases</span>
              </div>
              <div style={{ padding: '8px 0 4px' }}>
                {behaviorProfile.bigTicketItems.length === 0 ? (
                  <p style={{ padding: '12px 18px', fontSize: '0.8125rem', color: '#94a3b8' }}>No expenses this period</p>
                ) : behaviorProfile.bigTicketItems.map((exp, i) => {
                  const cat = categories.find(c => c.id === exp.category);
                  return (
                    <div key={exp.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 18px', borderBottom: '1px solid #f8fafc' }}>
                      <span style={{ width: 20, height: 20, borderRadius: '50%', background: i === 0 ? '#fef2f2' : '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.625rem', fontWeight: 900, color: i === 0 ? '#ef4444' : '#94a3b8', flexShrink: 0 }}>
                        {i + 1}
                      </span>
                      <div style={{ width: 28, height: 28, borderRadius: 7, background: cat ? `${cat.color}18` : '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, flexShrink: 0 }}>
                        {cat?.icon ?? '📦'}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#1e293b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{exp.description}</div>
                        <div style={{ fontSize: '0.6875rem', color: '#94a3b8', marginTop: 1 }}>{cat?.name ?? '—'} · {new Date(exp.date + 'T12:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</div>
                      </div>
                      <div style={{ fontSize: '0.9375rem', fontWeight: 800, color: '#ef4444', fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>
                        {sym}{exp.amount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

          </div>
        </div>
      )}

      </>)}
      {/* ══════════════════════════════════════════════════════════════════════
          END MONTHLY VIEW
      ══════════════════════════════════════════════════════════════════════ */}

      {/* ══════════════════════════════════════════════════════════════════════
          YEARLY VIEW
      ══════════════════════════════════════════════════════════════════════ */}
      {scope === 'yearly' && (<>

      {/* ── YEARLY KPI STRIP ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, marginBottom: 20 }}>
        {[
          { label: 'Total Spent', value: `${sym}${Math.round(yearSummary.totalExpenses).toLocaleString('en-IN')}`, sub: `${yearSummary.txnCount} txns · ${yearSummary.activeMonths} months`, color: '#ef4444', Icon: TrendingUp },
          { label: 'Total Income', value: yearSummary.totalIncome > 0 ? `${sym}${Math.round(yearSummary.totalIncome).toLocaleString('en-IN')}` : '—', sub: `${yearlyYear} total`, color: '#16a34a', Icon: ArrowUpRight },
          { label: 'Net Savings', value: yearSummary.totalIncome > 0 ? `${sym}${Math.round(yearSummary.totalSavings).toLocaleString('en-IN')}` : '—', sub: yearSummary.totalSavings >= 0 ? 'Surplus' : 'Deficit', color: yearSummary.totalSavings >= 0 ? '#16a34a' : '#ef4444', Icon: ShieldCheck },
          { label: 'Savings Rate', value: yearSummary.totalIncome > 0 ? `${yearlySavingsRate}%` : '—', sub: yearlySavingsRate >= 20 ? 'Healthy' : yearlySavingsRate > 0 ? 'Below target' : '—', color: yearlySavingsRate >= 20 ? '#16a34a' : yearlySavingsRate > 0 ? '#d97706' : '#94a3b8', Icon: Target },
          { label: 'Avg Monthly', value: `${sym}${yearSummary.avgMonthlyExpenses.toLocaleString('en-IN')}`, sub: 'per active month', color: '#6366f1', Icon: Activity },
        ].map(kpi => (
          <div key={kpi.label} style={{
            padding: '16px 18px', borderRadius: 16,
            background: '#fff', border: '1.5px solid #e8ecf0',
            transition: 'all 0.2s ease',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontSize: '0.625rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.07em' }}>{kpi.label}</span>
              <div style={{ width: 26, height: 26, borderRadius: 7, background: `${kpi.color}0d`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <kpi.Icon size={12} color={kpi.color} />
              </div>
            </div>
            <div style={{ fontSize: '1.125rem', fontWeight: 800, color: kpi.color, fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>{kpi.value}</div>
            <div style={{ fontSize: '0.6875rem', color: '#94a3b8', marginTop: 4 }}>{kpi.sub}</div>
          </div>
        ))}
      </div>

      {/* ── YEARLY AI NARRATIVE ── */}
      <div className="ai-narrative-card" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <div className="ai-icon-glow" style={{ width: 28, height: 28, borderRadius: 8, flexShrink: 0 }}><CalendarRange size={13} /></div>
          <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#1e293b' }}>{yearlyYear} Year in Review</span>
          <span style={{ marginLeft: 'auto', fontSize: '0.625rem', color: '#16a34a', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#16a34a', display: 'inline-block', animation: 'aiPulse 2s infinite' }} />
            Live
          </span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {yearlyNarrative.map((line, i) => (
            <p key={i} style={{ fontSize: '0.875rem', color: i === 0 ? '#1e293b' : '#475569', lineHeight: 1.6, fontWeight: i === 0 ? 600 : 400 }}>
              {line}
            </p>
          ))}
        </div>
      </div>

      {/* ── YEARLY TAB NAV ── */}
      <div className="ws-tab-bar" style={{ marginBottom: 16 }}>
        {([
          { key: 'insights',  label: 'Yearly Insights', Icon: Zap },
          { key: 'trends',    label: 'Monthly Breakdown', Icon: BarChart2 },
        ] as { key: typeof activeTab; label: string; Icon: React.ElementType }[]).map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`ws-tab${activeTab === tab.key ? ' active' : ''}`}
            style={{ display: 'flex', alignItems: 'center', gap: 5 }}
          >
            <tab.Icon size={12} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── TAB: YEARLY INSIGHTS ── */}
      {activeTab === 'insights' && (
        <div>
          <div className="ai-insights-grid">
            {yearlyVisibleInsights.map(card => (
              <InsightCardFull key={card.id} card={card} onOpenModal={setModalCard} />
            ))}
          </div>
          {yearlyInsightCards.length > 4 && (
            <button
              onClick={() => setShowAllInsights(v => !v)}
              style={{ display: 'flex', alignItems: 'center', gap: 6, margin: '8px auto 0', padding: '7px 18px', borderRadius: 99, fontSize: '0.8125rem', fontWeight: 600, cursor: 'pointer', background: 'var(--brand-50)', color: 'var(--brand-600)', border: '1px solid var(--brand-200)', fontFamily: 'inherit' }}
            >
              {showAllInsights ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
              {showAllInsights ? 'Show less' : `Show ${yearlyInsightCards.length - 4} more`}
            </button>
          )}
        </div>
      )}

      {/* ── TAB: MONTHLY BREAKDOWN (12-month chart + category table) ── */}
      {activeTab === 'trends' && (
        <div>
          {/* 12-month bar chart */}
          <div className="panel" style={{ marginBottom: 16 }}>
            <div style={{ padding: '14px 18px 12px', borderBottom: '1px solid var(--border-default)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <BarChart2 size={14} style={{ color: '#6366f1' }} />
              <span style={{ fontSize: '0.875rem', fontWeight: 700, color: '#1e293b' }}>{yearlyYear} — Monthly Spending vs Income</span>
            </div>
            <div style={{ padding: '16px 18px 8px' }}>
              <div style={{ display: 'flex', gap: 16, marginBottom: 12 }}>
                {[{ label: 'Expenses', color: '#ef4444' }, { label: 'Income', color: '#16a34a' }].map(l => (
                  <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.6875rem', fontWeight: 600, color: '#64748b' }}>
                    <span style={{ width: 10, height: 10, borderRadius: 2, background: l.color, display: 'inline-block' }} />
                    {l.label}
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 6, alignItems: 'flex-end', height: 120 }}>
                {yearSummary.months.map((m, i) => {
                  const maxVal = Math.max(...yearSummary.months.map(h => Math.max(h.expenses, h.income)), 1);
                  const expH = m.expenses > 0 ? Math.max(6, Math.round((m.expenses / maxVal) * 105)) : 3;
                  const incH = m.income > 0 ? Math.max(6, Math.round((m.income / maxVal) * 105)) : 3;
                  const hasData = m.txnCount > 0;
                  return (
                    <div key={m.label} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
                      <div style={{ display: 'flex', gap: 2, alignItems: 'flex-end', width: '100%', justifyContent: 'center' }}>
                        <div
                          title={`Expenses: ${sym}${Math.round(m.expenses).toLocaleString('en-IN')}`}
                          style={{ width: '42%', height: expH, background: hasData ? '#ef4444' : '#f1f5f9', borderRadius: '3px 3px 0 0', transition: 'height 0.4s ease', cursor: 'help' }}
                        />
                        <div
                          title={`Income: ${sym}${Math.round(m.income).toLocaleString('en-IN')}`}
                          style={{ width: '42%', height: incH, background: hasData ? '#16a34a' : '#f1f5f9', borderRadius: '3px 3px 0 0', transition: 'height 0.4s ease', cursor: 'help' }}
                        />
                      </div>
                      <div style={{ fontSize: '0.5625rem', fontWeight: hasData ? 600 : 400, color: hasData ? '#1e293b' : '#cbd5e1', whiteSpace: 'nowrap' }}>{MONTH_NAMES[i]}</div>
                      {m.savings !== 0 && hasData && (
                        <div style={{ fontSize: '0.5rem', fontWeight: 700, color: m.savings >= 0 ? '#16a34a' : '#ef4444' }}>
                          {m.savings >= 0 ? '+' : '−'}{sym}{(Math.abs(m.savings)/1000).toFixed(0)}k
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Savings rate across 12 months */}
          <div className="panel" style={{ marginBottom: 16 }}>
            <div style={{ padding: '14px 18px 12px', borderBottom: '1px solid var(--border-default)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <ShieldCheck size={14} style={{ color: '#16a34a' }} />
              <span style={{ fontSize: '0.875rem', fontWeight: 700, color: '#1e293b' }}>{yearlyYear} Savings Rate by Month</span>
            </div>
            <div style={{ padding: '16px 18px' }}>
              <div style={{ display: 'flex', gap: 6, alignItems: 'flex-end', height: 80 }}>
                {yearSummary.months.map((m, i) => {
                  const rate = m.income > 0 ? Math.max(0, m.savingsRate) : 0;
                  const h = rate > 0 ? Math.max(6, Math.round((rate / 100) * 68)) : 4;
                  const color = rate >= 20 ? '#16a34a' : rate > 0 ? '#d97706' : '#e2e8f0';
                  const hasData = m.txnCount > 0;
                  return (
                    <div key={m.label} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
                      <div
                        title={`${MONTH_NAMES[i]}: ${rate}% savings rate`}
                        style={{ width: '70%', height: h, background: hasData ? color : '#f1f5f9', borderRadius: '3px 3px 0 0', transition: 'height 0.4s ease', cursor: 'help' }}
                      />
                      <div style={{ fontSize: '0.5625rem', fontWeight: hasData ? 600 : 400, color: hasData ? '#1e293b' : '#cbd5e1' }}>{MONTH_NAMES[i]}</div>
                      {hasData && <div style={{ fontSize: '0.5rem', fontWeight: 700, color }}>{rate}%</div>}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Yearly category breakdown */}
          <div className="panel" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '14px 18px 12px', background: 'var(--bg-subtle)', borderBottom: '1px solid var(--border-default)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <TrendingUp size={14} style={{ color: '#6366f1' }} />
              <span style={{ fontSize: '0.875rem', fontWeight: 700, color: '#1e293b' }}>Category Breakdown — {yearlyYear} vs {yearlyYear - 1}</span>
            </div>
            {yearlyCatTrends.length === 0 ? (
              <div style={{ padding: '32px', textAlign: 'center', color: '#94a3b8', fontSize: '0.875rem' }}>No category data for {yearlyYear}</div>
            ) : (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 90px 90px 80px 100px', padding: '8px 18px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                  {['Category', String(yearlyYear), String(yearlyYear - 1), 'Change', 'Share'].map(h => (
                    <span key={h} style={{ fontSize: '0.625rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.07em', textAlign: h === 'Change' || h === 'Share' ? 'right' : 'left' }}>{h}</span>
                  ))}
                </div>
                {yearlyCatTrends.map(t => (
                  <div key={t.catId} style={{ display: 'grid', gridTemplateColumns: '1fr 90px 90px 80px 100px', padding: '10px 18px', borderBottom: '1px solid #f1f5f9', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 28, height: 28, borderRadius: 7, background: `${t.color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, flexShrink: 0 }}>{t.icon}</div>
                      <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#1e293b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.name}</span>
                    </div>
                    <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#1e293b', fontVariantNumeric: 'tabular-nums' }}>{sym}{Math.round(t.currSpent).toLocaleString('en-IN')}</span>
                    <span style={{ fontSize: '0.8125rem', color: '#64748b', fontVariantNumeric: 'tabular-nums' }}>{t.prevSpent > 0 ? `${sym}${Math.round(t.prevSpent).toLocaleString('en-IN')}` : '—'}</span>
                    <div style={{ textAlign: 'right' }}>
                      {t.prevSpent > 0 ? (
                        <span style={{ fontSize: '0.75rem', fontWeight: 800, color: t.changePct > 0 ? '#ef4444' : t.changePct < 0 ? '#16a34a' : '#6366f1', display: 'inline-flex', alignItems: 'center', gap: 2 }}>
                          {t.changePct > 0 ? <ArrowUpRight size={11}/> : t.changePct < 0 ? <ArrowDownRight size={11}/> : <Minus size={11}/>}
                          {t.changePct > 0 ? '+' : ''}{t.changePct}%
                        </span>
                      ) : <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>New</span>}
                    </div>
                    <div style={{ paddingLeft: 8 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <div style={{ flex: 1, height: 4, background: '#f1f5f9', borderRadius: 99, overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${t.pctOfTotal}%`, background: t.color, borderRadius: 99 }} />
                        </div>
                        <span style={{ fontSize: '0.6875rem', fontWeight: 700, color: '#64748b', minWidth: 28, textAlign: 'right' }}>{t.pctOfTotal}%</span>
                      </div>
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>

          {/* Best / worst month highlight */}
          {(yearSummary.bestMonth || yearSummary.worstMonth) && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 16 }}>
              {yearSummary.bestMonth && (
                <div style={{ padding: '16px 18px', borderRadius: 14, background: '#f0fdf4', border: '1.5px solid #bbf7d0' }}>
                  <div style={{ fontSize: '0.625rem', fontWeight: 700, color: '#16a34a', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 }}>Best Month</div>
                  <div style={{ fontSize: '1rem', fontWeight: 800, color: '#16a34a' }}>{yearSummary.bestMonth.label}</div>
                  <div style={{ fontSize: '0.8125rem', color: '#475569', marginTop: 2 }}>
                    {yearSummary.bestMonth.savingsRate}% savings · {sym}{Math.round(yearSummary.bestMonth.savings).toLocaleString('en-IN')} saved
                  </div>
                </div>
              )}
              {yearSummary.worstMonth && (
                <div style={{ padding: '16px 18px', borderRadius: 14, background: '#fef2f2', border: '1.5px solid #fecaca' }}>
                  <div style={{ fontSize: '0.625rem', fontWeight: 700, color: '#ef4444', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 }}>Highest Spend Month</div>
                  <div style={{ fontSize: '1rem', fontWeight: 800, color: '#ef4444' }}>{yearSummary.worstMonth.label}</div>
                  <div style={{ fontSize: '0.8125rem', color: '#475569', marginTop: 2 }}>
                    {yearSummary.worstMonth.savingsRate}% savings · {sym}{Math.round(yearSummary.worstMonth.expenses).toLocaleString('en-IN')} spent
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      </>)}
      {/* ══════════════════════════════════════════════════════════════════════
          END YEARLY VIEW
      ══════════════════════════════════════════════════════════════════════ */}

      {/* ══════════════════════════════════════════════════════════════════════
          INSIGHT DETAIL MODAL
      ══════════════════════════════════════════════════════════════════════ */}
      {modalCard && <InsightModal card={modalCard} onClose={() => setModalCard(null)} />}

    </div>
  );
}
