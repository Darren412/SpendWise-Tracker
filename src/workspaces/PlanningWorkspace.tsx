'use client';

import { useState } from 'react';
import {
  Target, PiggyBank, Bell, Plus, X, AlertTriangle, XCircle, CheckCircle2, Sparkles,
} from 'lucide-react';
import { useBudgetStore } from '@/store/budgetStore';
import { SavingsGoal } from '@/types';
import { sortGoals } from '@/lib/goals';
import { validateThresholds } from '@/lib/budgetAlerts';
import { budgetTrackedSpend } from '@/lib/trends';
import { formatCurrency } from '@/utils/currency';
import GoalCard from '@/components/goals/GoalCard';
import GoalForm from '@/components/goals/GoalForm';
import SavingsTab from '@/components/savings/SavingsTab';

type Tab = 'save' | 'goals' | 'budgets';

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '8px 11px', borderRadius: 'var(--r-sm)',
  border: '1.5px solid var(--border-default)', background: 'var(--bg-surface)',
  color: 'var(--text-900)', fontSize: '0.8125rem', fontFamily: 'inherit', outline: 'none',
};

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: '0.6875rem', fontWeight: 700, color: 'var(--text-400)',
  textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 5,
};

const sectionTitle: React.CSSProperties = {
  fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-400)',
  textTransform: 'uppercase', letterSpacing: '0.09em', marginBottom: 12,
};

export default function PlanningWorkspace({ initialTab }: { initialTab?: Tab }) {
  const {
    goals, addGoal, updateGoal, deleteGoal,
    expenses, categories,
    selectedMonth, selectedYear,
    budgetCategoryIds, setMonthlyBudget, getMonthlyBudget, setBudgetCategoryIds,
    categoryBudgets, setCategoryBudget,
    alertThresholds, setAlertThresholds,
    alertsEnabled, setAlertsEnabled,
    currency,
  } = useBudgetStore();

  const [tab, setTab] = useState<Tab>(initialTab ?? 'save');
  const [showArchived, setShowArchived] = useState(false);
  const [formGoal, setFormGoal] = useState<'new' | SavingsGoal | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<SavingsGoal | null>(null);

  // Budgets tab local state
  const [overallInput, setOverallInput] = useState<string | null>(null); // null = not editing
  const [warnInput, setWarnInput] = useState<string | null>(null);
  const [exceededInput, setExceededInput] = useState<string | null>(null);
  const [thresholdError, setThresholdError] = useState('');

  const visibleGoals = sortGoals(goals.filter(g => showArchived || !g.archived));
  const activeCount = goals.filter(g => !g.archived).length;

  // ── Budget status data (same period set as Overview / useBudgetAlerts) ────
  const periodExpenses = expenses.filter(e => e.month === selectedMonth && e.year === selectedYear);
  const overallBudget = getMonthlyBudget(selectedMonth, selectedYear);
  const overallSpent = budgetTrackedSpend(periodExpenses, budgetCategoryIds);
  const expenseCategories = categories.filter(c => c.type !== 'income');

  const statusRows = [
    ...(overallBudget > 0 ? [{
      id: 'overall', name: 'Overall budget', budget: overallBudget, spent: overallSpent,
    }] : []),
    ...expenseCategories
      .filter(c => (categoryBudgets[c.id] ?? 0) > 0)
      .map(c => ({
        id: c.id, name: `${c.icon} ${c.name}`, budget: categoryBudgets[c.id],
        spent: periodExpenses.filter(e => e.category === c.id).reduce((s, e) => s + e.amount, 0),
      })),
  ];

  const statusOf = (spent: number, budget: number) => {
    const pct = (spent / budget) * 100;
    return pct >= alertThresholds.exceeded ? 'exceeded' : pct >= alertThresholds.warning ? 'warning' : 'ok';
  };
  const STATUS_UI = {
    ok:       { label: 'OK',       color: 'var(--green-600)', bg: 'var(--green-50)', Icon: CheckCircle2 },
    warning:  { label: 'Warning',  color: 'var(--amber-600)', bg: 'var(--amber-50)', Icon: AlertTriangle },
    exceeded: { label: 'Exceeded', color: 'var(--red-500)',   bg: 'var(--red-50)',   Icon: XCircle },
  } as const;

  const saveOverall = () => {
    if (overallInput === null) return;
    const n = parseFloat(overallInput);
    if (Number.isFinite(n)) setMonthlyBudget(selectedMonth, selectedYear, n);
    setOverallInput(null);
  };

  const saveThreshold = (field: 'warning' | 'exceeded') => {
    const raw = field === 'warning' ? warnInput : exceededInput;
    const setter = field === 'warning' ? setWarnInput : setExceededInput;
    if (raw === null) return;
    const n = parseInt(raw, 10);
    const next = { ...alertThresholds, [field]: n };
    const err = Number.isFinite(n) ? validateThresholds(next) : 'Thresholds must be whole numbers.';
    setThresholdError(err ?? '');
    if (!err) setAlertThresholds(next);
    setter(null);
  };

  const toggleBudgetCategory = (id: string) => {
    setBudgetCategoryIds(
      budgetCategoryIds.includes(id)
        ? budgetCategoryIds.filter(x => x !== id)
        : [...budgetCategoryIds, id]
    );
  };

  return (
    <div>
      {/* ── Header ── */}
      <div className="ws-header">
        <div>
          <h1 className="ws-title">Planning</h1>
          <p className="ws-subtitle">Spend optimization, savings goals, budgets and alerts</p>
        </div>
        <div className="ws-tab-bar" role="group" aria-label="Planning sections">
          {([
            { id: 'save', label: 'Where Can I Save?', Icon: Sparkles },
            { id: 'goals', label: 'Savings Goals', Icon: PiggyBank },
            { id: 'budgets', label: 'Budgets & Alerts', Icon: Bell },
          ] as const).map(({ id, label, Icon }) => (
            <button key={id} className={`ws-tab${tab === id ? ' active' : ''}`} onClick={() => setTab(id)} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <Icon size={13} /> {label}
            </button>
          ))}
        </div>
      </div>

      {/* ══════════ TAB: WHERE CAN I SAVE? ══════════ */}
      {tab === 'save' && <SavingsTab />}

      {/* ══════════ TAB: SAVINGS GOALS ══════════ */}
      {tab === 'goals' && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-400)' }}>
              {activeCount} active goal{activeCount !== 1 ? 's' : ''}
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.78rem', color: 'var(--text-500)', cursor: 'pointer' }}>
                <input type="checkbox" checked={showArchived} onChange={e => setShowArchived(e.target.checked)} style={{ accentColor: 'var(--brand-600)' }} />
                Show archived
              </label>
              <button
                onClick={() => setFormGoal('new')}
                className="ws-cta-btn"
                style={{ background: 'var(--brand-600)', color: '#fff', borderColor: 'var(--brand-700)' }}
              >
                <Plus size={13} /> New goal
              </button>
            </div>
          </div>

          {visibleGoals.length === 0 ? (
            <div className="panel" style={{ padding: '48px 24px', textAlign: 'center' }}>
              <div style={{ fontSize: 36, marginBottom: 12 }}>🎯</div>
              <div style={{ fontSize: '0.9375rem', fontWeight: 700, color: 'var(--text-700)', marginBottom: 6 }}>
                {goals.length === 0 ? 'No savings goals yet' : 'Nothing to show'}
              </div>
              <div style={{ fontSize: '0.8125rem', color: 'var(--text-400)', marginBottom: 18 }}>
                {goals.length === 0
                  ? 'Set a target — a trip, an emergency fund, a new gadget — and track every contribution.'
                  : 'Try enabling "Show archived" to see archived goals.'}
              </div>
              {goals.length === 0 && (
                <button
                  onClick={() => setFormGoal('new')}
                  style={{
                    padding: '10px 22px', borderRadius: 'var(--r-md)', border: 'none', cursor: 'pointer',
                    background: 'var(--brand-600)', color: '#fff', fontSize: '0.875rem', fontWeight: 700, fontFamily: 'inherit',
                  }}
                >
                  Create your first goal
                </button>
              )}
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
              {visibleGoals.map(g => (
                <GoalCard key={g.id} goal={g} onEdit={() => setFormGoal(g)} onDelete={() => setDeleteTarget(g)} />
              ))}
            </div>
          )}
        </>
      )}

      {/* ══════════ TAB: BUDGETS & ALERTS ══════════ */}
      {tab === 'budgets' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16, alignItems: 'start' }}>

          {/* Overall monthly budget */}
          <div className="panel" style={{ padding: '18px 20px' }}>
            <div style={sectionTitle}>Overall monthly budget</div>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-400)', marginTop: -6, marginBottom: 12 }}>
              For the selected toolbar period — also editable on Overview.
            </p>
            <label htmlFor="overall-budget" style={labelStyle}>Budget amount ({currency})</label>
            <input
              id="overall-budget"
              type="number" inputMode="decimal" min={0} step="0.01"
              value={overallInput ?? (overallBudget > 0 ? String(overallBudget) : '')}
              onChange={e => setOverallInput(e.target.value)}
              onBlur={saveOverall}
              onKeyDown={e => { if (e.key === 'Enter') saveOverall(); }}
              placeholder="e.g. 30000 (0 removes)"
              style={inputStyle}
            />
            <div style={{ marginTop: 14 }}>
              <div style={labelStyle}>Tracked categories</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {expenseCategories.map(c => {
                  const active = budgetCategoryIds.includes(c.id);
                  return (
                    <button
                      key={c.id}
                      onClick={() => toggleBudgetCategory(c.id)}
                      aria-pressed={active}
                      style={{
                        padding: '4px 10px', borderRadius: 99, cursor: 'pointer', fontFamily: 'inherit',
                        fontSize: '0.72rem', fontWeight: 600,
                        background: active ? 'var(--brand-600)' : 'var(--bg-surface)',
                        color: active ? '#fff' : 'var(--text-600)',
                        border: active ? '1px solid var(--brand-600)' : '1px solid var(--border-default)',
                      }}
                    >
                      {c.icon} {c.name}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Per-category budgets */}
          <div className="panel" style={{ padding: '18px 20px' }}>
            <div style={sectionTitle}>Category budgets (monthly)</div>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-400)', marginTop: -6, marginBottom: 12 }}>
              Leave empty or 0 for no budget.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {expenseCategories.map(c => (
                <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ flex: 1, minWidth: 0, fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-700)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {c.icon} {c.name}
                  </span>
                  <input
                    type="number" inputMode="decimal" min={0} step="0.01"
                    defaultValue={categoryBudgets[c.id] ? String(categoryBudgets[c.id]) : ''}
                    key={`${c.id}-${categoryBudgets[c.id] ?? 0}`}
                    placeholder="0"
                    aria-label={`Monthly budget for ${c.name}`}
                    onBlur={e => {
                      const n = parseFloat(e.target.value);
                      if (Number.isFinite(n) || e.target.value === '') {
                        setCategoryBudget(c.id, Number.isFinite(n) ? n : 0);
                      } else {
                        // Invalid text — snap back to the stored value
                        e.target.value = categoryBudgets[c.id] ? String(categoryBudgets[c.id]) : '';
                      }
                    }}
                    onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                    style={{ ...inputStyle, width: 110, textAlign: 'right' }}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Alert settings + status */}
          <div className="panel" style={{ padding: '18px 20px' }}>
            <div style={sectionTitle}>Alerts</div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-700)', cursor: 'pointer', marginBottom: 14 }}>
              <input type="checkbox" checked={alertsEnabled} onChange={e => setAlertsEnabled(e.target.checked)} style={{ accentColor: 'var(--brand-600)', width: 15, height: 15 }} />
              Enable budget alerts
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10, opacity: alertsEnabled ? 1 : 0.5 }}>
              <div>
                <label htmlFor="th-warn" style={labelStyle}>Warning %</label>
                <input
                  id="th-warn" type="number" inputMode="numeric" min={1} max={200} step={1}
                  disabled={!alertsEnabled}
                  value={warnInput ?? String(alertThresholds.warning)}
                  onChange={e => setWarnInput(e.target.value)}
                  onBlur={() => saveThreshold('warning')}
                  onKeyDown={e => { if (e.key === 'Enter') saveThreshold('warning'); }}
                  style={inputStyle}
                />
              </div>
              <div>
                <label htmlFor="th-exceed" style={labelStyle}>Exceeded %</label>
                <input
                  id="th-exceed" type="number" inputMode="numeric" min={1} max={200} step={1}
                  disabled={!alertsEnabled}
                  value={exceededInput ?? String(alertThresholds.exceeded)}
                  onChange={e => setExceededInput(e.target.value)}
                  onBlur={() => saveThreshold('exceeded')}
                  onKeyDown={e => { if (e.key === 'Enter') saveThreshold('exceeded'); }}
                  style={inputStyle}
                />
              </div>
            </div>
            {thresholdError && <div role="alert" style={{ fontSize: '0.75rem', color: 'var(--red-500)', fontWeight: 600, marginTop: 6 }}>{thresholdError}</div>}

            {/* Current status */}
            <div style={{ ...sectionTitle, marginTop: 20 }}>Current status</div>
            {statusRows.length === 0 ? (
              <div style={{ fontSize: '0.78rem', color: 'var(--text-400)' }}>
                No budgets set — add an overall or category budget to track status.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {statusRows.map(r => {
                  const pct = Math.round((r.spent / r.budget) * 1000) / 10;
                  const st = statusOf(r.spent, r.budget);
                  const ui = STATUS_UI[st];
                  return (
                    <div key={r.id}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                        <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-700)' }}>{r.name}</span>
                        <span style={{
                          display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '0.66rem', fontWeight: 800,
                          padding: '2px 8px', borderRadius: 99, color: ui.color, background: ui.bg,
                        }}>
                          <ui.Icon size={10} /> {ui.label} {pct}%
                        </span>
                      </div>
                      <div role="progressbar" aria-valuenow={Math.min(100, pct)} aria-valuemin={0} aria-valuemax={100}
                        aria-label={`${r.name}: ${pct}% of budget used`}
                        style={{ height: 6, borderRadius: 99, background: 'var(--bg-muted)', overflow: 'hidden' }}>
                        <div style={{
                          height: '100%', width: `${Math.min(100, pct)}%`, borderRadius: 99,
                          background: ui.color, transition: 'width 0.4s ease',
                        }} />
                      </div>
                      <div style={{ fontSize: '0.66rem', color: 'var(--text-400)', marginTop: 3 }}>
                        {formatCurrency(r.spent, currency)} of {formatCurrency(r.budget, currency)}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Create / edit goal modal */}
      {formGoal && (
        <div className="sw-overlay" onClick={e => { if (e.target === e.currentTarget) setFormGoal(null); }}>
          <div className="sw-modal-box" role="dialog" aria-modal="true" aria-label={formGoal === 'new' ? 'New savings goal' : 'Edit savings goal'}>
            <div style={{ padding: '20px 24px 24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: 'var(--r-lg)',
                    background: 'var(--brand-50)', border: '1px solid var(--brand-100)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Target size={16} style={{ color: 'var(--brand-600)' }} />
                  </div>
                  <h2 style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text-900)' }}>
                    {formGoal === 'new' ? 'New savings goal' : 'Edit savings goal'}
                  </h2>
                </div>
                <button onClick={() => setFormGoal(null)} className="sw-modal-close" aria-label="Close">
                  <X size={14} />
                </button>
              </div>
              <GoalForm
                initial={formGoal === 'new' ? undefined : formGoal}
                onSave={goal => {
                  if (formGoal === 'new') addGoal(goal);
                  else updateGoal(goal.id, goal);
                  setFormGoal(null);
                }}
                onCancel={() => setFormGoal(null)}
              />
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation */}
      {deleteTarget && (
        <div className="sw-overlay" onClick={e => { if (e.target === e.currentTarget) setDeleteTarget(null); }}>
          <div className="sw-modal-box" role="dialog" aria-modal="true" aria-label="Delete savings goal" style={{ maxWidth: 400 }}>
            <div style={{ padding: '20px 24px 24px' }}>
              <h2 style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text-900)', marginBottom: 8 }}>
                Delete &ldquo;{deleteTarget.name}&rdquo;?
              </h2>
              <p style={{ fontSize: '0.8125rem', color: 'var(--text-500)', marginBottom: 16 }}>
                This removes the goal and its progress history. Consider archiving instead to keep it around.
              </p>
              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  onClick={() => { deleteGoal(deleteTarget.id); setDeleteTarget(null); }}
                  style={{
                    flex: 1, padding: '10px', borderRadius: 'var(--r-md)', border: 'none',
                    background: 'var(--red-500)', color: '#fff',
                    fontSize: '0.875rem', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
                  }}
                >
                  Delete
                </button>
                <button
                  onClick={() => setDeleteTarget(null)}
                  style={{
                    padding: '10px 18px', borderRadius: 'var(--r-md)',
                    background: 'var(--bg-surface)', color: 'var(--text-600)',
                    border: '1.5px solid var(--border-default)',
                    fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
