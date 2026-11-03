'use client';

import { AlertTriangle, XCircle, X } from 'lucide-react';
import { useBudgetStore } from '@/store/budgetStore';
import { useBudgetAlerts } from '@/hooks/useBudgetAlerts';
import { formatCurrency } from '@/utils/currency';

interface BudgetAlertsBannerProps {
  onNavigate: (workspace: string) => void;
}

/**
 * Compact strip of active budget alerts for the selected period (max 3
 * shown + "+N more" → Planning). Each row is dismissible via
 * acknowledgeAlert — warnings stay hidden until the exceeded threshold is
 * breached, exceeded stays hidden for the rest of the period.
 */
export default function BudgetAlertsBanner({ onNavigate }: BudgetAlertsBannerProps) {
  const { acknowledgeAlert, currency } = useBudgetStore();
  const { visible } = useBudgetAlerts();

  if (visible.length === 0) return null;
  const shown = visible.slice(0, 3);
  const more = visible.length - shown.length;

  return (
    <div role="status" aria-live="polite" style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16 }}>
      {shown.map(a => {
        const exceeded = a.level === 'exceeded';
        const color = exceeded ? 'var(--red-600)' : 'var(--amber-600)';
        const bg = exceeded ? 'var(--red-50)' : 'var(--amber-50)';
        const border = exceeded ? 'var(--red-200)' : 'var(--amber-200)';
        const text = a.scope === 'overall'
          ? exceeded
            ? `Overall budget exceeded — ${a.pct}% used`
            : `Overall budget at ${a.pct}% — ${formatCurrency(a.spent, currency)} of ${formatCurrency(a.budget, currency)} used`
          : `${a.name}: ${a.pct}% of ${formatCurrency(a.budget, currency)} ${a.isTarget ? 'target' : 'budget'} used`;
        return (
          <div key={a.key} style={{
            display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px',
            background: bg, border: `1px solid ${border}`, borderRadius: 'var(--r-md)',
          }}>
            {exceeded
              ? <XCircle size={15} style={{ color, flexShrink: 0 }} />
              : <AlertTriangle size={15} style={{ color, flexShrink: 0 }} />}
            <span style={{ flex: 1, fontSize: '0.8rem', fontWeight: 600, color }}>{text}</span>
            <button
              onClick={() => acknowledgeAlert(a.key)}
              aria-label={`Dismiss alert for ${a.name}`}
              style={{
                background: 'none', border: 'none', cursor: 'pointer', color,
                padding: 2, display: 'flex', opacity: 0.75,
              }}
            >
              <X size={13} />
            </button>
          </div>
        );
      })}
      {more > 0 && (
        <button
          onClick={() => onNavigate('planning')}
          style={{
            alignSelf: 'flex-start', background: 'none', border: 'none', cursor: 'pointer',
            fontSize: '0.78rem', fontWeight: 700, color: 'var(--brand-600)', fontFamily: 'inherit',
            padding: '2px 4px',
          }}
        >
          +{more} more alert{more !== 1 ? 's' : ''} — open Planning
        </button>
      )}
    </div>
  );
}
