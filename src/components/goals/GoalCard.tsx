'use client';

import { useState } from 'react';
import { CheckCircle2, Clock, AlertCircle, Pencil, Archive, ArchiveRestore, Trash2, X } from 'lucide-react';
import { SavingsGoal } from '@/types';
import { goalProgress } from '@/lib/goals';
import { useBudgetStore } from '@/store/budgetStore';
import { formatCurrency } from '@/utils/currency';
import { todayLocalISO } from '@/utils/financialCycle';

interface GoalCardProps {
  goal: SavingsGoal;
  onEdit: () => void;
  onDelete: () => void;
}

const STATUS_META = {
  completed:   { label: 'Completed',   color: 'var(--green-600)',  bg: 'var(--green-50)',  Icon: CheckCircle2 },
  overdue:     { label: 'Overdue',     color: 'var(--red-500)',    bg: 'var(--red-50)',    Icon: AlertCircle },
  active:      { label: 'On track',    color: 'var(--brand-600)',  bg: 'var(--brand-50)',  Icon: Clock },
  'no-deadline': { label: 'No deadline', color: 'var(--text-400)', bg: 'var(--bg-muted)',  Icon: Clock },
} as const;

/** One savings-goal card with progress + actions. */
export default function GoalCard({ goal, onEdit, onDelete }: GoalCardProps) {
  const { contributeToGoal, archiveGoal, currency } = useBudgetStore();
  const today = todayLocalISO();
  const p = goalProgress(goal, today);
  const meta = STATUS_META[goal.archived ? 'no-deadline' : p.status];

  const [contribOpen, setContribOpen] = useState(false);
  const [contrib, setContrib]         = useState('');
  const [contribErr, setContribErr]   = useState('');

  const submitContrib = () => {
    const n = parseFloat(contrib);
    if (!Number.isFinite(n) || n === 0) { setContribErr('Enter a non-zero amount (use − for withdrawals).'); return; }
    contributeToGoal(goal.id, n);
    setContrib(''); setContribErr(''); setContribOpen(false);
  };

  const fmtDate = (iso: string) =>
    new Date(iso + 'T12:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

  const iconBtn = (label: string, onClick: () => void, icon: React.ReactNode, danger = false) => (
    <button
      onClick={onClick}
      aria-label={label}
      title={label}
      style={{
        width: 30, height: 30, borderRadius: 8, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        background: 'var(--bg-surface)', border: '1px solid var(--border-default)', cursor: 'pointer',
        color: danger ? 'var(--red-500)' : 'var(--text-500)', transition: 'all 0.12s',
      }}
    >
      {icon}
    </button>
  );

  return (
    <div className="panel" style={{ padding: '16px 18px', opacity: goal.archived ? 0.6 : 1 }}>
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginBottom: 10 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--text-900)' }}>{goal.name}</span>
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '0.66rem', fontWeight: 700,
              padding: '2px 8px', borderRadius: 99, color: meta.color, background: meta.bg,
            }}>
              <meta.Icon size={10} /> {goal.archived ? 'Archived' : meta.label}
            </span>
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-400)', marginTop: 3 }}>
            {goal.targetDate ? `by ${fmtDate(goal.targetDate)}` : 'No deadline'}
            {p.daysLeft !== null && !p.isComplete && p.daysLeft >= 0 && ` · ${p.daysLeft} days left`}
            {p.status === 'overdue' && ' · target date passed'}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
          {iconBtn(`Edit ${goal.name}`, onEdit, <Pencil size={13} />)}
          {iconBtn(goal.archived ? `Unarchive ${goal.name}` : `Archive ${goal.name}`,
            () => archiveGoal(goal.id, !goal.archived),
            goal.archived ? <ArchiveRestore size={13} /> : <Archive size={13} />)}
          {iconBtn(`Delete ${goal.name}`, onDelete, <Trash2 size={13} />, true)}
        </div>
      </div>

      {/* Progress */}
      <div style={{ marginBottom: 8 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 5 }}>
          <span style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-900)', fontVariantNumeric: 'tabular-nums' }}>
            {formatCurrency(goal.savedAmount, currency)}
            <span style={{ fontWeight: 500, color: 'var(--text-400)', fontSize: '0.75rem' }}> / {formatCurrency(goal.targetAmount, currency)}</span>
          </span>
          <span style={{ fontSize: '0.78rem', fontWeight: 800, color: meta.color }}>{p.pct}%</span>
        </div>
        <div
          role="progressbar"
          aria-valuenow={p.pct} aria-valuemin={0} aria-valuemax={100}
          aria-label={`${goal.name} progress: ${p.pct}%`}
          style={{ height: 8, borderRadius: 99, background: 'var(--bg-muted)', overflow: 'hidden' }}
        >
          <div style={{
            height: '100%', borderRadius: 99, width: `${p.pct}%`,
            background: p.isComplete ? 'var(--green-500)' : 'var(--brand-500)',
            transition: 'width 0.4s ease',
          }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 5, fontSize: '0.68rem', color: 'var(--text-400)' }}>
          <span>{p.isComplete ? 'Goal reached 🎉' : `${formatCurrency(p.remaining, currency)} to go`}</span>
          {p.requiredPerMonth !== null && (
            <span>{formatCurrency(p.requiredPerMonth, currency)}/month needed</span>
          )}
        </div>
      </div>

      {/* Contribution */}
      {!goal.archived && (
        contribOpen ? (
          <div style={{ marginTop: 6 }}>
            <div style={{ display: 'flex', gap: 6 }}>
              <input
                type="number" inputMode="decimal" step="0.01"
                value={contrib}
                onChange={e => setContrib(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') submitContrib(); if (e.key === 'Escape') setContribOpen(false); }}
                placeholder="+500 or −200"
                aria-label={`Contribution to ${goal.name}`}
                autoFocus
                style={{
                  flex: 1, minWidth: 0, padding: '7px 10px', borderRadius: 'var(--r-sm)',
                  border: `1.5px solid ${contribErr ? 'var(--red-400)' : 'var(--border-default)'}`,
                  background: 'var(--bg-surface)', color: 'var(--text-900)', fontSize: '0.8125rem',
                  fontFamily: 'inherit', outline: 'none',
                }}
              />
              <button
                onClick={submitContrib}
                style={{
                  padding: '7px 14px', borderRadius: 'var(--r-sm)', border: 'none', cursor: 'pointer',
                  background: 'var(--brand-600)', color: '#fff', fontSize: '0.78rem', fontWeight: 700, fontFamily: 'inherit',
                }}
              >
                Add
              </button>
              <button onClick={() => { setContribOpen(false); setContribErr(''); }} aria-label="Cancel contribution"
                style={{ width: 32, borderRadius: 'var(--r-sm)', border: '1px solid var(--border-default)', background: 'var(--bg-surface)', color: 'var(--text-500)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <X size={13} />
              </button>
            </div>
            {contribErr && <div role="alert" style={{ fontSize: '0.72rem', color: 'var(--red-500)', fontWeight: 600, marginTop: 4 }}>{contribErr}</div>}
          </div>
        ) : (
          <button
            onClick={() => setContribOpen(true)}
            style={{
              marginTop: 4, padding: '7px 14px', borderRadius: 'var(--r-sm)', cursor: 'pointer',
              background: 'var(--brand-50)', color: 'var(--brand-600)', border: '1px solid var(--brand-200)',
              fontSize: '0.75rem', fontWeight: 700, fontFamily: 'inherit',
            }}
          >
            + Add contribution
          </button>
        )
      )}
    </div>
  );
}
