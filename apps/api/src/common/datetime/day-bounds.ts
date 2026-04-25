/**
 * Timezone-aware day boundaries.
 *
 * Background: previous code used `new Date('YYYY-MM-DDT00:00:00Z')` for the
 * "start of today" calculation, which is correct only for UTC users. A user
 * in `Asia/Ho_Chi_Minh` querying their daily report at 22:00 ICT was getting
 * a window that started ~7 hours into their local day.
 *
 * Strategy: compute the wall-clock midnight in the user's timezone, then
 * find the equivalent UTC instant. We use Intl rather than dragging in
 * dayjs/luxon — same pattern AiUsageService already uses.
 */

const FMT_CACHE = new Map<string, Intl.DateTimeFormat>();

function fmt(timezone: string): Intl.DateTimeFormat {
  let f = FMT_CACHE.get(timezone);
  if (!f) {
    f = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
    FMT_CACHE.set(timezone, f);
  }
  return f;
}

/**
 * Returns `{from, to}` where `from` is the UTC instant that corresponds to
 * the start of `dateStr` (YYYY-MM-DD) in the user's timezone, and `to` is
 * 24h later. Also handles DST transitions sanely (24h difference may be 23
 * or 25 hours of wall-clock — we always return exactly 24h, which is what
 * day-aggregations expect).
 */
export function getUserDayBounds(dateStr: string, timezone: string): { from: Date; to: Date } {
  const probe = new Date(`${dateStr}T12:00:00Z`); // mid-day probe avoids DST edges
  const offsetMs = utcOffsetMs(probe, timezone);
  const localMidnightUtc = new Date(`${dateStr}T00:00:00Z`).getTime() - offsetMs;
  const from = new Date(localMidnightUtc);
  const to = new Date(localMidnightUtc + 24 * 60 * 60_000);
  return { from, to };
}

/**
 * Returns `{from, to}` where `from` is the UTC instant corresponding to the
 * first day of `month` (YYYY-MM) at 00:00 in the user's timezone, and `to`
 * is the same instant of the next month. Calendar-aware: handles 28/29/30/31
 * day months automatically.
 */
export function getUserMonthBounds(month: string, timezone: string): { from: Date; to: Date } {
  const [yStr, mStr] = month.split('-');
  const y = Number(yStr);
  const m = Number(mStr);
  if (!Number.isFinite(y) || !Number.isFinite(m) || m < 1 || m > 12) {
    throw new Error(`Invalid month: ${month}`);
  }
  const fromStr = `${yStr}-${mStr.padStart(2, '0')}-01`;
  const nextMonth = m === 12 ? 1 : m + 1;
  const nextYear = m === 12 ? y + 1 : y;
  const toStr = `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`;
  const from = getUserDayBounds(fromStr, timezone).from;
  const to = getUserDayBounds(toStr, timezone).from;
  return { from, to };
}

/**
 * Compute the UTC offset (in ms) of `instant` as observed in `timezone`.
 * Positive for east-of-UTC zones (e.g. +25_200_000 for ICT).
 */
function utcOffsetMs(instant: Date, timezone: string): number {
  const parts = fmt(timezone).formatToParts(instant);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  // The wall-clock time the timezone shows for `instant`.
  const localAsUtc = Date.UTC(
    get('year'),
    get('month') - 1,
    get('day'),
    get('hour'),
    get('minute'),
    get('second'),
  );
  return localAsUtc - instant.getTime();
}
