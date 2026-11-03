/**
 * Spreadsheet formula-injection guard: free-text cells that start with a
 * formula trigger (=, +, -, @, tab or CR) are prefixed with a single quote
 * so Excel/Sheets treats them as text. Apply ONLY to user-entered strings —
 * never to numbers, dates, or generated headers.
 */
export function safeCell(v: string): string {
  return /^[=+\-@\t\r]/.test(v) ? `'${v}` : v;
}
