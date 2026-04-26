import type { ParseHit, ParseContext, RuleParser } from './types';
import { resolveLocalIso, parseTimeOfDay, relativeDayOffset } from './datetime';
import { vnWord } from './word';

const TASK_TRIGGERS = vnWord([
  'họp', 'gặp', 'gọi', 'nhắc', 'task', 'todo', 'làm', 'deadline', 'đến', 'tới', 'đi',
]);
const HIGH_PRIORITY = vnWord(['gấp', 'ngay', 'khẩn', 'deadline', 'asap', 'quan trọng']);
const LOW_PRIORITY = vnWord(['rảnh', 'khi nào', 'lúc nào rảnh', 'nếu có thời gian']);

function deriveTitle(text: string): string {
  const cleaned = text
    .replace(/\b(lúc|vào|tại)\b/gi, '')
    .replace(/\b(sáng|trưa|chiều|tối|đêm|hôm nay|ngày mai|tối nay|tối mai)\b/gi, '')
    .replace(/(\d{1,2})\s*(?::|h|g|giờ)\s*([0-5]\d)?\s*(sáng|trưa|chiều|tối|đêm)?/gi, '')
    .replace(/^(làm|task|todo)\s+/i, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!cleaned) return text.trim();
  return cleaned[0].toUpperCase() + cleaned.slice(1);
}

export class TaskParser implements RuleParser {
  match(text: string, ctx: ParseContext): ParseHit | null {
    const hasTrigger = TASK_TRIGGERS.test(text);
    const hasTime = parseTimeOfDay(text) !== null;
    const hasRelativeDay = relativeDayOffset(text, ctx.now, ctx.tz) !== 0;
    if (!hasTrigger && !hasTime) return null;

    const dueAtIso = hasTime || hasRelativeDay
      ? resolveLocalIso(text, ctx.now, ctx.tz, { defaultHour: 9, defaultMinute: 0 })
      : null;
    const priority = HIGH_PRIORITY.test(text)
      ? 'HIGH'
      : LOW_PRIORITY.test(text)
      ? 'LOW'
      : 'MEDIUM';

    // Confidence: trigger word + time = strong, time alone = medium, trigger alone = medium-high.
    const confidence = hasTrigger && hasTime ? 0.88 : hasTrigger ? 0.75 : 0.55;

    const title = deriveTitle(text);

    return {
      kind: 'TASK',
      source: 'RULE',
      confidence,
      fields: { title, dueAtIso, priority },
      previewText: `✓ ${title}${dueAtIso ? ` — ${formatLocalTime(dueAtIso, ctx.tz)}` : ''}`,
    };
  }
}

function formatLocalTime(iso: string, tz: string): string {
  const off = tz === 'Asia/Ho_Chi_Minh' ? 7 * 60 : 0;
  const local = new Date(new Date(iso).getTime() + off * 60_000);
  const h = String(local.getUTCHours()).padStart(2, '0');
  const m = String(local.getUTCMinutes()).padStart(2, '0');
  return `${h}:${m}`;
}
