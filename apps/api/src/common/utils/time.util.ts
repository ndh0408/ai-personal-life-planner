/**
 * Helpers for `@db.Time(0)` columns.
 *
 * Prisma represents PostgreSQL `TIME` as a JavaScript `Date` whose date
 * component is irrelevant — only hours and minutes carry meaning. We
 * standardize on UTC 1970-01-01 so equality checks behave predictably.
 */

const HHMM_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;

export function hhmmToDate(value: string): Date {
  if (!HHMM_REGEX.test(value)) {
    throw new Error(`Invalid HH:mm value: ${value}`);
  }
  const [h, m] = value.split(':').map(Number);
  return new Date(Date.UTC(1970, 0, 1, h, m, 0, 0));
}

export function dateToHhmm(value: Date | null | undefined): string | null {
  if (!value) return null;
  const h = String(value.getUTCHours()).padStart(2, '0');
  const m = String(value.getUTCMinutes()).padStart(2, '0');
  return `${h}:${m}`;
}

const DATE_ONLY_REGEX = /^\d{4}-\d{2}-\d{2}$/;

/** "YYYY-MM-DD" → Date at UTC midnight, suitable for `@db.Date` columns. */
export function dateOnly(value: string): Date {
  if (!DATE_ONLY_REGEX.test(value)) {
    throw new Error(`Invalid YYYY-MM-DD value: ${value}`);
  }
  const [y, m, d] = value.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

/** Date → "YYYY-MM-DD" in UTC. */
export function toDateOnly(value: Date | null | undefined): string | null {
  if (!value) return null;
  return value.toISOString().slice(0, 10);
}
