'use client';

import { useMemo, useState, useRef, useCallback, useEffect } from 'react';
import {
  Brain, Sparkles, TrendingUp, TrendingDown, AlertTriangle,
  CheckCircle, Info, Zap, MessageCircle, Send, ChevronDown,
  ChevronUp, Target, Activity, BarChart2, RefreshCw,
  ArrowUpRight, ArrowDownRight, Minus, ShieldCheck, X, Clock,
} from 'lucide-react';
import { useBudgetStore } from '@/store/budgetStore';
import { currencySymbol, formatCurrencyShort } from '@/utils/currency';
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

function InsightCardFull({ card }: { card: AIInsightCard }) {
  const [expanded, setExpanded] = useState(false);
  const cfg  = SEVERITY_CFG[card.severity];
  const Icon = SEVERITY_ICON[card.severity];

  return (
    <div
      className="ai-insight-card"
      style={{ background: cfg.bg, borderColor: cfg.border, borderLeftColor: cfg.iconColor }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <div style={{ width: 34, height: 34, borderRadius: 10, background: cfg.iconBg, color: cfg.iconColor, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Icon size={15} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
            <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#0f172a' }}>{card.title}</span>
            {card.metric && <MetricPill metric={card.metric} direction={card.metricDirection} />}
            <span style={{ marginLeft: 'auto', flexShrink: 0 }}><ConfidenceDot confidence={card.confidence} /></span>
          </div>
          <p style={{ fontSize: '0.8125rem', color: '#475569', lineHeight: 1.5, margin: 0 }}>{card.summary}</p>

          {expanded && (
            <p style={{ fontSize: '0.8125rem', color: '#334155', lineHeight: 1.6, margin: '8px 0 0', padding: '10px 12px', background: 'rgba(255,255,255,0.6)', borderRadius: 8, border: `1px solid ${cfg.border}` }}>
              {card.detail}
            </p>
          )}
        </div>
        <button
          onClick={() => setExpanded(v => !v)}
          style={{ flexShrink: 0, background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: 4, borderRadius: 6, display: 'flex', alignItems: 'center' }}
        >
          {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
      </div>

      {card.actionLabel && expanded && (
        <div style={{ marginTop: 10, paddingLeft: 46 }}>
          <span style={{ fontSize: '0.6875rem', fontWeight: 700, color: cfg.iconColor, padding: '3px 10px', borderRadius: 99, background: cfg.iconBg, border: `1px solid ${cfg.border}`, cursor: 'default' }}>
            → {card.actionLabel}
          </span>
        </div>
      )}
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
  const [showBehavior,     setShowBehavior]     = useState(false);
  const [showCityComp,     setShowCityComp]     = useState(false);
  const [showHealthDrilldown, setShowHealthDrilldown] = useState(false);
  const [activeTab,        setActiveTab]        = useState<'insights' | 'trends' | 'forecast' | 'behavior'>('insights');

  // ── Computed data ──────────────────────────────────────────────────────────

  const periodExpenses = useMemo(() =>
    expenses.filter(e => {
      const d = new Date(e.date);
      return d >= start && d <= end &&
        (selectedCity === 'Both' || !e.city || e.city === selectedCity) &&
        (excludedCategoryIds.length === 0 || !excludedCategoryIds.includes(e.category));
    }),
    [expenses, start, end, selectedCity, excludedCategoryIds]);

  const periodIncome = useMemo(() =>
    income.filter(i => { const d = new Date(i.date); return d >= start && d <= end; }),
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

  const maxExpHistory = Math.max(...monthHistory.map(m => m.expenses), 1);
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
            <span className="ai-icon-glow"><Sparkles size={18} /></span>
            AI Insights
            <span style={{ fontSize: '0.6875rem', fontWeight: 700, padding: '3px 10px', borderRadius: 99, background: 'var(--brand-50)', color: 'var(--brand-600)', border: '1px solid var(--brand-200)' }}>
              {selectedMonthLabel}
            </span>
          </h1>
          <p className="ws-subtitle">Intelligent analysis of your real financial data · Updated live</p>
        </div>
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

      {/* ══════════════════════════════════════════════════════════════════════
          HEALTH SCORE + NARRATIVE SUMMARY (top strip)
      ══════════════════════════════════════════════════════════════════════ */}
      <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 16, marginBottom: 20 }}>

        {/* Health Score Card */}
        <div
          className="ai-health-card"
          onClick={() => setShowHealthDrilldown(v => !v)}
          style={{ borderColor: `${healthScore.color}44`, cursor: 'pointer' }}
        >
          <div style={{ textAlign: 'center' }}>
            <div className="ai-score-ring" style={{ '--score-color': healthScore.color, '--score-pct': `${healthScore.total}%` } as React.CSSProperties}>
              <span style={{ fontSize: '1.5rem', fontWeight: 900, color: healthScore.color, lineHeight: 1 }}>{healthScore.total}</span>
              <span style={{ fontSize: '0.625rem', color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>/ 100</span>
            </div>
            <div style={{ marginTop: 8, fontSize: '0.8125rem', fontWeight: 800, color: healthScore.color }}>{healthScore.grade}</div>
            <div style={{ fontSize: '0.6875rem', color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{healthScore.label}</div>
            <div style={{ fontSize: '0.625rem', color: '#94a3b8', marginTop: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 3 }}>
              {showHealthDrilldown ? <ChevronUp size={10}/> : <ChevronDown size={10}/>} details
            </div>
          </div>

          {/* Drilldown */}
          {showHealthDrilldown && (
            <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px dashed #e2e8f0' }}>
              {[
                { label: 'Savings',    score: healthScore.breakdown.savings,     max: 25 },
                { label: 'Discipline', score: healthScore.breakdown.discipline,   max: 25 },
                { label: 'Stability',  score: healthScore.breakdown.volatility,   max: 25 },
                { label: 'Recurring',  score: healthScore.breakdown.consistency,  max: 25 },
              ].map(row => (
                <div key={row.label} style={{ marginBottom: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                    <span style={{ fontSize: '0.6875rem', fontWeight: 600, color: '#475569' }}>{row.label}</span>
                    <span style={{ fontSize: '0.6875rem', fontWeight: 800, color: healthScore.color }}>{row.score}/{row.max}</span>
                  </div>
                  <div style={{ height: 4, background: '#f1f5f9', borderRadius: 99, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${(row.score / row.max) * 100}%`, background: healthScore.color, borderRadius: 99, transition: 'width 0.6s ease' }} />
                  </div>
                </div>
              ))}
              <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 4 }}>
                {healthScore.explanation.map((line, i) => (
                  <div key={i} style={{ fontSize: '0.6875rem', color: '#64748b', display: 'flex', gap: 5 }}>
                    <span style={{ color: healthScore.color, flexShrink: 0 }}>•</span>
                    <span>{line}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Narrative summary */}
        <div className="ai-narrative-card">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <div className="ai-icon-glow" style={{ width: 28, height: 28, borderRadius: 8, flexShrink: 0 }}><Brain size={13} /></div>
            <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#1e293b' }}>AI Financial Summary</span>
            <span style={{ marginLeft: 'auto', fontSize: '0.625rem', color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', display: 'flex', alignItems: 'center', gap: 3 }}>
              <RefreshCw size={9} /> Live
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {narrativeLines.map((line, i) => (
              <p key={i} style={{ fontSize: '0.875rem', color: i === 0 ? '#1e293b' : '#475569', lineHeight: 1.6, fontWeight: i === 0 ? 600 : 400 }}>
                {line}
              </p>
            ))}
          </div>

          {/* KPI strip inside narrative */}
          <div style={{ display: 'flex', gap: 10, marginTop: 14, flexWrap: 'wrap' }}>
            {[
              { label: 'Spent', value: `${sym}${Math.round(totalExpenses).toLocaleString('en-IN')}`, color: '#ef4444' },
              { label: 'Income', value: totalIncome > 0 ? `${sym}${Math.round(totalIncome).toLocaleString('en-IN')}` : '—', color: '#16a34a' },
              { label: 'Savings Rate', value: totalIncome > 0 ? `${savingsRate}%` : '—', color: savingsRate >= 20 ? '#16a34a' : savingsRate > 0 ? '#d97706' : '#ef4444' },
              { label: 'Daily Burn', value: `${sym}${Math.round(prediction.dailyBurnRate).toLocaleString('en-IN')}`, color: '#6366f1' },
            ].map(kpi => (
              <div key={kpi.label} style={{ padding: '8px 14px', borderRadius: 10, background: 'rgba(255,255,255,0.7)', border: '1px solid #e2e8f0', minWidth: 90 }}>
                <div style={{ fontSize: '0.625rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 2 }}>{kpi.label}</div>
                <div style={{ fontSize: '1rem', fontWeight: 800, color: kpi.color, fontVariantNumeric: 'tabular-nums' }}>{kpi.value}</div>
              </div>
            ))}
          </div>
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
              <InsightCardFull key={card.id} card={card} />
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
                  <span style={{ fontSize: '0.5625rem', color: '#94a3b8' }}>₹0</span>
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

    </div>
  );
}
