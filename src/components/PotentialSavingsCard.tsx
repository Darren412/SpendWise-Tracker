'use client';

import { Sparkles, ArrowRight } from 'lucide-react';
import { useBudgetStore } from '@/store/budgetStore';
import { useSavingsAnalysis } from '@/hooks/useSavingsAnalysis';
import { formatCurrency, formatCurrencyShort } from '@/utils/currency';

interface Props {
  onNavigate: (workspace: string, subTab?: string) => void;
}

/**
 * Compact Overview card surfacing the savings-opportunity analysis —
 * potential monthly/annual + top 3, deep-linking to Planning › "Where Can
 * I Save?". Collapses to a single line when history is insufficient or
 * there's nothing to save.
 */
export default function PotentialSavingsCard({ onNavigate }: Props) {
  const currency = useBudgetStore(s => s.currency);
  const analysis = useSavingsAnalysis(3);

  if (analysis.status === 'insufficient') {
    return (
      <div className="ws-panel" style={{ padding: '12px 18px', marginBottom: 16 }}>
        <span style={{ fontSize: '0.8rem', color: 'var(--text-500)' }}>
          <Sparkles size={12} style={{ verticalAlign: -2, marginRight: 6, color: 'var(--brand-500)' }} />
          Savings insights unlock after {analysis.monthsNeeded} months of history ({analysis.monthsAvailable}/{analysis.monthsNeeded})
        </span>
      </div>
    );
  }

  if (analysis.potentialMonthly <= 0) {
    return (
      <div className="ws-panel" style={{ padding: '12px 18px', marginBottom: 16 }}>
        <span style={{ fontSize: '0.8rem', color: 'var(--text-500)' }}>
          <Sparkles size={12} style={{ verticalAlign: -2, marginRight: 6, color: 'var(--green-600)' }} />
          Your spending is in line with your usual pattern — no savings opportunities right now.
        </span>
      </div>
    );
  }

  const top3 = analysis.opportunities.filter(o => o.includedInTotal).slice(0, 3);

  return (
    <div className="ws-panel" style={{ padding: '16px 18px', marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <div style={{ width: 30, height: 30, borderRadius: 9, background: 'var(--green-50)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Sparkles size={14} style={{ color: 'var(--green-600)' }} />
            </div>
            <div>
              <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-800)' }}>Potential Savings</div>
              <div style={{ fontSize: '0.68rem', color: 'var(--text-400)' }}>{analysis.periodLabel} · based on your last {analysis.windowUsed} months</div>
            </div>
          </div>
          <div style={{ fontSize: '1.375rem', fontWeight: 800, color: 'var(--green-600)', fontVariantNumeric: 'tabular-nums', marginTop: 6 }}>
            {formatCurrency(analysis.potentialMonthly, currency)}
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-400)' }}>/month</span>
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-400)' }}>≈ {formatCurrencyShort(analysis.potentialAnnual, currency)}/year</div>
        </div>

        <div style={{ flex: 1, minWidth: 200, maxWidth: 420 }}>
          {top3.map((o, i) => (
            <div key={o.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.78rem', padding: '3px 0' }}>
              <span style={{ color: 'var(--text-300)', fontWeight: 700, fontSize: '0.7rem', width: 12 }}>{i + 1}.</span>
              <span style={{ fontWeight: 600, color: 'var(--text-800)', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {o.icon} {o.name}
              </span>
              <span style={{ color: o.priority === 'High' ? 'var(--danger-text)' : o.priority === 'Medium' ? 'var(--warning-text)' : 'var(--text-500)', fontWeight: 700, fontSize: '0.7rem' }}>
                {o.priority}
              </span>
              <span style={{ color: 'var(--green-600)', fontWeight: 700, fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>
                {formatCurrencyShort(o.estMonthly, currency)}/mo
              </span>
            </div>
          ))}
          <button
            onClick={() => onNavigate('planning', 'save')}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 5, marginTop: 8,
              background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit',
              fontSize: '0.78rem', fontWeight: 700, color: 'var(--brand-600)', padding: 0,
            }}
          >
            View savings opportunities <ArrowRight size={12} />
          </button>
        </div>
      </div>
    </div>
  );
}
