import type { ParseHit, ParseContext, RuleParser } from './types';
import { findMoney } from './money';
import { resolveLocalIso } from './datetime';
import { vnWord } from './word';

const SPEND_TRIGGERS = vnWord(['ăn', 'uống', 'mua', 'tiêu', 'chi', 'trả', 'đổ', 'đi']);

const CATEGORY_BY_KEYWORD: Array<[RegExp, string]> = [
  [vnWord(['ăn', 'uống', 'cà phê', 'cafe', 'cf', 'trà sữa', 'cơm', 'phở', 'bún', 'bánh']), 'food'],
  [vnWord(['grab', 'taxi', 'xăng', 'xe ôm', 'xe buýt', 'đổ xăng', 'gửi xe', 'parking']), 'transport'],
  [vnWord(['điện', 'nước', 'internet', 'net', 'wifi', 'fpt', 'viettel']), 'utility'],
  [vnWord(['sách', 'khoá học', 'khóa học', 'học phí', 'học']), 'learning'],
  [vnWord(['thuốc', 'khám', 'bác sĩ', 'bs', 'viện phí']), 'health'],
  [vnWord(['quần áo', 'áo', 'giày', 'mũ', 'nón']), 'clothes'],
];

function categoryOf(text: string): string {
  for (const [re, cat] of CATEGORY_BY_KEYWORD) if (re.test(text)) return cat;
  return 'other';
}

/** Strip the money mention + suffix from the title so it doesn't read as "ăn 75k". */
function deriveTitle(text: string, span: [number, number]): string {
  const prefix = text.slice(0, span[0]).trim();
  const suffix = text.slice(span[1]).trim();
  const stitched = (prefix + ' ' + suffix).replace(/\s+/g, ' ').trim();
  // Drop leading verb so "ăn cơm tấm" → "Cơm tấm"
  const cleaned = stitched.replace(/^(ăn|uống|mua|tiêu|chi|trả|đổ|đi)\s+/i, '').trim();
  if (!cleaned) return text.trim();
  return cleaned[0].toUpperCase() + cleaned.slice(1);
}

function formatVnd(n: number): string {
  return n.toLocaleString('vi-VN') + ' ₫';
}

export class ExpenseParser implements RuleParser {
  match(text: string, ctx: ParseContext): ParseHit | null {
    const money = findMoney(text);
    if (!money) return null;

    const hasTrigger = SPEND_TRIGGERS.test(text);
    // Money + a spend verb is high-confidence; money alone is medium.
    const confidence = hasTrigger ? 0.92 : 0.7;

    const expenseDateIso = resolveLocalIso(text, ctx.now, ctx.tz, {
      defaultHour: 12,
      defaultMinute: 0,
    });
    const title = deriveTitle(text, money.span);
    const category = categoryOf(text);

    return {
      kind: 'EXPENSE',
      source: 'RULE',
      confidence,
      fields: {
        title,
        amount: money.amount,
        currency: 'VND',
        category,
        expenseDateIso,
      },
      previewText: `💸 ${title} — ${formatVnd(money.amount)}`,
    };
  }
}
