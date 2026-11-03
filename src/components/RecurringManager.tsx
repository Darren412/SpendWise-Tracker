'use client';

import { useState } from 'react';
import { Plus, Pencil, Trash2, Pause, Play, Repeat, X } from 'lucide-react';
import { useBudgetStore } from '@/store/budgetStore';
import { RecurrenceFrequency, RecurringRule } from '@/types';
import RecurringRuleForm from '@/components/RecurringRuleForm';
import { nextOccurrence } from '@/lib/recurring';
import { formatCurrency } from '@/utils/currency';
import { todayLocalISO } from '@/utils/financialCycle';

const FREQ_LABEL: Record<RecurrenceFrequency, string> = {
  weekly: 'Weekly', monthly: 'Monthly', quarterly: 'Quarterly', yearly: 'Yearly',
};

export default function RecurringManager() {
  const {
    recurring, expenses, income, categories, currency,
    addRecurringRule, updateRecurringRule,
    pauseRecurringRule, resumeRecurringRule, deleteRecurringRule,
  } = useBudgetStore();

  const [formRule, setFormRule] = useState<RecurringRule | 'new' | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [alsoDelete, setAlsoDelete] = useState(false);

  const today = todayLocalISO();

  const getCat = (id: string) => categories.find(c => c.id === id);

  const statusOf = (r: RecurringRule): 'Active' | 'Paused' | 'Ended' =>
    r.paused ? 'Paused' : (r.endDate && r.endDate < today ? 'Ended' : 'Active');

  const generatedCount = (ruleId: string) =>
    expenses.filter(e => e.recurringId === ruleId).length +
    income.filter(i => i.recurringId === ruleId).length;

  const deleteRule = recurring.find(r => r.id === deleteId) ?? null;
  const deleteCount = deleteId ? generatedCount(deleteId) : 0;

  const statusStyle = (s: string): React.CSSProperties =>
    s === 'Active'
      ? { background: 'var(--green-50)', color: 'var(--green-600)', border: '1px solid var(--green-100)' }
      : s === 'Paused'
        ? { background: 'var(--amber-50)', color: 'var(--amber-600)', border: '1px solid var(--amber-100)' }
        : { background: 'var(--bg-muted)', color: 'var(--text-400)', border: '1px solid var(--border-default)' };

  const iconBtn: React.CSSProperties = {
    width: 28, height: 28, borderRadius: 6, border: 'none',
    background: 'transparent', cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    color: 'var(--text-400)', flexShrink: 0,
  };

  return (
    <div>
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <span style={{ fontSize: '0.8125rem', color: 'var(--text-400)' }}>
          {recurring.length} rule{recurring.length !== 1 ? 's' : ''}
        </span>
        <button
          onClick={() => setFormRule('new')}
          style={{
            display: 'flex', alignItems: 'center', gap: 5,
            padding: '7px 14px', borderRadius: 'var(--r-md)', border: 'none',
            background: 'var(--brand-600)', color: '#fff',
            fontSize: '0.8125rem', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
          }}
        >
          <Plus size={13} /> Add recurring
        </button>
      </div>

      {/* Empty state */}
      {recurring.length === 0 ? (
        <div className="empty-state" style={{ padding: '40px 20px' }}>
          <div className="empty-state-icon">🔁</div>
          <div className="empty-state-title">No recurring rules yet</div>
          <div className="empty-state-subtitle" style={{ marginBottom: 16 }}>
            Automatically create repeating expenses and income — rent, salary, subscriptions.
          </div>
          <button
            onClick={() => setFormRule('new')}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 5,
              padding: '9px 18px', borderRadius: 'var(--r-md)', border: 'none',
              background: 'var(--brand-600)', color: '#fff',
              fontSize: '0.8125rem', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            <Plus size={13} /> Add recurring
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {recurring.map(rule => {
            const cat = getCat(rule.category);
            const status = statusOf(rule);
            const next = status !== 'Ended' ? nextOccurrence(rule, today) : null;
            return (
              <div
                key={rule.id}
                style={{
                  padding: '12px 14px',
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border-default)',
                  borderRadius: 'var(--r-lg)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  {/* Category icon */}
                  <div style={{
                    width: 34, height: 34, borderRadius: 9, flexShrink: 0,
                    background: `${cat?.color ?? '#6b7280'}18`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16,
                  }}>
                    {cat?.icon ?? '🔁'}
                  </div>

                  {/* Main info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-900)' }}>
                        {rule.description}
                      </span>
                      <span style={{
                        padding: '1px 7px', borderRadius: 99, fontSize: '0.625rem', fontWeight: 800,
                        textTransform: 'uppercase', letterSpacing: '0.05em',
                        background: rule.type === 'expense' ? 'var(--red-50)' : 'var(--green-50)',
                        color: rule.type === 'expense' ? 'var(--red-500)' : 'var(--green-600)',
                        border: `1px solid ${rule.type === 'expense' ? 'var(--red-100)' : 'var(--green-100)'}`,
                      }}>
                        {rule.type}
                      </span>
                      <span style={{ ...statusStyle(status), padding: '1px 7px', borderRadius: 99, fontSize: '0.625rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        {status}
                      </span>
                    </div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-400)', marginTop: 2 }}>
                      {formatCurrency(rule.amount, currency)}
                      {' · '}{FREQ_LABEL[rule.frequency]}
                      {' · '}{cat?.name ?? rule.category}
                      {rule.city ? ` · ${rule.city}` : ''}
                      {next ? ` · Next ${new Date(next + 'T12:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}` : ''}
                    </div>
                  </div>

                  {/* Actions */}
                  <div style={{ display: 'flex', gap: 2 }}>
                    <button
                      onClick={() => setFormRule(rule)}
                      title="Edit rule" aria-label={`Edit ${rule.description}`}
                      style={iconBtn}
                    >
                      <Pencil size={13} />
                    </button>
                    {status !== 'Ended' && (
                      rule.paused ? (
                        <button
                          onClick={() => resumeRecurringRule(rule.id)}
                          title="Resume" aria-label={`Resume ${rule.description}`}
                          style={{ ...iconBtn, color: 'var(--green-600)' }}
                        >
                          <Play size={13} />
                        </button>
                      ) : (
                        <button
                          onClick={() => pauseRecurringRule(rule.id)}
                          title="Pause" aria-label={`Pause ${rule.description}`}
                          style={{ ...iconBtn, color: 'var(--amber-600)' }}
                        >
                          <Pause size={13} />
                        </button>
                      )
                    )}
                    <button
                      onClick={() => { setDeleteId(rule.id); setAlsoDelete(false); }}
                      title="Delete" aria-label={`Delete ${rule.description}`}
                      style={iconBtn}
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>

                {/* Pause hint */}
                {rule.paused && (
                  <div style={{ fontSize: '0.7rem', color: 'var(--amber-600)', marginTop: 8, paddingLeft: 44 }}>
                    Paused — resuming will not recreate the occurrences missed while paused.
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Create / edit modal */}
      {formRule && (
        <div className="sw-overlay" onClick={e => { if (e.target === e.currentTarget) setFormRule(null); }}>
          <div className="sw-modal-box" role="dialog" aria-modal="true" aria-label={formRule === 'new' ? 'New recurring rule' : 'Edit recurring rule'}>
            <div style={{ padding: '20px 24px 24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: 'var(--r-lg)',
                    background: 'var(--brand-50)', border: '1px solid var(--brand-100)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Repeat size={16} style={{ color: 'var(--brand-600)' }} />
                  </div>
                  <h2 style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text-900)' }}>
                    {formRule === 'new' ? 'New recurring rule' : 'Edit recurring rule'}
                  </h2>
                </div>
                <button onClick={() => setFormRule(null)} className="sw-modal-close" aria-label="Close">
                  <X size={14} />
                </button>
              </div>
              <RecurringRuleForm
                initial={formRule === 'new' ? undefined : formRule}
                onSave={rule => {
                  if (formRule === 'new') addRecurringRule(rule);
                  else updateRecurringRule(rule.id, rule);
                  setFormRule(null);
                }}
                onCancel={() => setFormRule(null)}
              />
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation modal */}
      {deleteRule && (
        <div className="sw-overlay" onClick={e => { if (e.target === e.currentTarget) setDeleteId(null); }}>
          <div className="sw-modal-box" role="dialog" aria-modal="true" aria-label="Delete recurring rule" style={{ maxWidth: 400 }}>
            <div style={{ padding: '20px 24px 24px' }}>
              <h2 style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text-900)', marginBottom: 8 }}>
                Delete &ldquo;{deleteRule.description}&rdquo;?
              </h2>
              <p style={{ fontSize: '0.8125rem', color: 'var(--text-500)', marginBottom: 14 }}>
                The rule stops generating new transactions.
              </p>
              {deleteCount > 0 && (
                <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, cursor: 'pointer', marginBottom: 16, padding: '10px 12px', background: 'var(--red-50)', border: '1px solid var(--red-100)', borderRadius: 'var(--r-md)' }}>
                  <input
                    type="checkbox"
                    checked={alsoDelete}
                    onChange={e => setAlsoDelete(e.target.checked)}
                    style={{ marginTop: 2, accentColor: 'var(--red-500)' }}
                  />
                  <span style={{ fontSize: '0.8125rem', color: 'var(--red-700)' }}>
                    Also delete the {deleteCount} transaction{deleteCount !== 1 ? 's' : ''} generated by this rule
                  </span>
                </label>
              )}
              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  onClick={() => { deleteRecurringRule(deleteRule.id, alsoDelete); setDeleteId(null); }}
                  style={{
                    flex: 1, padding: '10px', borderRadius: 'var(--r-md)', border: 'none',
                    background: 'var(--red-500)', color: '#fff',
                    fontSize: '0.875rem', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
                  }}
                >
                  Delete
                </button>
                <button
                  onClick={() => setDeleteId(null)}
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
