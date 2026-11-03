'use client';

import { useState } from 'react';
import {
  Flame, TrendingUp, Info, ChevronDown, ChevronUp, EyeOff, Undo2,
  Crosshair, HelpCircle,
} from 'lucide-react';
import { useBudgetStore } from '@/store/budgetStore';
import { useSavingsAnalysis } from '@/hooks/useSavingsAnalysis';
import { Opportunity, OpportunityPriority } from '@/lib/savings';
import { SpendClass } from '@/lib/spendClass';
import { formatCurrency, formatCurrencyShort } from '@/utils/currency';
import OpportunityDetails from './OpportunityDetails';
import TargetModal from './TargetModal';
import TargetsPanel from './TargetsPanel';

const PRIORITY_UI: Record<OpportunityPriority, { color: string; bg: string; border: string; Icon: typeof Flame; label: string }> = {
  High:   { color: 'var(--danger-text)',  bg: 'var(--red-50)',   border: 'var(--red-200)',   Icon: Flame,      label: 'High' },
  Medium: { color: 'var(--warning-text)', bg: 'var(--amber-50)', border: 'var(--amber-200)', Icon: TrendingUp, label: 'Medium' },
  Low:    { color: 'var(--text-500)',     bg: 'var(--bg-muted)', border: 'var(--border-default)', Icon: Info,  label: 'Low' },
};

const CLASS_LABEL: Record<SpendClass, string> = {
  essential: 'Essential', flexible: 'Flexible', discretionary: 'Discretionary',
};

const statLabel: React.CSSProperties = {
  fontSize: '0.625rem', fontWeight: 700, color: 'var(--text-400)',
  textTransform: 'uppercase', letterSpacing: '0.07em',
};

function OpportunityCard({
  opp, currency, onDetails, onTarget, onDismiss, onMute, dismissed, onRestore,
}: {
  opp: Opportunity;
  currency: string;
  onDetails: () => void;
  onTarget?: () => void;
  onDismiss: () => void;
  onMute?: () => void;
  dismissed?: boolean;
  onRestore?: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const P = PRIORITY_UI[opp.priority];
  const money = (n: number) => formatCurrency(n, currency);

  return (
    <div className="panel" style={{ padding: '16px 18px', opacity: dismissed ? 0.65 : 1 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
        <div style={{
          width: 38, height: 38, borderRadius: 'var(--r-md)', flexShrink: 0,
          background: `${opp.color}18`, display: 'flex', alignItems: 'center',
          justifyContent: 'center', fontSize: 17,
        }}>
          {opp.icon}
        </div>
        <div style={{ flex: 1, minWidth: 180 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.9375rem', fontWeight: 700, color: 'var(--text-900)' }}>{opp.name}</span>
            {opp.spendClass && (
              <span style={{ fontSize: '0.625rem', fontWeight: 700, color: 'var(--text-500)', background: 'var(--bg-muted)', padding: '2px 7px', borderRadius: 99 }}>
                {CLASS_LABEL[opp.spendClass]}
              </span>
            )}
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 4,
              fontSize: '0.6875rem', fontWeight: 800, color: P.color,
              background: P.bg, border: `1px solid ${P.border}`, padding: '2px 8px', borderRadius: 99,
            }}>
              <P.Icon size={10} /> {P.label} opportunity
            </span>
          </div>
          {opp.reasons.slice(0, 2).map((r, i) => (
            <p key={i} style={{ fontSize: '0.78rem', color: 'var(--text-500)', marginTop: 4, lineHeight: 1.45 }}>
              {r}
            </p>
          ))}
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <div style={{ fontSize: '1.125rem', fontWeight: 800, color: 'var(--green-600)', fontVariantNumeric: 'tabular-nums' }}>
            {money(opp.estMonthly)}<span style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-400)' }}>/mo</span>
          </div>
          <div style={{ fontSize: '0.6875rem', color: 'var(--text-400)' }}>{money(opp.estAnnual)}/yr potential</div>
        </div>
      </div>

      {/* Stat strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: '10px 14px', marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--bg-muted)' }}>
        <div>
          <div style={statLabel}>{opp.kind === 'subscriptions' ? 'Monthly total' : 'Current'}</div>
          <div style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--text-900)' }}>
            {money(opp.currentToDate)}
            {opp.kind === 'category' && Math.abs(opp.currentToDate - opp.projectedMonthly) > 0.5 && (
              <span style={{ fontSize: '0.6875rem', fontWeight: 500, color: 'var(--text-400)' }}> → {money(opp.projectedMonthly)}</span>
            )}
          </div>
        </div>
        {opp.kind === 'category' && (
          <>
            <div>
              <div style={statLabel}>Historical avg</div>
              <div style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--text-900)' }}>{money(opp.avgMonthly)}</div>
            </div>
            <div>
              <div style={statLabel}>Difference</div>
              <div style={{ fontSize: '0.8125rem', fontWeight: 700, color: opp.diffAmount > 0 ? 'var(--danger-text)' : 'var(--success-text)' }}>
                {opp.diffAmount > 0 ? '+' : ''}{money(opp.diffAmount)}
                {opp.pctVsAvg !== null && <span style={{ fontSize: '0.6875rem', fontWeight: 600 }}> ({opp.pctVsAvg > 0 ? '+' : ''}{opp.pctVsAvg}%)</span>}
              </div>
            </div>
            <div>
              <div style={statLabel}>Transactions</div>
              <div style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--text-900)' }}>{opp.txnCount}</div>
            </div>
          </>
        )}
        <div>
          <div style={statLabel}>Suggested reduction</div>
          <div style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--text-900)' }}>{opp.suggestedReductionPct}%</div>
        </div>
        <div>
          <div style={statLabel}>Score</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ flex: 1, height: 4, background: 'var(--bg-muted)', borderRadius: 99, overflow: 'hidden', minWidth: 40 }}>
              <div style={{ height: '100%', width: `${opp.score}%`, background: P.color, borderRadius: 99 }} />
            </div>
            <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-700)', fontVariantNumeric: 'tabular-nums' }}>{opp.score}</span>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap', position: 'relative' }}>
        {dismissed ? (
          <button onClick={onRestore} className="ws-cta-btn" style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
            <Undo2 size={12} /> Restore
          </button>
        ) : (
          <>
            <button onClick={onDetails} className="ws-cta-btn">Details</button>
            {opp.kind === 'category' && onTarget && (
              <button onClick={onTarget} className="ws-cta-btn" style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                <Crosshair size={12} /> Set savings target
              </button>
            )}
            <div style={{ position: 'relative' }}>
              <button
                onClick={() => setMenuOpen(v => !v)}
                className="ws-cta-btn"
                aria-haspopup="menu"
                aria-expanded={menuOpen}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
              >
                <EyeOff size={12} /> Dismiss {menuOpen ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
              </button>
              {menuOpen && (
                <div role="menu" style={{
                  position: 'absolute', bottom: '100%', left: 0, marginBottom: 4, zIndex: 20,
                  background: 'var(--bg-surface)', border: '1px solid var(--border-default)',
                  borderRadius: 'var(--r-md)', boxShadow: 'var(--shadow-md)', minWidth: 190,
                  overflow: 'hidden',
                }}>
                  <button role="menuitem" onClick={() => { setMenuOpen(false); onDismiss(); }}
                    style={{ display: 'block', width: '100%', textAlign: 'left', padding: '10px 14px', background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-700)', fontFamily: 'inherit' }}>
                    Not this month
                  </button>
                  {opp.catId && onMute && (
                    <button role="menuitem" onClick={() => { setMenuOpen(false); onMute(); }}
                      style={{ display: 'block', width: '100%', textAlign: 'left', padding: '10px 14px', background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-700)', fontFamily: 'inherit', borderTop: '1px solid var(--bg-muted)' }}>
                      Never suggest {opp.name}
                    </button>
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default function SavingsTab() {
  const {
    currency, categories,
    dismissOpportunity, restoreOpportunity,
    muteOpportunityCategory, unmuteOpportunityCategory,
    mutedOpportunityCategories,
  } = useBudgetStore();
  const [window, setWindow] = useState<3 | 6 | 12>(3);
  const [showMethod, setShowMethod] = useState(false);
  const [showDismissed, setShowDismissed] = useState(false);
  const [detailsOpp, setDetailsOpp] = useState<Opportunity | null>(null);
  const [targetOpp, setTargetOpp] = useState<Opportunity | null>(null);

  const analysis = useSavingsAnalysis(window);
  const money = (n: number) => formatCurrency(n, currency);

  /* ── Insufficient history ── */
  if (analysis.status === 'insufficient') {
    return (
      <div className="panel" style={{ padding: '48px 24px', textAlign: 'center' }}>
        <div style={{ fontSize: 36, marginBottom: 12 }}>📈</div>
        <div style={{ fontSize: '0.9375rem', fontWeight: 700, color: 'var(--text-700)', marginBottom: 6 }}>
          Not enough history yet
        </div>
        <div style={{ fontSize: '0.8125rem', color: 'var(--text-400)' }}>
          Savings estimates need {analysis.monthsNeeded} complete months of spending — you have {analysis.monthsAvailable}.
        </div>
      </div>
    );
  }

  const dismissKey = (o: Opportunity) => `${analysis.periodKey}:${o.id}`;

  return (
    <div>
      {/* ── Header strip ── */}
      <div className="panel" style={{ padding: '18px 20px', marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
          <div>
            <div style={statLabel}>Potential savings</div>
            <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--green-600)', fontVariantNumeric: 'tabular-nums', lineHeight: 1.1 }}>
              {money(analysis.potentialMonthly)}<span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-400)' }}>/month</span>
            </div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-500)', marginTop: 2 }}>
              ≈ {money(analysis.potentialAnnual)}/year
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-400)', marginTop: 6 }}>
              {analysis.periodLabel} · {analysis.inProgress
                ? `${analysis.elapsedDays} days into the month`
                : 'complete month'} · {`average of your last ${analysis.windowUsed} month${analysis.windowUsed === 1 ? '' : 's'}`}
            </div>
            {analysis.basisNote && (
              <div style={{ fontSize: '0.72rem', color: 'var(--warning-text)', marginTop: 4 }}>{analysis.basisNote}</div>
            )}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
            <div role="group" aria-label="Baseline window" style={{ display: 'flex', gap: 3, background: 'var(--bg-muted)', padding: 3, borderRadius: 'var(--r-md)' }}>
              {([3, 6, 12] as const).map(w => (
                <button
                  key={w}
                  onClick={() => setWindow(w)}
                  aria-pressed={window === w}
                  style={{
                    padding: '5px 12px', borderRadius: 'var(--r-sm)', border: 'none', cursor: 'pointer',
                    fontFamily: 'inherit', fontSize: '0.75rem', fontWeight: window === w ? 700 : 500,
                    background: window === w ? 'var(--bg-surface)' : 'transparent',
                    color: window === w ? 'var(--brand-text)' : 'var(--text-500)',
                    boxShadow: window === w ? 'var(--shadow-xs)' : 'none',
                  }}
                >
                  {w}m
                </button>
              ))}
            </div>
            <button
              onClick={() => setShowMethod(v => !v)}
              aria-expanded={showMethod}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.72rem', fontWeight: 700, color: 'var(--brand-text)' }}
            >
              <HelpCircle size={12} /> How is this calculated? {showMethod ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
            </button>
          </div>
        </div>

        {showMethod && (
          <div style={{ marginTop: 14, padding: '12px 14px', background: 'var(--bg-subtle)', borderRadius: 'var(--r-md)', fontSize: '0.75rem', color: 'var(--text-600)', lineHeight: 1.6 }}>
            <strong>Baseline:</strong> your last {analysis.windowUsed} complete month{analysis.windowUsed === 1 ? '' : 's'} ({analysis.baselineLabels.join(', ')}).
            For months in progress we compare spend to this point with the same point in baseline months, then project the month-end at your current pace.{' '}
            <strong>Priority:</strong> &gt;20% above average → High, 10–20% → Medium, below → Low. Essentials are capped at Medium unless +50%.{' '}
            <strong>Class weights:</strong> discretionary ×1.0, flexible ×0.75, essential ×0.4.{' '}
            Recurring payments and one-off spikes are excluded from savings estimates and shown separately under Subscriptions.
            Suggested savings round to the nearest 10.
          </div>
        )}

        {/* Spend split */}
        <div style={{ marginTop: 14 }}>
          <div style={{ display: 'flex', height: 10, borderRadius: 99, overflow: 'hidden', background: 'var(--bg-muted)' }} role="img"
            aria-label={`Spend split: ${analysis.split.map(s => `${s.key} ${s.pct}%`).join(', ')}`}>
            {analysis.split.map(s => (
              <div key={s.key} style={{
                width: `${s.pct}%`,
                background: s.key === 'essential' ? 'var(--blue-500)' : s.key === 'flexible' ? 'var(--amber-500)' : 'var(--purple-500)',
              }} />
            ))}
          </div>
          <div style={{ display: 'flex', gap: 14, marginTop: 6, flexWrap: 'wrap' }}>
            {analysis.split.map(s => (
              <span key={s.key} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: '0.6875rem', color: 'var(--text-500)' }}>
                <span style={{ width: 8, height: 8, borderRadius: 2, background: s.key === 'essential' ? 'var(--blue-500)' : s.key === 'flexible' ? 'var(--amber-500)' : 'var(--purple-500)' }} />
                {CLASS_LABEL[s.key]} · {formatCurrencyShort(s.total, currency)} · {s.pct}%
              </span>
            ))}
          </div>
        </div>

        {/* What-if (never in totals) */}
        {analysis.whatIf.estMonthly > 0 && (
          <div style={{ marginTop: 10, fontSize: '0.75rem', color: 'var(--text-500)', fontStyle: 'italic' }}>
            {analysis.whatIf.text} <span style={{ fontStyle: 'normal', fontWeight: 600, color: 'var(--text-400)' }}>(not included in the total)</span>
          </div>
        )}
        {/* Balance-funded outflows — informational, never treated as overspending */}
        {analysis.majorOutflows.length > 0 && (
          <div style={{ marginTop: 14, padding: '10px 14px', background: 'var(--amber-50, var(--bg-muted))', border: '1px solid var(--border-default)', borderRadius: 'var(--r-md)', fontSize: '0.75rem', color: 'var(--text-600)' }}>
            <div style={{ fontWeight: 700, marginBottom: 4, color: 'var(--amber-600)' }}>
              Major expenses from existing balance — not treated as overspending
            </div>
            {analysis.majorOutflows.map(r => (
              <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, padding: '2px 0', flexWrap: 'wrap' }}>
                <span>{r.date} · {r.description} · {r.categoryName}</span>
                <span className="num-mono" style={{ fontWeight: 600 }}>{formatCurrency(r.amount, currency)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Active savings targets ── */}
      <TargetsPanel />

      {/* ── Opportunity cards ── */}
      {analysis.opportunities.length === 0 && analysis.dismissedOpportunities.length === 0 ? (
        <div className="panel" style={{ padding: '40px 24px', textAlign: 'center' }}>
          <div style={{ fontSize: 32, marginBottom: 10 }}>✨</div>
          <div style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-700)', marginBottom: 4 }}>
            Your spending is in line with your usual pattern
          </div>
          <div style={{ fontSize: '0.8125rem', color: 'var(--text-400)' }}>No savings opportunities right now.</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {analysis.opportunities.map(o => (
            <OpportunityCard
              key={o.id}
              opp={o}
              currency={currency}
              onDetails={() => setDetailsOpp(o)}
              onTarget={() => setTargetOpp(o)}
              onDismiss={() => dismissOpportunity(dismissKey(o))}
              onMute={o.catId ? () => muteOpportunityCategory(o.catId!) : undefined}
            />
          ))}
        </div>
      )}

      {/* ── Muted (never-suggested) categories ── */}
      {mutedOpportunityCategories.length > 0 && (
        <div className="panel" style={{ padding: '12px 16px', marginTop: 14 }}>
          <div style={{ fontSize: '0.68rem', fontWeight: 800, color: 'var(--text-400)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8 }}>
            Never-suggested categories
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {mutedOpportunityCategories.map(catId => {
              const cat = categories.find(c => c.id === catId);
              return (
                <span key={catId} style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-600)',
                  background: 'var(--bg-subtle)', border: '1px solid var(--border-default)',
                  borderRadius: 99, padding: '4px 8px 4px 12px',
                }}>
                  {cat?.icon} {cat?.name ?? catId}
                  <button
                    onClick={() => unmuteOpportunityCategory(catId)}
                    aria-label={`Unmute ${cat?.name ?? catId}`}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.7rem', fontWeight: 700, color: 'var(--brand-text)', padding: '2px 6px' }}
                  >
                    Unmute
                  </button>
                </span>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Dismissed / restore ── */}
      {analysis.dismissedOpportunities.length > 0 && (
        <div style={{ marginTop: 14 }}>
          <button
            onClick={() => setShowDismissed(v => !v)}
            aria-expanded={showDismissed}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-400)' }}
          >
            {showDismissed ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            Show dismissed ({analysis.dismissedOpportunities.length})
          </button>
          {showDismissed && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 10 }}>
              {analysis.dismissedOpportunities.map(o => (
                <OpportunityCard
                  key={o.id}
                  opp={o}
                  currency={currency}
                  dismissed
                  onDetails={() => setDetailsOpp(o)}
                  onDismiss={() => {}}
                  onRestore={() => restoreOpportunity(dismissKey(o))}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Details modal ── */}
      {detailsOpp && (
        <OpportunityDetails
          opp={detailsOpp}
          onClose={() => setDetailsOpp(null)}
          onSetTarget={detailsOpp.kind === 'category' ? () => { setTargetOpp(detailsOpp); setDetailsOpp(null); } : undefined}
        />
      )}

      {/* ── Target modal ── */}
      {targetOpp && (
        <TargetModal opp={targetOpp} onClose={() => setTargetOpp(null)} />
      )}
    </div>
  );
}
