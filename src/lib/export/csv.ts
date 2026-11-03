import { safeCell } from '@/lib/export/sanitize';

export interface CsvColumn {
  key: string;
  header: string;
}

export interface CsvDataset {
  columns: CsvColumn[];
  rows: Record<string, unknown>[];
  /** Optional trailing totals row (same keys as `rows`). */
  totals?: Record<string, unknown>;
}

function formatCell(v: unknown): string {
  if (v === null || v === undefined) return '';
  if (typeof v === 'number') {
    // Raw numbers — no thousands separators, max 2 decimals
    return String(Math.round(v * 100) / 100);
  }
  if (typeof v === 'boolean') return v ? 'Yes' : 'No';
  let s = safeCell(String(v));
  // RFC 4180: quotes doubled; quote when the field contains comma/quote/CR/LF
  if (/[",\r\n]/.test(s)) s = `"${s.replace(/"/g, '""')}"`;
  return s;
}

/**
 * RFC 4180 CSV: BOM-prefixed UTF-8, CRLF line endings, minimal quoting.
 * String cells pass through the formula-injection guard.
 */
export function toCSV(
  columns: CsvColumn[],
  rows: Record<string, unknown>[],
  totals?: Record<string, unknown>
): string {
  const escHeader = (h: string) => (/[",\r\n]/.test(h) ? `"${h.replace(/"/g, '""')}"` : h);
  const lines = [columns.map(c => escHeader(c.header)).join(',')];
  for (const row of rows) {
    lines.push(columns.map(c => formatCell(row[c.key])).join(','));
  }
  if (totals) {
    lines.push(columns.map(c => formatCell(totals[c.key])).join(','));
  }
  return '﻿' + lines.join('\r\n') + '\r\n';
}
