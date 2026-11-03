'use client';

import { Target, ArrowRight } from 'lucide-react';
import { useBudgetStore } from '@/store/budgetStore';
import { sortGoals, goalProgress } from '@/lib/goals';
import { formatCurrency } from '@/utils/currency';
import { todayLocalISO } from '@/utils/financialCycle';

interface GoalsSummaryCardProps {
  onNavigate: (workspace: string) => void;
}

/**
 * Overview summary — top 3 active savings goals with progress bars.
 * Degrades to a single-line CTA when no goals exist.
 */
export default function GoalsSummaryCard({ onNavigate }: GoalsSummaryCardProps) {
  const { goals, currency } = useBudgetStore();
  const today = todayLocalISO();
  const active = sortGoals(goals.filter(g => !g.archived && !(g.targetAmount > 0 && g.savedAmount >= g.targetAmount)));
  const shown = active.slice(0, 3);

  if (goals.length === 0) {
    return (
      <button
        onClick={() => onNavigate('planning')}
        style={{
          display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px',
          background: 'var(--bg-surface)', border: '1px dashed var(--border-strong)',
          borderRadius: 'var(--r-lg)', cursor: 'pointer', fontFamily: 'inherit',
          fontSize: '0.8rem', fontWeight: 600, color: 'var(--brand-600)',
          marginBottom: 16, width: '100%',
        }}
      >
        <Target size={14} /> Set a savings goal →
      </button>
    );
  }

  if (shown.length === 0) return null; // all archived or completed — nothing to surface

  return (
    <div className="panel" style={{ padding: '16px 20px', marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <span style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--text-400)', textTransform: 'uppercase', letterSpacing: '0.09em', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <Target size={12} style={{ color: 'var(--brand-600)' }} /> Savings goals
        </span>
        <button
          onClick={() => onNavigate('planning')}
          style={{
            background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit',
            fontSize: '0.75rem', fontWeight: 700, color: 'var(--brand-600)',
            display: 'inline-flex', alignItems: 'center', gap: 4,
          }}
        >
          View all <ArrowRight size={11} />
        </button>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {shown.map(g => {
          const p = goalProgress(g, today);
          return (
            <div key={g.id}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-800)' }}>{g.name}</span>
                <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-500)', fontVariantNumeric: 'tabular-nums' }}>
                  {formatCurrency(g.savedAmount, currency)} / {formatCurrency(g.targetAmount, currency)} · {p.pct}%
                </span>
              </div>
              <div
                role="progressbar" aria-valuenow={p.pct} aria-valuemin={0} aria-valuemax={100}
                aria-label={`${g.name} progress: ${p.pct}%`}
                style={{ height: 6, borderRadius: 99, background: 'var(--bg-muted)', overflow: 'hidden' }}
              >
                <div style={{ height: '100%', width: `${p.pct}%`, borderRadius: 99, background: 'var(--brand-500)', transition: 'width 0.4s ease' }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
