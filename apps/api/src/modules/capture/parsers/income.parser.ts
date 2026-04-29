/**
 * Detects financial INCOME from a Vietnamese sentence: "lương 15tr",
 * "thưởng tết 5 triệu", "freelance được 3tr". Triggers + money required —
 * a bare amount without an income verb stays with ExpenseParser at lower
 * confidence (caller orchestrator picks the higher).
 *
 * Categorises into one of: salary, bonus, freelance, gift, refund, investment,
 * other. The OpenAI fallback can override if the rule pass returns < 0.7.
 */
import type { ParseHit, ParseContext, RuleParser } from './types';
import { findMoney } from './money';
import { resolveLocalIso } from './datetime';
import { vnWord } from './word';

const INCOME_TRIGGERS = vnWord([
  'lương',
  'thưởng',
  'nhận',
  'được trả',
  'được nhận',
  'được',
  'hoàn',
  'hoàn tiền',
  'income',
  'salary',
  'bonus',
  'paycheck',
  'tiền về',
  'thu nhập',
  'freelance',
  'cổ tức',
  'dividend',
  'lãi',
]);

const CATEGORY_BY_KEYWORD: Array<[RegExp, string]> = [
  [vnWord(['lương', 'salary', 'paycheck']), 'salary'],
  [vnWord(['thưởng', 'bonus', 'tiền tết']), 'bonus'],
  [vnWord(['freelance', 'job', 'dự án', 'project', 'side']), 'freelance'],
  [vnWord(['quà', 'tặng', 'mừng', 'gift', 'biếu']), 'gift'],
  [vnWord(['hoàn', 'refund', 'trả lại', 'hoàn tiền']), 'refund'],
  [vnWord(['lãi', 'cổ tức', 'dividend', 'đầu tư', 'investment']), 'investment'],
];

function categoryOf(text: string): string {
  for (const [re, cat] of CATEGORY_BY_KEYWORD) if (re.test(text)) return cat;
  return 'other';
}

function deriveTitle(text: string, span: [number, number]): string {
  const prefix = text.slice(0, span[0]).trim();
  const suffix = text.slice(span[1]).trim();
  const stitched = (prefix + ' ' + suffix).replace(/\s+/g, ' ').trim();
  // Drop leading income verb so "lương tháng 4" → "Tháng 4" stays meaningful.
  const cleaned = stitched
    .replace(/^(nhận|được|trả|hoàn)\s+/i, '')
    .trim();
  if (!cleaned) return text.trim();
  return cleaned[0].toUpperCase() + cleaned.slice(1);
}

function formatVnd(n: number): string {
  return n.toLocaleString('vi-VN') + ' ₫';
}

export class IncomeParser implements RuleParser {
  match(text: string, ctx: ParseContext): ParseHit | null {
    const money = findMoney(text);
    if (!money) return null;
    if (!INCOME_TRIGGERS.test(text)) return null;

    const incomeDateIso = resolveLocalIso(text, ctx.now, ctx.tz, {
      defaultHour: 12,
      defaultMinute: 0,
    });
    const title = deriveTitle(text, money.span);
    const category = categoryOf(text);

    return {
      kind: 'INCOME',
      source: 'RULE',
      // Income trigger + money is a strong signal — beats raw expense (0.7).
      confidence: 0.93,
      fields: {
        title,
        amount: money.amount,
        currency: 'VND',
        category,
        incomeDateIso,
      },
      previewText: `💰 ${title} — +${formatVnd(money.amount)}`,
    };
  }
}
