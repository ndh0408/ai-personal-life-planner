/**
 * Vietnamese money parser. Handles common shorthand:
 *   "75k"      → 75 000
 *   "75 nghìn" → 75 000
 *   "1tr"      → 1 000 000
 *   "1.5tr"    → 1 500 000
 *   "1,5 triệu"→ 1 500 000
 *   "120000đ"  → 120 000
 *   "120.000"  → 120 000        (Vietnamese-grouped integer)
 *   "120,000"  → 120 000        (English-grouped)
 *   "120.000,5"→ 120 000        (decimals dropped — money-only)
 */

const NUM = '(\\d+(?:[\\.,]\\d+)*)';
const SUFFIX = '(k|nghìn|nghin|ngàn|ngan|tr|triệu|trieu|m|đ|d|vnđ|vnd)?';

const MONEY_RE = new RegExp(`${NUM}\\s*${SUFFIX}\\b`, 'gi');

function asNumber(raw: string, suffix: string): number | null {
  const norm = raw.replace(/[\.,]/g, '');
  let n = Number(norm);

  // Decimal handling for "1.5tr" / "1,5 triệu"
  if (raw.includes('.') || raw.includes(',')) {
    const parts = raw.split(/[\.,]/);
    if (parts.length === 2 && parts[1].length <= 2) {
      // Treat as decimal only when the suffix multiplies (k/tr/m), otherwise the
      // dots/commas are thousand separators (Vietnamese style).
      if (/^(k|nghìn|nghin|ngàn|ngan|tr|triệu|trieu|m)$/i.test(suffix)) {
        n = Number(`${parts[0]}.${parts[1]}`);
      }
    }
  }
  if (!Number.isFinite(n)) return null;

  switch (suffix.toLowerCase()) {
    case 'k':
    case 'nghìn':
    case 'nghin':
    case 'ngàn':
    case 'ngan':
      return Math.round(n * 1_000);
    case 'tr':
    case 'triệu':
    case 'trieu':
    case 'm':
      return Math.round(n * 1_000_000);
    case 'đ':
    case 'd':
    case 'vnđ':
    case 'vnd':
    default:
      return Math.round(n);
  }
}

export interface MoneyMatch {
  amount: number;
  /** [start, end) of the matched substring in the original text. */
  span: [number, number];
}

export function findMoney(text: string): MoneyMatch | null {
  let best: MoneyMatch | null = null;
  for (const m of text.matchAll(MONEY_RE)) {
    const raw = m[1];
    const suffix = m[2] ?? '';
    if (!raw) continue;
    const value = asNumber(raw, suffix);
    if (value === null) continue;

    // Reject lone integers like "12" if no suffix and value < 1000 — likely
    // a time hint rather than a price.
    if (!suffix && value < 1000) continue;

    if (m.index === undefined) continue;
    const cand: MoneyMatch = { amount: value, span: [m.index, m.index + m[0].length] };
    if (!best || cand.amount > best.amount) best = cand;
  }
  return best;
}
