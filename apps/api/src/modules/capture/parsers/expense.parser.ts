import type { ParseHit, ParseContext, RuleParser } from './types';
import { findMoney } from './money';
import { resolveLocalIso } from './datetime';
import { vnWord } from './word';

const SPEND_TRIGGERS = vnWord(['ăn', 'uống', 'mua', 'tiêu', 'chi', 'trả', 'đổ', 'đi']);

const CATEGORY_BY_KEYWORD: Array<[RegExp, string]> = [
  // Food & drink — broadest keyword set, runs first so "ăn 50k" doesn't fall through.
  [
    vnWord([
      'ăn', 'uống', 'cà phê', 'cafe', 'cf', 'trà sữa', 'cơm', 'phở', 'bún', 'bánh',
      'mì', 'lẩu', 'nướng', 'gà', 'bò', 'thịt', 'rau', 'sữa', 'bia', 'rượu',
      'nhậu', 'highlands', 'starbucks', 'kfc', 'lotte', 'pizza',
    ]),
    'food',
  ],
  // Transport
  [
    vnWord([
      'grab', 'taxi', 'xăng', 'xe ôm', 'xe buýt', 'xe khách', 'đổ xăng', 'gửi xe',
      'parking', 'be', 'gojek', 'vé tàu', 'vé máy bay', 'vé xe', 'flight',
    ]),
    'transport',
  ],
  // Bills & utilities (was "utility" — renamed to align with mobile categories)
  [
    vnWord([
      'điện', 'nước', 'internet', 'net', 'wifi', 'fpt', 'viettel', 'vnpt',
      'tiền nhà', 'thuê nhà', 'rent', 'điện thoại', 'gói cước', '4g', '5g',
      'gas', 'rác',
    ]),
    'bills',
  ],
  // Health
  [
    vnWord([
      'thuốc', 'khám', 'bác sĩ', 'bs', 'viện phí', 'bệnh viện', 'phòng khám',
      'gym', 'tập', 'yoga', 'pt', 'massage', 'spa',
    ]),
    'health',
  ],
  // Learning
  [
    vnWord([
      'sách', 'khoá học', 'khóa học', 'học phí', 'học',
      'udemy', 'coursera', 'duolingo',
    ]),
    'learning',
  ],
  // Shopping
  [
    vnWord([
      'quần áo', 'áo', 'giày', 'mũ', 'nón', 'túi', 'mua sắm', 'shopee', 'lazada',
      'tiki', 'shop', 'siêu thị', 'mall', 'mỹ phẩm', 'son', 'phấn',
    ]),
    'shopping',
  ],
  // Entertainment
  [
    vnWord([
      'phim', 'rạp', 'cinema', 'karaoke', 'game', 'steam', 'netflix', 'spotify',
      'youtube', 'concert', 'show', 'sự kiện',
    ]),
    'entertainment',
  ],
  // Family & gifts (giving money / supporting)
  [
    vnWord([
      'mừng', 'cưới', 'sinh nhật', 'biếu', 'gửi mẹ', 'gửi bố', 'gửi nhà',
      'tặng', 'quà', 'lì xì',
    ]),
    'family',
  ],
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
