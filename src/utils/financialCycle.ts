/**
 * Financial cycle utilities.
 *
 * A "financial month" is defined by a configurable start day.
 * Example: startDay=25 means the financial month STARTS on the 25th of
 * each calendar month and is LABELLED by the calendar month in which
 * the cycle ENDS (i.e., the next calendar month).
 *
 *   June Financial Month (startDay=25):  May 25 → June 24
 *   July Financial Month (startDay=25): June 25 → July 24
 *
 * When startDay=1, the financial month equals the standard calendar month.
 */

/**
 * Given a date and a cycle start day, returns the financial { month, year } label.
 *
 * - startDay ≤ 1 → standard calendar month (no shift)
 * - startDay > 1 → if calendarDay >= startDay, belongs to the NEXT calendar month
 */
export function getFinancialPeriod(
  date: string | Date,
  startDay: number,
): { month: string; year: number } {
  const d =
    typeof date === 'string'
      ? new Date(date.includes('T') ? date : date + 'T12:00:00')
      : new Date(date);

  let calMonth = d.getMonth() + 1; // 1-12
  let calYear  = d.getFullYear();

  if (startDay > 1 && d.getDate() >= startDay) {
    calMonth += 1;
    if (calMonth > 12) { calMonth = 1; calYear += 1; }
  }

  return { month: calMonth.toString().padStart(2, '0'), year: calYear };
}

/**
 * Returns the start and end Date objects for a given financial month period.
 *
 * @param month    Financial month label ('01'–'12')
 * @param year     Financial year
 * @param startDay Cycle start day (1–28)
 */
export function getFinancialMonthRange(
  month: string,
  year: number,
  startDay: number,
): { start: Date; end: Date } {
  const m = parseInt(month, 10); // 1-12

  if (startDay <= 1) {
    // Standard calendar month
    const start = new Date(year, m - 1, 1);
    const end   = new Date(year, m, 0); // last day of month m
    return { start, end };
  }

  // Previous calendar month is where the cycle starts
  let startMonth = m - 1;
  let startYear  = year;
  if (startMonth < 1) { startMonth = 12; startYear -= 1; }

  const start = new Date(startYear, startMonth - 1, startDay);
  const end   = new Date(year,      m - 1,          startDay - 1);
  return { start, end };
}

/**
 * Returns the current financial period based on today's date.
 */
export function getCurrentFinancialPeriod(
  startDay: number,
): { month: string; year: number } {
  return getFinancialPeriod(new Date(), startDay);
}

/**
 * Formats a financial month range as a human-readable string.
 * E.g. "May 25 – Jun 24" or "Jun 1 – Jun 30"
 */
export function formatFinancialPeriodRange(
  month: string,
  year: number,
  startDay: number,
): string {
  const { start, end } = getFinancialMonthRange(month, year, startDay);
  const fmt = (d: Date) =>
    d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  return `${fmt(start)} – ${fmt(end)}`;
}

/**
 * Human-readable label for the financial cycle start day.
 * E.g. 25 → "25th of each month"
 */
export function cycleDayLabel(day: number): string {
  const suffix = day === 1 ? 'st' : day === 2 ? 'nd' : day === 3 ? 'rd' : 'th';
  return `${day}${suffix} of each month`;
}
