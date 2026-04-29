import type { ParseHit, ParseContext, RuleParser } from './types';
import { vnWord } from './word';

const SLEEP_TRIGGER = vnWord(['ngủ', 'sleep']);
const HOURS_PHRASE = /(\d+(?:[\.,]\d+)?)\s*(?:tiếng|giờ|h)(?![\p{L}\p{N}])/iu;

/**
 * "ngủ lúc 23h dậy 7h" / "ngủ 1h dậy 7" / "sleep at 11pm wake 6am"
 *  Captures sleep time in group 1 (and meridiem in 2), wake time in group 3
 *  (and meridiem in 4).
 */
const WINDOW_PHRASE =
  /ng[uủ]\s*(?:lúc\s*)?(\d{1,2})(?::(\d{2}))?\s*(?:h|giờ)?\s*(am|pm|sáng|tối|chiều|đêm)?[^\d]*?dậy\s*(\d{1,2})(?::(\d{2}))?\s*(?:h|giờ)?\s*(am|pm|sáng|tối|chiều)?/iu;

const QUALITY_GOOD = vnWord(['ngon', 'tốt', 'sâu', 'đầy đủ', 'good', 'great']);
const QUALITY_BAD = vnWord(['tệ', 'kém', 'trằn trọc', 'khó ngủ', 'bad']);

const HCM_OFFSET_MIN = 7 * 60;
function offsetMin(tz: string): number {
  return tz === 'Asia/Ho_Chi_Minh' ? HCM_OFFSET_MIN : 0;
}

function localParts(now: Date, tz: string) {
  const local = new Date(now.getTime() + offsetMin(tz) * 60_000);
  return {
    y: local.getUTCFullYear(),
    m: local.getUTCMonth(),
    d: local.getUTCDate(),
  };
}

function isoAt(tz: string, y: number, m: number, d: number, h: number, min: number): string {
  return new Date(Date.UTC(y, m, d, h, min) - offsetMin(tz) * 60_000).toISOString();
}

/**
 * Resolve a clock hour given an optional period word.
 *  - "11pm" / "11 tối" / "11 đêm" → 23
 *  - "1am"  / "1 sáng"          → 1
 *  - "1"   (sleep context, no period) → 1 if very small, but typically the
 *    user meant 01:00; the caller decides whether that's overnight.
 */
function resolveHour(raw: number, period: string | undefined): number {
  if (!period) return raw % 24;
  const p = period.toLowerCase();
  if (p === 'pm' || p === 'tối' || p === 'đêm' || p === 'chiều') {
    if (raw >= 1 && raw <= 11) return raw + 12;
  }
  if (p === 'am' || p === 'sáng') {
    if (raw === 12) return 0;
  }
  return raw % 24;
}

export class SleepParser implements RuleParser {
  match(text: string, ctx: ParseContext): ParseHit | null {
    if (!SLEEP_TRIGGER.test(text)) return null;

    // Pattern A — explicit window "ngủ lúc X dậy Y"
    const win = WINDOW_PHRASE.exec(text);
    if (win) {
      const sleepRaw = Number(win[1]);
      const sleepMin = win[2] ? Number(win[2]) : 0;
      const sleepPeriod = win[3];
      const wakeRaw = Number(win[4]);
      const wakeMin = win[5] ? Number(win[5]) : 0;
      const wakePeriod = win[6];

      let sleepHour = resolveHour(sleepRaw, sleepPeriod);
      const wakeHour = resolveHour(wakeRaw, wakePeriod);

      // Heuristic: if user wrote "ngủ 1 dậy 7" with no period, "1" is almost
      // always 01:00 (after midnight). Same for 22..24 → likely PM/late.
      // We default sleepHour as-is; the overnight math below handles it.

      const { y, m, d } = localParts(ctx.now, ctx.tz);

      // Build candidate timestamps. Interpret the wake time as today's local
      // morning by default — typical use ("ngủ lúc 23h dậy 6h" said at 09:00)
      // means "last night 23 → this morning 06".
      let wakeAt = new Date(isoAt(ctx.tz, y, m, d, wakeHour, wakeMin));
      let sleepAt = new Date(isoAt(ctx.tz, y, m, d, sleepHour, 0));
      // If sleep hour is later than wake hour OR equal (both clock times), the
      // sleep crosses midnight: push sleep back one day.
      if (sleepHour >= wakeHour) {
        sleepAt = new Date(sleepAt.getTime() - 24 * 60 * 60_000);
      }
      // Apply minutes to the sleep timestamp (we built it at :00 above).
      sleepAt = new Date(sleepAt.getTime() + sleepMin * 60_000);

      const durationMinutes = Math.round((wakeAt.getTime() - sleepAt.getTime()) / 60_000);
      if (durationMinutes < 30 || durationMinutes > 16 * 60) return null;

      const quality = QUALITY_GOOD.test(text) ? 'GOOD' : QUALITY_BAD.test(text) ? 'BAD' : null;
      const hours = (durationMinutes / 60).toFixed(1);

      return {
        kind: 'SLEEP',
        source: 'RULE',
        confidence: 0.92,
        fields: {
          sleepAtIso: sleepAt.toISOString(),
          wakeAtIso: wakeAt.toISOString(),
          durationMinutes,
          quality,
        },
        previewText: `${pad(sleepHour)}:${pad(sleepMin)} → ${pad(wakeHour)}:${pad(wakeMin)} (${hours}h)`,
      };
    }

    // Pattern B — duration only "ngủ 7 tiếng"
    const m = HOURS_PHRASE.exec(text);
    if (!m) return null;

    const hours = Number(m[1].replace(',', '.'));
    if (!Number.isFinite(hours) || hours < 0.5 || hours > 16) return null;
    const durationMinutes = Math.round(hours * 60);

    const { y, m: mo, d } = localParts(ctx.now, ctx.tz);
    const wakeAtIso = isoAt(ctx.tz, y, mo, d, 7, 0);
    const sleepAtIso = new Date(
      new Date(wakeAtIso).getTime() - durationMinutes * 60_000,
    ).toISOString();

    const quality = QUALITY_GOOD.test(text) ? 'GOOD' : QUALITY_BAD.test(text) ? 'BAD' : null;

    return {
      kind: 'SLEEP',
      source: 'RULE',
      confidence: 0.9,
      fields: { sleepAtIso, wakeAtIso, durationMinutes, quality },
      previewText: `${hours} tiếng${quality ? ` (${quality === 'GOOD' ? 'ngon' : 'tệ'})` : ''}`,
    };
  }
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}
