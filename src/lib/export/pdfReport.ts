import { formatCurrency } from '@/utils/currency';

export interface ReportTableSection {
  kind: 'table';
  title: string;
  columns: { key: string; header: string }[];
  rows: Record<string, unknown>[];
  totalsRow?: Record<string, unknown>;
}

export interface ReportChartSection {
  kind: 'barChart';
  title: string;
  /** Each series is a set of bars (e.g. Income, Expenses) */
  series: { label: string; values: number[]; color: string }[];
  /** X-axis category labels, one per value index */
  categories: string[];
}

export interface ReportOptions {
  title: string;
  subtitle?: string;
  dateRangeLabel?: string;
  filtersSummary?: string[];
  generatedAt?: string;
  currency: string;
  summary?: { label: string; value: string }[];
  sections: (ReportTableSection | ReportChartSection)[];
}

/** Escape every user-supplied string before it enters the document. */
function esc(s: unknown): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Inline SVG grouped bar chart — self-contained for print. */
function barChartSVG(section: ReportChartSection, currency: string): string {
  const W = 720, H = 260;
  const padL = 64, padR = 16, padT = 28, padB = 44;
  const plotW = W - padL - padR, plotH = H - padT - padB;

  const maxV = Math.max(1, ...section.series.flatMap(s => s.values));
  const nCats = section.categories.length;
  const nSeries = section.series.length;
  const groupW = plotW / Math.max(1, nCats);
  const barW = Math.max(2, (groupW * 0.7) / Math.max(1, nSeries));

  const y = (v: number) => padT + plotH - (v / maxV) * plotH;
  const niceStep = ((): number => {
    const rough = maxV / 4;
    const pow = Math.pow(10, Math.floor(Math.log10(rough)));
    const m = rough / pow;
    return (m >= 5 ? 5 : m >= 2 ? 2 : 1) * pow;
  })();

  let out = `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" role="img" style="width:100%;height:auto;display:block">`;

  // Gridlines + y labels
  for (let v = 0; v <= maxV; v += niceStep) {
    const yy = y(v);
    out += `<line x1="${padL}" y1="${yy}" x2="${W - padR}" y2="${yy}" stroke="#e2e8f0" stroke-width="1"/>`;
    out += `<text x="${padL - 8}" y="${yy + 4}" font-size="9" fill="#64748b" text-anchor="end">${esc(formatCurrency(v, currency))}</text>`;
  }
  // Baseline
  out += `<line x1="${padL}" y1="${y(0)}" x2="${W - padR}" y2="${y(0)}" stroke="#94a3b8" stroke-width="1.5"/>`;

  // Bars + x labels
  section.categories.forEach((cat, ci) => {
    const gx = padL + ci * groupW;
    section.series.forEach((s, si) => {
      const v = s.values[ci] ?? 0;
      const bx = gx + groupW * 0.15 + si * barW;
      const bh = (v / maxV) * plotH;
      out += `<rect x="${bx.toFixed(1)}" y="${(y(0) - bh).toFixed(1)}" width="${barW.toFixed(1)}" height="${bh.toFixed(1)}" fill="${esc(s.color)}" rx="2">` +
             `<title>${esc(s.label)} ${esc(cat)}: ${esc(formatCurrency(v, currency))}</title></rect>`;
    });
    out += `<text x="${(gx + groupW / 2).toFixed(1)}" y="${H - padB + 14}" font-size="9" fill="#475569" text-anchor="middle">${esc(cat)}</text>`;
  });

  // Legend
  let lx = padL;
  for (const s of section.series) {
    out += `<rect x="${lx}" y="${H - 14}" width="10" height="10" fill="${esc(s.color)}" rx="2"/>`;
    out += `<text x="${lx + 14}" y="${H - 5}" font-size="9" fill="#334155">${esc(s.label)}</text>`;
    lx += 14 + s.label.length * 5.5 + 18;
  }

  out += '</svg>';
  return out;
}

function cellText(v: unknown): string {
  if (v === null || v === undefined) return '—';
  if (typeof v === 'number') return String(Math.round(v * 100) / 100);
  if (typeof v === 'boolean') return v ? 'Yes' : 'No';
  return String(v);
}

const NUM_KEYS = /amount|income|expense|saving|budget|total|deductible|share|avg|pct|rate|signed|spent|remaining|used/i;

/** Heuristic numeric column → right-aligned, currency-formatted via caller-supplied values already being numbers. */
function tableHTML(s: ReportTableSection): string {
  const isNum = (key: string, header: string) => NUM_KEYS.test(key) || NUM_KEYS.test(header);
  const ths = s.columns
    .map(c => `<th style="text-align:${isNum(c.key, c.header) ? 'right' : 'left'}">${esc(c.header)}</th>`)
    .join('');
  const trs = s.rows.map(r =>
    `<tr>${s.columns
      .map(c => `<td style="text-align:${isNum(c.key, c.header) ? 'right' : 'left'}">${esc(cellText(r[c.key]))}</td>`)
      .join('')}</tr>`
  ).join('');
  const tfoot = s.totalsRow
    ? `<tfoot><tr>${s.columns
        .map(c => `<td style="text-align:${isNum(c.key, c.header) ? 'right' : 'left'}">${esc(cellText(s.totalsRow![c.key]))}</td>`)
        .join('')}</tr></tfoot>`
    : '';
  return `<table><thead><tr>${ths}</tr></thead><tbody>${trs}</tbody>${tfoot}</table>`;
}

/**
 * Complete standalone HTML document for print-to-PDF. Light-theme only,
 * A4 portrait, headers repeat on each page, rows/charts avoid splits.
 * Every dynamic string is HTML-escaped.
 */
export function buildReportHTML(opts: ReportOptions): string {
  const generated = opts.generatedAt ?? new Date().toLocaleString('en-IN');

  const summaryCards = (opts.summary ?? []).map(s =>
    `<div class="kpi"><div class="kpi-label">${esc(s.label)}</div><div class="kpi-value">${esc(s.value)}</div></div>`
  ).join('');

  const sections = opts.sections.map(s => {
    if (s.kind === 'table') {
      return `<section class="block"><h2>${esc(s.title)}</h2>${tableHTML(s)}</section>`;
    }
    return `<section class="block chart"><h2>${esc(s.title)}</h2>${barChartSVG(s, opts.currency)}</section>`;
  }).join('\n');

  const filters = (opts.filtersSummary ?? []).filter(Boolean);
  const filtersHtml = filters.length
    ? `<div class="filters">${filters.map(f => `<span class="chip">${esc(f)}</span>`).join('')}</div>`
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${esc(opts.title)}</title>
<style>
  @page { size: A4 portrait; margin: 12mm; }
  * { box-sizing: border-box; }
  body { font-family: system-ui, -apple-system, 'Segoe UI', sans-serif; color: #0f172a; margin: 0; font-size: 11px; }
  header.report-head { border-bottom: 2px solid #0f172a; padding-bottom: 10px; margin-bottom: 14px; }
  h1 { font-size: 20px; margin: 0 0 3px; letter-spacing: -0.02em; }
  .subtitle { color: #475569; font-size: 11.5px; }
  .meta { color: #64748b; font-size: 10px; margin-top: 5px; }
  .filters { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 8px; }
  .chip { background: #f1f5f9; border: 1px solid #cbd5e1; border-radius: 99px; padding: 2px 9px; font-size: 9.5px; color: #334155; }
  .kpis { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 16px; }
  .kpi { flex: 1 1 110px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 8px 12px; }
  .kpi-label { font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: .06em; color: #64748b; }
  .kpi-value { font-size: 15px; font-weight: 800; margin-top: 2px; font-variant-numeric: tabular-nums; }
  section.block { margin-bottom: 18px; }
  section.chart { page-break-inside: avoid; }
  h2 { font-size: 12.5px; margin: 0 0 8px; text-transform: uppercase; letter-spacing: .07em; color: #334155; }
  table { width: 100%; border-collapse: collapse; font-size: 10px; }
  thead { display: table-header-group; }
  tr { page-break-inside: avoid; }
  th { text-align: left; font-size: 8.5px; text-transform: uppercase; letter-spacing: .05em; color: #64748b; border-bottom: 1.5px solid #94a3b8; padding: 5px 6px; }
  td { border-bottom: 1px solid #e2e8f0; padding: 5px 6px; }
  tfoot td { font-weight: 800; border-top: 1.5px solid #94a3b8; border-bottom: none; }
</style>
</head>
<body>
<header class="report-head">
  <h1>${esc(opts.title)}</h1>
  ${opts.subtitle ? `<div class="subtitle">${esc(opts.subtitle)}</div>` : ''}
  ${opts.dateRangeLabel ? `<div class="meta">Period: ${esc(opts.dateRangeLabel)}</div>` : ''}
  <div class="meta">Generated ${esc(generated)} · Spendwise</div>
  ${filtersHtml}
</header>
${summaryCards ? `<div class="kpis">${summaryCards}</div>` : ''}
${sections}
</body>
</html>`;
}
