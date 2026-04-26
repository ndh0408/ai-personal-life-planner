/**
 * Time-window helpers in user-local terms. We keep them tz-aware so the
 * "today" boundary is midnight in user time, not UTC midnight.
 *
 * Currently the only supported tz is Asia/Ho_Chi_Minh (GMT+7, no DST). Add
 * more by extending offsetMinFor() — keeping things explicit beats pulling
 * in a date library for what we need today.
 */

const HCM_OFFSET_MIN = 7 * 60;

function offsetMinFor(tz: string): number {
  return tz === 'Asia/Ho_Chi_Minh' ? HCM_OFFSET_MIN : 0;
}

function localParts(now: Date, tz: string) {
  const local = new Date(now.getTime() + offsetMinFor(tz) * 60_000);
  return {
    y: local.getUTCFullYear(),
    m: local.getUTCMonth(),
    d: local.getUTCDate(),
    weekday: local.getUTCDay(), // 0..6, Sun..Sat
  };
}

function utcAt(tz: string, y: number, m: number, d: number, h = 0, min = 0): Date {
  return new Date(Date.UTC(y, m, d, h, min) - offsetMinFor(tz) * 60_000);
}

export interface Range {
  start: Date;
  end: Date;
}

export type RangeName = 'today' | 'yesterday' | 'week' | 'month';

export function rangeFor(name: RangeName, now = new Date(), tz = 'Asia/Ho_Chi_Minh'): Range {
  const { y, m, d, weekday } = localParts(now, tz);
  switch (name) {
    case 'today': {
      return { start: utcAt(tz, y, m, d), end: utcAt(tz, y, m, d + 1) };
    }
    case 'yesterday': {
      return { start: utcAt(tz, y, m, d - 1), end: utcAt(tz, y, m, d) };
    }
    case 'week': {
      // Vietnam week starts Monday — back up to last Monday.
      const offsetToMon = weekday === 0 ? 6 : weekday - 1;
      return { start: utcAt(tz, y, m, d - offsetToMon), end: utcAt(tz, y, m, d + (7 - offsetToMon)) };
    }
    case 'month': {
      return { start: utcAt(tz, y, m, 1), end: utcAt(tz, y, m + 1, 1) };
    }
  }
}
