import type { ParseHit, ParseContext, RuleParser } from './types';
import { vnWord } from './word';

const SLEEP_TRIGGER = vnWord(['ngủ', 'sleep']);
const HOURS_PHRASE = /(\d+(?:[\.,]\d+)?)\s*(?:tiếng|giờ|h)(?![\p{L}\p{N}])/iu;
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

export class SleepParser implements RuleParser {
  match(text: string, ctx: ParseContext): ParseHit | null {
    if (!SLEEP_TRIGGER.test(text)) return null;
    const m = HOURS_PHRASE.exec(text);
    if (!m) return null;

    const hours = Number(m[1].replace(',', '.'));
    if (!Number.isFinite(hours) || hours < 0.5 || hours > 16) return null;
    const durationMinutes = Math.round(hours * 60);

    // Default sleep window: anchor wake at usual morning (07:00 local) and
    // back-derive sleep time. "tối qua" → wake = today 07:00.
    const { y, m: mo, d } = localParts(ctx.now, ctx.tz);
    const wakeAtIso = isoAt(ctx.tz, y, mo, d, 7, 0);
    const sleepAtIso = new Date(new Date(wakeAtIso).getTime() - durationMinutes * 60_000).toISOString();

    const quality = QUALITY_GOOD.test(text) ? 'GOOD' : QUALITY_BAD.test(text) ? 'BAD' : null;

    const confidence = HOURS_PHRASE.test(text) ? 0.9 : 0.6;

    return {
      kind: 'SLEEP',
      source: 'RULE',
      confidence,
      fields: { sleepAtIso, wakeAtIso, durationMinutes, quality },
      previewText: `💤 ${hours} tiếng${quality ? ` (${quality === 'GOOD' ? 'ngon' : 'tệ'})` : ''}`,
    };
  }
}
