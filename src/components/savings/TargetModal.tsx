'use client';

import { useState } from 'react';
import { X, Crosshair } from 'lucide-react';
import { useBudgetStore } from '@/store/budgetStore';
import { Opportunity } from '@/lib/savings';
import { formatCurrency } from '@/utils/currency';

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '9px 12px', borderRadius: 'var(--r-sm)',
  border: '1.5px solid var(--border-default)', background: 'var(--bg-surface)',
  color: 'var(--text-900)', fontSize: '0.875rem', fontFamily: 'inherit', outline: 'none',
  boxSizing: 'border-box',
};

/** "Set savings target" modal — mirrors the target into categoryBudgets via setSpendingTarget. */
export default function TargetModal({ opp, onClose }: { opp: Opportunity; onClose: () => void }) {
  const { currency, setSpendingTarget, categoryBudgets, spendingTargets } = useBudgetStore();
  const catId = opp.catId!;
  const existing = spendingTargets[catId]?.target ?? categoryBudgets[catId] ?? 0;

  const [targetStr, setTargetStr] = useState(String(Math.round(opp.suggestedTarget)));
  const target = parseFloat(targetStr);
  const valid = Number.isFinite(target) && target > 0;
  const aboveCurrent = valid && target >= opp.projectedMonthly;
  const potential = valid ? Math.max(0, Math.round((opp.projectedMonthly - target) / 10) * 10) : 0;

  const save = () => {
    if (!valid) return;
    setSpendingTarget(catId, { target, baselineMonthly: opp.avgMonthly });
    onClose();
  };

  return (
    <div className="sw-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="sw-modal-box" role="dialog" aria-modal="true" aria-label={`Set savings target for ${opp.name}`} style={{ maxWidth: 420 }}>
        <div style={{ padding: '20px 24px 24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 34, height: 34, borderRadius: 'var(--r-md)', background: 'var(--green-50)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Crosshair size={15} style={{ color: 'var(--green-600)' }} />
              </div>
              <h2 style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--text-900)' }}>
                Savings target — {opp.name}
              </h2>
            </div>
            <button onClick={onClose} className="sw-modal-close" aria-label="Close"><X size={14} /></button>
          </div>

          <div style={{ fontSize: '0.8125rem', color: 'var(--text-500)', marginBottom: 14 }}>
            Current spend / month: <strong style={{ color: 'var(--text-800)' }}>{formatCurrency(opp.projectedMonthly, currency)}</strong>
            {opp.avgMonthly > 0 && <> (average {formatCurrency(opp.avgMonthly, currency)})</>}
          </div>

          <label htmlFor="target-amt" style={{ display: 'block', fontSize: '0.6875rem', fontWeight: 700, color: 'var(--text-400)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 5 }}>
            Monthly target
          </label>
          <input
            id="target-amt"
            type="number" min="0" step="10"
            value={targetStr}
            onChange={e => setTargetStr(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') save(); }}
            style={{ ...inputStyle, borderColor: !valid ? 'var(--red-400)' : 'var(--border-default)' }}
            autoFocus
          />
          {!valid && targetStr !== '' && (
            <div style={{ fontSize: '0.72rem', color: 'var(--red-500)', marginTop: 5 }}>Enter a target greater than 0.</div>
          )}
          {aboveCurrent && (
            <div style={{ fontSize: '0.72rem', color: 'var(--warning-text)', marginTop: 5 }}>
              This is at or above your current projected spend — it won&apos;t create savings.
            </div>
          )}
          {existing > 0 && (
            <div style={{ fontSize: '0.72rem', color: 'var(--warning-text)', marginTop: 5 }}>
              This replaces your current {spendingTargets[catId] ? 'target' : 'budget'} of {formatCurrency(existing, currency)}.
            </div>
          )}

          <div style={{ marginTop: 14, padding: '12px 14px', background: 'var(--green-50)', borderRadius: 'var(--r-md)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-600)' }}>Potential saving</span>
            <span style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--green-600)', fontVariantNumeric: 'tabular-nums' }}>
              {formatCurrency(potential, currency)}/mo · {formatCurrency(potential * 12, currency)}/yr
            </span>
          </div>

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
            <button onClick={onClose} className="ws-cta-btn">Cancel</button>
            <button
              onClick={save}
              disabled={!valid}
              style={{
                padding: '8px 18px', borderRadius: 'var(--r-sm)', border: 'none',
                cursor: valid ? 'pointer' : 'default', fontFamily: 'inherit',
                fontSize: '0.8125rem', fontWeight: 700,
                background: valid ? 'var(--brand-600)' : 'var(--border-default)',
                color: valid ? '#fff' : 'var(--text-400)',
              }}
            >
              Save target
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
