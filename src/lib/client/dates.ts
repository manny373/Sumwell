/**
 * Date helpers for the client layer — pure, deterministic, ISO-8601 strings
 * ("YYYY-MM-DD"). All math runs on UTC so results never depend on the
 * viewer's timezone. Money math happens in cents (see lib/money); date math
 * happens in whole days. No floats anywhere in the money path.
 */

export interface ISODate {
  y: number;
  /** 1-based month. */
  m: number;
  /** 1-based day. */
  d: number;
}

/** Parse "YYYY-MM-DD" into {y, m, d}. Throws on malformed input. */
export function parseISODate(value: string): ISODate {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) {
    throw new Error(`parseISODate: expected YYYY-MM-DD, got "${value}"`);
  }
  const y = Number(match[1]);
  const m = Number(match[2]);
  const d = Number(match[3]);
  if (m < 1 || m > 12 || d < 1 || d > 31) {
    throw new Error(`parseISODate: invalid date "${value}"`);
  }
  return { y, m, d };
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/** Format {y, m, d} back to "YYYY-MM-DD". */
export function formatISODate({ y, m, d }: ISODate): string {
  return `${y}-${pad2(m)}-${pad2(d)}`;
}

/** Epoch milliseconds (UTC midnight) for an ISO date. */
function epochMs(iso: string): number {
  const { y, m, d } = parseISODate(iso);
  return Date.UTC(y, m - 1, d);
}

/** Days in a 1-based month, handling leap years. */
export function daysInMonth(y: number, m: number): number {
  // Date.UTC(y, m, 0) is the last day of month m (m is 1-based).
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

/** Add a whole number of days to an ISO date. */
export function addDays(iso: string, days: number): string {
  const ms = epochMs(iso) + days * 86_400_000;
  return new Date(ms).toISOString().slice(0, 10);
}

/** Whole days between two ISO dates: b − a in days (can be negative). */
export function daysBetween(aISO: string, bISO: string): number {
  return Math.round((epochMs(bISO) - epochMs(aISO)) / 86_400_000);
}

/**
 * First monthly occurrence of `dueDay` strictly AFTER `afterISO`. Days past
 * the month's length clamp to the last day of that month (dueDay 31 → Apr 30).
 * Walks at most 12 months forward (12 is always enough for a 1–31 day).
 */
export function nextMonthlyOccurrence(dueDay: number, afterISO: string): string {
  if (!Number.isInteger(dueDay) || dueDay < 1 || dueDay > 31) {
    throw new Error(`nextMonthlyOccurrence: dueDay must be 1–31, got ${dueDay}`);
  }
  const after = parseISODate(afterISO);
  for (let offset = 0; offset < 12; offset++) {
    const monthsFromStart = after.y * 12 + (after.m - 1) + offset;
    const y = Math.floor(monthsFromStart / 12);
    const m = (monthsFromStart % 12) + 1;
    const candidate = formatISODate({ y, m, d: Math.min(dueDay, daysInMonth(y, m)) });
    if (candidate > afterISO) return candidate;
  }
  throw new Error(`nextMonthlyOccurrence: no occurrence found for day ${dueDay}`);
}

const monthDayFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});

const weekdayMonthDayFormatter = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});

/** "Sep 25" (UTC-anchored, deterministic). */
export function formatMonthDay(iso: string): string {
  const { y, m, d } = parseISODate(iso);
  return monthDayFormatter.format(new Date(Date.UTC(y, m - 1, d)));
}

/** "Fri, Sep 25". */
export function formatWeekdayMonthDay(iso: string): string {
  const { y, m, d } = parseISODate(iso);
  return weekdayMonthDayFormatter.format(new Date(Date.UTC(y, m - 1, d)));
}

/** Today as an ISO date, in the viewer's LOCAL timezone. */
export function todayISO(): string {
  const now = new Date();
  return formatISODate({ y: now.getFullYear(), m: now.getMonth() + 1, d: now.getDate() });
}

/** "today" / "tomorrow" / "in 13 days". Input must be a non-negative integer. */
export function relativeDaysLabel(days: number): string {
  if (!Number.isInteger(days) || days < 0) {
    throw new Error(`relativeDaysLabel: expected a non-negative integer, got ${days}`);
  }
  if (days === 0) return "today";
  if (days === 1) return "tomorrow";
  return `in ${days} days`;
}