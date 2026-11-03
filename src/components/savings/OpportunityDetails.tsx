'use client';

import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ReferenceLine, Cell,
} from 'recharts';
import { X, Repeat } from 'lucide-react';
import { useBudgetStore } from '@/store/budgetStore';
import { Opportunity } from '@/lib/savings';
import { useChartTheme } from '@/components/charts/chartTheme';
import ChartTooltip from '@/components/charts/ChartTooltip';
import { formatCurrency } from '@/utils/currency';

const labelStyle: React.CSSProperties = {
  fontSize: '0.625rem', fontWeight: 700, color: 'var(--text-400)',
  textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 5,
};

/** Detail modal for a savings opportunity — reasons, score, history chart, txns. */
export default function OpportunityDetails({
  opp, onClose, onSetTarget,
}: {
  opp: Opportunity;
  onClose: () => void;
  onSetTarget?: () => void;
}) {
  const { currency, expenses, recurring } = useBudgetStore();
  const t = useChartTheme();
  const money = (n: number) => formatCurrency(n, currency);

  const txnById = new Map(expenses.map(e => [e.id, e]));
  const txns = opp.relatedTxnIds
    .map(id => txnById.get(id))
    .filter((e): e is NonNullable<typeof e> => !!e)
    .sort((a, b) => b.date.localeCompare(a.date));
  const anomalySet = new Set(opp.anomalyTxnIds);
  const smallSet = new Set(opp.smallTxnIds);
  const recurringSet = new Set(opp.recurringTxnIds);
  const catRules = recurring.filter(r => opp.recurringRuleIds.includes(r.id));

  const tagFor = (id: string) =>
    anomalySet.has(id) ? { label: 'Unusual', color: 'var(--red-600)', bg: 'var(--red-50)' }
    : recurringSet.has(id) ? { label: 'Recurring', color: 'var(--purple-600)', bg: 'var(--purple-50)' }
    : smallSet.has(id) ? { label: 'Small', color: 'var(--amber-600)', bg: 'var(--amber-50)' }
    : null;

  const sb = opp.scoreBreakdown;

  return (
    <div className="sw-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="sw-modal-box" role="dialog" aria-modal="true" aria-label={`${opp.name} opportunity details`} style={{ maxWidth: 640 }}>
        <div style={{ padding: '20px 24px 24px', maxHeight: '80dvh', overflowY: 'auto' }}>
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 36, height: 36, borderRadius: 'var(--r-md)', background: `${opp.color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>
                {opp.icon}
              </div>
              <div>
                <h2 style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--text-900)' }}>{opp.name}</h2>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-400)' }}>{opp.priority} opportunity · score {opp.score}/100</div>
              </div>
            </div>
            <button onClick={onClose} className="sw-modal-close" aria-label="Close"><X size={14} /></button>
          </div>

          {/* Why identified */}
          <div style={{ marginBottom: 16 }}>
            <div style={labelStyle}>Why this was identified</div>
            <ul style={{ margin: 0, paddingLeft: 18, fontSize: '0.8125rem', color: 'var(--text-600)', lineHeight: 1.6 }}>
              {opp.reasons.map((r, i) => <li key={i}>{r}</li>)}
            </ul>
            <p style={{ fontSize: '0.72rem', color: 'var(--text-400)', marginTop: 8, lineHeight: 1.55 }}>{opp.method}</p>
          </div>

          {/* Score breakdown */}
          <div style={{ marginBottom: 16 }}>
            <div style={labelStyle}>Score breakdown</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 8, fontSize: '0.72rem' }}>
              {([
                { label: 'Vs average', v: sb.pct },
                { label: 'Materiality', v: sb.materiality },
                { label: 'Frequency', v: sb.frequency },
                { label: 'Budget', v: sb.budget },
                ...(sb.anomalyPenalty ? [{ label: 'One-off penalty', v: sb.anomalyPenalty }] : []),
                { label: `Class weight ×${sb.classWeight}`, v: null },
              ] as { label: string; v: number | null }[]).map(({ label, v }, i) => (
                <div key={i} style={{ background: 'var(--bg-subtle)', borderRadius: 'var(--r-sm)', padding: '6px 10px' }}>
                  <div style={{ color: 'var(--text-400)', fontSize: '0.625rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
                  <div style={{ fontWeight: 800, color: 'var(--text-800)', fontVariantNumeric: 'tabular-nums' }}>
                    {v === null ? `raw ${Math.round(opp.score / sb.classWeight)}` : v > 0 ? `+${Math.round(v)}` : Math.round(v)}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Subscription line items */}
          {opp.kind === 'subscriptions' && opp.subscriptionItems && (
            <div style={{ marginBottom: 16 }}>
              <div style={labelStyle}>Subscriptions & recurring payments</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {opp.subscriptionItems.map(item => (
                  <div key={item.key} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', background: 'var(--bg-subtle)', borderRadius: 'var(--r-sm)' }}>
                    <Repeat size={11} style={{ color: 'var(--text-300)', flexShrink: 0 }} />
                    <span style={{ flex: 1, fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-800)', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {item.name}
                      {!item.fromRule && <span style={{ marginLeft: 6, fontSize: '0.625rem', color: 'var(--text-400)' }}>(detected)</span>}
                      {item.isEssential && <span style={{ marginLeft: 6, fontSize: '0.625rem', color: 'var(--blue-600)' }}>essential</span>}
                    </span>
                    <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-800)', fontVariantNumeric: 'tabular-nums' }}>{money(item.monthly)}/mo</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* History chart */}
          <div style={{ marginBottom: 16 }}>
            <div style={labelStyle}>Last {opp.history.length} months</div>
            <div role="img" aria-label={`${opp.name} spend history bar chart`} style={{ height: 180 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={opp.history} margin={{ top: 4, right: 4, left: -18, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={t.grid} vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 9, fill: t.axis }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                  <YAxis tick={{ fontSize: 9, fill: t.axis }} tickLine={false} axisLine={false} />
                  <Tooltip content={<ChartTooltip currency={currency} />} cursor={{ fill: 'var(--bg-muted)' }} />
                  {opp.avgMonthly > 0 && (
                    <ReferenceLine y={opp.avgMonthly} stroke={t.budget} strokeDasharray="4 3" label={{ value: 'avg', position: 'right', fontSize: 9, fill: t.axis }} />
                  )}
                  <Bar dataKey="amount" name="Spend" radius={[4, 4, 0, 0]}>
                    {opp.history.map((h, i) => (
                      <Cell key={h.key} fill={i === opp.history.length - 1 ? 'var(--brand-500)' : (opp.color.startsWith('#') ? opp.color : 'var(--text-300)')} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="sr-only">{opp.name} monthly spend: {opp.history.map(h => `${h.label} ${Math.round(h.amount)}`).join(', ')}</div>
          </div>

          {/* Current vs averages + savings */}
          {opp.kind === 'category' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: 8, marginBottom: 16 }}>
              {[
                ['Current', money(opp.currentToDate)],
                ['Avg 3 mo', opp.avg3 !== null ? money(opp.avg3) : '—'],
                ['Avg 6 mo', opp.avg6 !== null ? money(opp.avg6) : '—'],
                ['Avg 12 mo', opp.avg12 !== null ? money(opp.avg12) : '—'],
                ['Suggested target', money(opp.suggestedTarget)],
                ['Est. saving', `${money(opp.estMonthly)}/mo`],
              ].map(([label, v]) => (
                <div key={label} style={{ background: 'var(--bg-subtle)', borderRadius: 'var(--r-sm)', padding: '8px 10px' }}>
                  <div style={{ fontSize: '0.6rem', fontWeight: 700, color: 'var(--text-400)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
                  <div style={{ fontSize: '0.8125rem', fontWeight: 800, color: 'var(--text-900)' }}>{v}</div>
                </div>
              ))}
            </div>
          )}

          {/* Related transactions */}
          {opp.kind === 'category' && txns.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <div style={labelStyle}>Transactions this period ({txns.length})</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3, maxHeight: 200, overflowY: 'auto' }}>
                {txns.map(e => {
                  const tag = tagFor(e.id);
                  return (
                    <div key={e.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', background: 'var(--bg-subtle)', borderRadius: 'var(--r-sm)' }}>
                      <span style={{ fontSize: '0.68rem', color: 'var(--text-400)', flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>{e.date.slice(5)}</span>
                      <span style={{ flex: 1, fontSize: '0.78rem', color: 'var(--text-800)', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {e.description}
                      </span>
                      {tag && (
                        <span style={{ fontSize: '0.6rem', fontWeight: 800, color: tag.color, background: tag.bg, padding: '1px 6px', borderRadius: 99, flexShrink: 0 }}>
                          {tag.label}
                        </span>
                      )}
                      <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-800)', fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>{money(e.amount)}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Recurring rules for the category */}
          {catRules.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <div style={labelStyle}>Recurring rules</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {catRules.map(r => (
                  <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', background: 'var(--bg-subtle)', borderRadius: 'var(--r-sm)' }}>
                    <Repeat size={11} style={{ color: 'var(--text-300)' }} />
                    <span style={{ flex: 1, fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-800)' }}>{r.description}</span>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-400)' }}>{r.frequency}</span>
                    <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-800)' }}>
                      {money(r.frequency === 'weekly' ? r.amount * 52 / 12 : r.frequency === 'monthly' ? r.amount : r.frequency === 'quarterly' ? r.amount / 3 : r.amount / 12)}/mo
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button onClick={onClose} className="ws-cta-btn">Close</button>
            {onSetTarget && (
              <button
                onClick={onSetTarget}
                style={{ padding: '8px 18px', borderRadius: 'var(--r-sm)', border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.8125rem', fontWeight: 700, background: 'var(--brand-600)', color: '#fff' }}
              >
                Set savings target
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
