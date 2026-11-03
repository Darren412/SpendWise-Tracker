'use client';

import { formatCurrency } from '@/utils/currency';
import { getChartTheme } from '@/components/charts/chartTheme';

interface PayloadEntry {
  name?: string | number;
  value?: number | string | (number | string)[];
  color?: string;
  dataKey?: string | number;
}

interface ChartTooltipProps {
  active?: boolean;
  label?: string | number;
  payload?: PayloadEntry[];
  currency: string;
  /** 'currency' (default) or 'percent' value formatting */
  format?: 'currency' | 'percent';
  /** Extra lines appended under the payload (e.g. forecast low–high range) */
  footer?: string[];
}

/** Shared dark/light-aware tooltip for all workspace charts. */
export default function ChartTooltip({ active, label, payload, currency, format = 'currency', footer }: ChartTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;
  const t = getChartTheme();
  const fmt = (v: number | string | (number | string)[] | undefined) => {
    if (typeof v === 'number') return format === 'percent' ? `${v.toFixed(1)}%` : formatCurrency(v, currency);
    if (Array.isArray(v)) return v.map(String).join(', ');
    return v ?? '—';
  };

  return (
    <div style={{
      background: t.tooltipBg,
      border: `1px solid ${t.tooltipBorder}`,
      borderRadius: 8,
      padding: '8px 12px',
      boxShadow: '0 4px 16px rgba(15,23,42,0.12)',
      fontSize: '0.72rem',
      minWidth: 120,
    }}>
      {label !== undefined && (
        <div style={{ fontWeight: 700, color: t.tooltipText, marginBottom: 4 }}>{label}</div>
      )}
      {payload.map((p, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
          <span style={{ width: 8, height: 8, borderRadius: 2, background: p.color ?? t.textMuted, flexShrink: 0 }} />
          <span style={{ color: t.textMuted, flex: 1 }}>{p.name}:</span>
          <span style={{ fontWeight: 700, color: p.color ?? t.tooltipText, fontVariantNumeric: 'tabular-nums' }}>
            {fmt(p.value)}
          </span>
        </div>
      ))}
      {footer?.map((f, i) => (
        <div key={i} style={{ marginTop: 4, fontSize: '0.66rem', color: t.textMuted }}>{f}</div>
      ))}
    </div>
  );
}
