/** Shared date helpers mirrored with server working-day rules. */

export function parseDate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d, 12, 0, 0, 0);
}

export function formatDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function isWeekend(date: Date): boolean {
  const day = date.getDay();
  return day === 0 || day === 6;
}

export function addCalendarDays(iso: string, days: number): string {
  const d = parseDate(iso);
  d.setDate(d.getDate() + days);
  return formatDate(d);
}

/** Shift start by N calendar days then snap off weekend forward to Mon. */
export function shiftStartByDays(iso: string, deltaDays: number): string {
  const d = parseDate(iso);
  d.setDate(d.getDate() + deltaDays);
  while (isWeekend(d)) d.setDate(d.getDate() + 1);
  return formatDate(d);
}

export function startOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day; // Monday start
  d.setDate(d.getDate() + diff);
  return d;
}

export function eachDay(from: Date, to: Date): Date[] {
  const out: Date[] = [];
  const cur = new Date(from);
  while (cur <= to) {
    out.push(new Date(cur));
    cur.setDate(cur.getDate() + 1);
  }
  return out;
}

export function daysBetween(a: string, b: string): number {
  const ms = parseDate(b).getTime() - parseDate(a).getTime();
  return Math.round(ms / (24 * 60 * 60 * 1000));
}
