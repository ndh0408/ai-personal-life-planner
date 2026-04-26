/**
 * Lightweight Vietnamese-aware date heuristics for the Quick Capture parser.
 * No moment/dayjs — we don't need locale formatting, only relative-day math
 * and "HH:mm" extraction.
 *
 * Inputs are timezone-aware in the sense that callers pass their "now" already
 * in user-local terms; this module returns ISO strings preserving that local
 * wall-clock by computing offsets via the supplied tz.
 */

const HCM_OFFSET_MIN = 7 * 60; // GMT+7 — only tz we currently support

function offsetMinFor(tz: string): number {
  return tz === 'Asia/Ho_Chi_Minh' ? HCM_OFFSET_MIN : 0;
}

/** Build an ISO string for the given y/m/d/h/m in the given tz. */
function isoAt(
  tz: string,
  year: number,
  month0: number,
  day: number,
  hours: number,
  minutes: number,
): string {
  const utcMs = Date.UTC(year, month0, day, hours, minutes) - offsetMinFor(tz) * 60_000;
  return new Date(utcMs).toISOString();
}

/** Return Y/M/D/H/M components of `now` in the user's tz. */
function localParts(now: Date, tz: string) {
  const offMs = offsetMinFor(tz) * 60_000;
  const local = new Date(now.getTime() + offMs);
  return {
    y: local.getUTCFullYear(),
    m: local.getUTCMonth(),
    d: local.getUTCDate(),
    h: local.getUTCHours(),
    min: local.getUTCMinutes(),
  };
}

/**
 * Parse phrases like "8h", "8:30", "8h30", "20:15" into 24h time.
 * Returns { hours, minutes } or null.
 */
export function parseTimeOfDay(s: string): { hours: number; minutes: number } | null {
  const m =
    /(?:^|[^0-9])([01]?\d|2[0-3])\s*(?::|h|g|giờ)\s*([0-5]\d)?(?:\s*(sáng|trưa|chiều|tối|đêm))?/i.exec(
      s,
    );
  if (!m) return null;
  let h = Number(m[1]);
  const mins = m[2] ? Number(m[2]) : 0;
  const period = (m[3] ?? '').toLowerCase();
  if (period === 'chiều' || period === 'tối' || period === 'đêm') {
    if (h >= 1 && h <= 11) h += 12;
  }
  return { hours: h % 24, minutes: mins };
}

/**
 * Resolve relative-day words to a date offset (today=0, yesterday=-1, …).
 * "cuối tuần" / "weekend" → next Saturday from today.
 *   - if today is Sat → 0 (today)
 *   - if today is Sun → +6 (next Sat)
 *   - else → days until Saturday
 */
export function relativeDayOffset(text: string, now = new Date(), tz = 'Asia/Ho_Chi_Minh'): number {
  const t = text.toLowerCase();
  if (/\bhôm\s*qua\b/.test(t) || /\btối\s*qua\b/.test(t) || /\bđêm\s*qua\b/.test(t)) return -1;
  if (/\bhôm\s*kia\b/.test(t)) return -2;
  if (/\bngày\s*mai\b/.test(t) || /\bsáng\s*mai\b/.test(t) || /\btối\s*mai\b/.test(t)) return 1;
  if (/\bngày\s*kia\b/.test(t)) return 2;
  if (/\bcuối\s*tuần\b/.test(t) || /\bweekend\b/.test(t)) {
    const local = new Date(now.getTime() + offsetMinFor(tz) * 60_000);
    const wd = local.getUTCDay(); // 0=Sun, 6=Sat
    if (wd === 6) return 0;
    if (wd === 0) return 6;
    return 6 - wd; // days to Saturday
  }
  return 0;
}

/**
 * Combine relative-day + parsed time into a concrete ISO string in the user's tz.
 * If no time was given, defaults to noon for "meal-ish" and 09:00 for tasks.
 */
export function resolveLocalIso(
  text: string,
  now: Date,
  tz: string,
  opts: { defaultHour?: number; defaultMinute?: number } = {},
): string {
  const { y, m, d } = localParts(now, tz);
  const offset = relativeDayOffset(text, now, tz);
  const time = parseTimeOfDay(text);
  const baseHour = time?.hours ?? opts.defaultHour ?? 12;
  const baseMin = time?.minutes ?? opts.defaultMinute ?? 0;
  const day = d + offset;
  return isoAt(tz, y, m, day, baseHour, baseMin);
}

export function startOfTodayIso(now: Date, tz: string): string {
  const { y, m, d } = localParts(now, tz);
  return isoAt(tz, y, m, d, 0, 0);
}
