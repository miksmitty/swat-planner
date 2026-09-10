/** Working-day constants (documented in README). */
export const DAYS_PER_WEEK = 5;
export const DAYS_PER_MONTH = 20;

/**
 * Convert effort amount + unit to working days.
 * Complexity is intentionally ignored — label only.
 */
export function effortToWorkingDays(amount, unit) {
  const n = Number(amount);
  if (!Number.isFinite(n) || n < 0) return 0;
  switch (unit) {
    case 'days':
      return n;
    case 'weeks':
      return n * DAYS_PER_WEEK;
    case 'months':
      return n * DAYS_PER_MONTH;
    default:
      return n;
  }
}

/**
 * Parallel multi-assign: calendar_working_days = effort_working_days / sum(FTEs)
 */
export function calendarWorkingDays(effortWorkingDays, ftes) {
  const sum = (ftes || []).reduce((a, f) => a + (Number(f) || 0), 0);
  if (sum <= 0) return effortWorkingDays;
  return effortWorkingDays / sum;
}

/** Parse YYYY-MM-DD as local calendar date (noon to avoid DST edge cases). */
export function parseDate(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d, 12, 0, 0, 0);
}

export function formatDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function isWeekend(date) {
  const day = date.getDay();
  return day === 0 || day === 6;
}

/**
 * Add `workingDays` working days to start (skipping weekends).
 * Fractional days round up so a bar always covers at least the ceil'd span.
 * End date is the last working day included in the span.
 */
export function addWorkingDays(startIso, workingDays) {
  if (workingDays <= 0) return startIso;
  const daysNeeded = Math.max(1, Math.ceil(workingDays - 1e-9));
  const date = parseDate(startIso);
  // If start falls on weekend, move to next Monday first
  while (isWeekend(date)) {
    date.setDate(date.getDate() + 1);
  }
  let remaining = daysNeeded - 1; // start day counts as day 1
  while (remaining > 0) {
    date.setDate(date.getDate() + 1);
    if (!isWeekend(date)) remaining -= 1;
  }
  return formatDate(date);
}

/**
 * Given start + calendar working days, return { start_date, end_date, calendar_working_days }
 */
export function computeSpan(startDate, effortAmount, effortUnit, ftes) {
  const effortWd = effortToWorkingDays(effortAmount, effortUnit);
  const calWd = calendarWorkingDays(effortWd, ftes);
  const end = addWorkingDays(startDate, calWd);
  return {
    effort_working_days: effortWd,
    calendar_working_days: calWd,
    start_date: startDate,
    end_date: end,
  };
}
