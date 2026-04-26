import type { ParseHit, ParseContext, RuleParser } from './types';
import { findMoney } from './money';
import { resolveLocalIso } from './datetime';
import { vnWord } from './word';

const MEAL_VERB = vnWord(['ăn', 'uống']);

const TYPE_KEYWORDS: Array<[RegExp, 'BREAKFAST' | 'LUNCH' | 'DINNER' | 'SNACK']> = [
  [vnWord(['sáng', 'breakfast', 'bữa sáng']), 'BREAKFAST'],
  [vnWord(['trưa', 'lunch', 'bữa trưa']), 'LUNCH'],
  [vnWord(['tối', 'dinner', 'bữa tối']), 'DINNER'],
  [vnWord(['snack', 'đồ ăn vặt', 'ăn vặt', 'chiều']), 'SNACK'],
];

function inferTypeByHour(h: number): 'BREAKFAST' | 'LUNCH' | 'DINNER' | 'SNACK' {
  if (h < 10) return 'BREAKFAST';
  if (h < 14) return 'LUNCH';
  if (h < 17) return 'SNACK';
  return 'DINNER';
}

function deriveTitle(text: string, moneySpan: [number, number] | null): string {
  let s = text;
  if (moneySpan) s = s.slice(0, moneySpan[0]) + s.slice(moneySpan[1]);
  s = s
    .replace(/\b(sáng|trưa|chiều|tối|đêm|hôm qua|tối qua|hôm nay|ngày mai)\b/gi, '')
    .replace(/^(ăn|uống)\s+/i, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!s) return 'Bữa ăn';
  return s[0].toUpperCase() + s.slice(1);
}

export class MealParser implements RuleParser {
  match(text: string, ctx: ParseContext): ParseHit | null {
    const verb = MEAL_VERB.test(text);
    let mealType: 'BREAKFAST' | 'LUNCH' | 'DINNER' | 'SNACK' | null = null;
    for (const [re, k] of TYPE_KEYWORDS) {
      if (re.test(text)) {
        mealType = k;
        break;
      }
    }
    if (!verb && !mealType) return null;

    const money = findMoney(text);
    const loggedAtIso = resolveLocalIso(text, ctx.now, ctx.tz, {
      defaultHour: mealType
        ? mealType === 'BREAKFAST'
          ? 7
          : mealType === 'LUNCH'
          ? 12
          : mealType === 'DINNER'
          ? 19
          : 16
        : new Date(ctx.now).getHours(),
      defaultMinute: 0,
    });
    if (!mealType) {
      const hour = new Date(loggedAtIso).getUTCHours();
      mealType = inferTypeByHour(hour);
    }

    // Confidence: meal verb + cost = strong; only verb = weaker than expense.
    let confidence = 0.55;
    if (verb && money) confidence = 0.9;
    else if (verb) confidence = 0.75;
    else if (mealType) confidence = 0.6;

    const title = deriveTitle(text, money?.span ?? null);

    return {
      kind: 'MEAL',
      source: 'RULE',
      confidence,
      fields: {
        title,
        mealType,
        cost: money?.amount ?? null,
        loggedAtIso,
      },
      previewText: `🍚 ${title}${money ? ` — ${money.amount.toLocaleString('vi-VN')} ₫` : ''}`,
    };
  }
}
