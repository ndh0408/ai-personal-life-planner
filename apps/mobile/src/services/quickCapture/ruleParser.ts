/**
 * Rule-based Quick Capture parser.
 *
 * Runs on-device — no AI provider required. Lets new users try the
 * "type one line, app routes it" surface before they configure their
 * OpenAI key. The AI-powered path (`/ai/parse-quick-capture`) remains
 * available for users who have configured a provider; this fallback
 * covers the most common Vietnamese + English shorthand.
 *
 * Parser is intentionally cautious: it only emits a draft when the
 * heuristic is very likely correct. Drafts always pass through user
 * confirmation before any API call writes data.
 *
 * Examples handled:
 *   - "cà phê 30k"             → expense {title:Cà phê, amount:30000, category:food}
 *   - "ăn cơm gà 45k"           → expense {title:Ăn cơm gà, amount:45000, category:food}
 *   - "coffee 30k"              → expense {title:Coffee, amount:30000, category:food}
 *   - "taxi 50000"              → expense {title:Taxi, amount:50000, category:transport}
 *   - "mai 9h gọi khách"        → task {title:Gọi khách, due:tomorrow 09:00}
 *   - "nhắc tôi trả lời email lúc 8h" → task {title:Trả lời email, due:today/tomorrow 08:00}
 *   - "tomorrow 9am call client" → task {title:Call client, due:tomorrow 09:00}
 */

export type ExpenseDraft = {
  kind: 'EXPENSE';
  title: string;
  amount: number;
  category: string;
  expenseDate: string; // YYYY-MM-DD
  raw: string;
  confidence: 'high' | 'medium';
};

export type TaskDraft = {
  kind: 'TASK';
  title: string;
  dueDate?: string; // ISO
  raw: string;
  confidence: 'high' | 'medium';
};

export type CaptureDraft = ExpenseDraft | TaskDraft;

const MONEY_RE = /(\d+(?:[.,]\d+)?)\s*([kKmM])?\s*(?:đ|vnd|VND|đồng)?/g;
const USD_RE = /\$\s*(\d+(?:\.\d+)?)/;

const FOOD_KEYWORDS = [
  'cà phê', 'cafe', 'coffee', 'trà sữa', 'milk tea', 'bubble tea',
  'ăn', 'cơm', 'phở', 'bún', 'mì', 'lunch', 'dinner', 'breakfast', 'snack',
  'bánh', 'kem', 'ice cream', 'pizza', 'burger', 'sushi', 'gà rán',
];
const TRANSPORT_KEYWORDS = [
  'taxi', 'grab', 'xăng', 'gasoline', 'gas', 'uber', 'bus', 'xe ôm',
  'parking', 'gửi xe',
];
const UTILITIES_KEYWORDS = [
  'điện', 'electricity', 'nước', 'water bill', 'internet', 'wifi',
  'tiền nhà', 'rent', 'thuê nhà',
];
const HEALTH_KEYWORDS = [
  'thuốc', 'medicine', 'doctor', 'khám', 'hospital', 'pharmacy', 'bác sĩ',
];
const SHOPPING_KEYWORDS = [
  'mua', 'shopping', 'shopee', 'lazada', 'amazon', 'sách', 'book',
];

const TASK_TRIGGERS = [
  'nhắc',     // remind me
  'gọi',      // call
  'gửi',      // send
  'họp',      // meeting
  'đi',       // go to
  'làm',      // do
  'remind',
  'call',
  'send',
  'meet',
  'meeting',
  'finish',
  'submit',
  'review',
  'reply',
  'email',
];

const TODAY_WORDS = ['hôm nay', 'today', 'tối nay', 'tonight', 'sáng nay', 'this morning', 'chiều nay', 'this afternoon'];
const TOMORROW_WORDS = ['mai', 'ngày mai', 'tomorrow', 'tmr'];

// ---------- helpers ---------------------------------------------------------

function pad(n: number): string {
  return n.toString().padStart(2, '0');
}

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function tomorrowIso(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function isoAt(dateIso: string, hour: number, minute = 0): string {
  // Build local-time ISO without TZ shift: caller is expected to feed
  // local time and the server stores it as UTC; the conversion happens
  // in syncQueue/api client.
  const [y, m, d] = dateIso.split('-').map(Number);
  const dt = new Date(y, m - 1, d, hour, minute, 0, 0);
  return dt.toISOString();
}

function detectCategory(text: string): string {
  const lower = text.toLowerCase();
  if (FOOD_KEYWORDS.some((k) => lower.includes(k))) return 'food';
  if (TRANSPORT_KEYWORDS.some((k) => lower.includes(k))) return 'transport';
  if (UTILITIES_KEYWORDS.some((k) => lower.includes(k))) return 'housing';
  if (HEALTH_KEYWORDS.some((k) => lower.includes(k))) return 'health';
  if (SHOPPING_KEYWORDS.some((k) => lower.includes(k))) return 'shopping';
  return 'other';
}

/**
 * Detect a single money amount in the input. Returns the numeric value
 * (in the user's local currency — VND for `k`/`m` suffix, USD for `$`)
 * and the matched substring for stripping.
 */
function detectAmount(text: string): { amount: number; matched: string } | null {
  const usdMatch = text.match(USD_RE);
  if (usdMatch) {
    return { amount: parseFloat(usdMatch[1]), matched: usdMatch[0] };
  }
  // Reset stateful regex.
  MONEY_RE.lastIndex = 0;
  let best: { amount: number; matched: string } | null = null;
  let m: RegExpExecArray | null;
  while ((m = MONEY_RE.exec(text)) !== null) {
    const raw = m[1].replace(',', '.');
    const num = parseFloat(raw);
    if (Number.isNaN(num) || num <= 0) continue;
    let amount = num;
    const suffix = (m[2] ?? '').toLowerCase();
    if (suffix === 'k') amount = num * 1_000;
    else if (suffix === 'm') amount = num * 1_000_000;
    else if (num < 1_000) {
      // Bare numbers under 1k are usually counts/hours, not VND amounts.
      // Skip unless followed by `đ` / `vnd`.
      if (!/đ|vnd|VND|đồng/.test(m[0])) continue;
    }
    // Prefer the largest amount (the user is more likely to mention
    // a single price than two unrelated numbers).
    if (!best || amount > best.amount) {
      best = { amount, matched: m[0] };
    }
  }
  return best;
}

function titleCase(s: string): string {
  return s
    .split(/\s+/)
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1).toLowerCase() : w))
    .join(' ');
}

/**
 * Extract a time-of-day hint and resolve a target ISO datetime.
 * Returns null when no hint is found.
 */
function detectDue(
  text: string,
): { dueIso: string; matched: string[] } | null {
  const lower = text.toLowerCase();
  const matched: string[] = [];

  // Detect date hints with word-boundary matching so "mai" doesn't
  // accidentally match inside "email", "today" doesn't match inside
  // "todayson", etc. JavaScript `\b` is ASCII-only which is fine for
  // these dictionary words.
  const wb = (w: string) =>
    new RegExp(`(?:^|[^\\p{L}\\p{N}])${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?=$|[^\\p{L}\\p{N}])`, 'iu');
  let date = todayIso();
  let hasDate = false;
  for (const w of TOMORROW_WORDS) {
    if (wb(w).test(lower)) {
      date = tomorrowIso();
      hasDate = true;
      matched.push(w);
      break;
    }
  }
  if (!hasDate) {
    for (const w of TODAY_WORDS) {
      if (wb(w).test(lower)) {
        date = todayIso();
        hasDate = true;
        matched.push(w);
        break;
      }
    }
  }

  // Time: "9h", "9 giờ", "9:30", "9am", "9:00", "lúc 8h"
  let hour: number | null = null;
  let minute = 0;
  const am = lower.match(/(\d{1,2})\s*am/);
  const pm = lower.match(/(\d{1,2})\s*pm/);
  const colon = lower.match(/(\d{1,2}):(\d{2})/);
  const vnHour = lower.match(/(\d{1,2})\s*(?:h(?!\w)|giờ)/);
  if (colon) {
    hour = parseInt(colon[1], 10);
    minute = parseInt(colon[2], 10);
    matched.push(colon[0]);
  } else if (am) {
    hour = parseInt(am[1], 10) % 12;
    matched.push(am[0]);
  } else if (pm) {
    hour = (parseInt(pm[1], 10) % 12) + 12;
    matched.push(pm[0]);
  } else if (vnHour) {
    hour = parseInt(vnHour[1], 10);
    matched.push(vnHour[0]);
  }

  if (hour === null && !hasDate) return null;

  // If only an hour was given and that hour has already passed today,
  // assume the user means tomorrow.
  if (hour !== null && !hasDate) {
    const now = new Date();
    if (hour < now.getHours()) {
      date = tomorrowIso();
    }
  }

  return {
    dueIso: isoAt(date, hour ?? 9, minute),
    matched,
  };
}

function looksLikeTask(text: string): boolean {
  const lower = text.toLowerCase();
  return TASK_TRIGGERS.some((k) => lower.includes(k));
}

function stripPhrases(text: string, phrases: string[]): string {
  let out = text;
  for (const p of phrases) {
    if (!p) continue;
    const re = new RegExp(p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'ig');
    out = out.replace(re, ' ');
  }
  return out.replace(/\s+/g, ' ').trim();
}

// ---------- entry point -----------------------------------------------------

/**
 * Parse a free-form capture string into one (or zero) drafts.
 *
 * Returns an array because in the future a single line may carry
 * multiple intents (e.g. "cà phê 30k và mai 9h gọi khách"). For now
 * the implementation prefers a single most-confident interpretation.
 */
export function parseQuickCapture(input: string): CaptureDraft[] {
  const text = input.trim();
  if (text.length < 2) return [];

  const taskHint = looksLikeTask(text);
  const due = detectDue(text);
  const money = detectAmount(text);

  // Expense: amount detected and no strong task trigger.
  if (money && (!taskHint || /\d+[kKm]\b/.test(text))) {
    let title = stripPhrases(text, [money.matched]).trim();
    title = title.replace(/^(?:mua|cho|trả|paid|bought|spent)\s+/i, '');
    if (!title) title = 'Expense';
    if (title.length > 60) title = title.slice(0, 60);
    return [
      {
        kind: 'EXPENSE',
        title: titleCaseIfAscii(title),
        amount: money.amount,
        category: detectCategory(text),
        expenseDate: todayIso(),
        raw: text,
        confidence: 'high',
      },
    ];
  }

  // Task: due-date hint OR task-trigger keyword.
  if (taskHint || due) {
    let title = text;
    if (due) title = stripPhrases(title, due.matched);
    title = title.replace(/^(?:nhắc tôi|nhắc|hãy|please|remind me to|remind me)\s+/i, '');
    title = title.replace(/\s+lúc\s*$/i, '').trim();
    if (!title) title = 'Reminder';
    if (title.length > 80) title = title.slice(0, 80);
    return [
      {
        kind: 'TASK',
        title: titleCaseIfAscii(title),
        dueDate: due?.dueIso,
        raw: text,
        confidence: due ? 'high' : 'medium',
      },
    ];
  }

  return [];
}

/**
 * Avoid title-casing Vietnamese (which would mangle accents). Only
 * upper-case the very first letter so the result reads naturally.
 */
function titleCaseIfAscii(s: string): string {
  if (!s) return s;
  // Detect Vietnamese diacritics — if present, just capitalize first char.
  if (/[ăâđêôơưáàảãạắằẳẵặấầẩẫậéèẻẽẹếềểễệíìỉĩịóòỏõọốồổỗộớờởỡợúùủũụứừửữựýỳỷỹỵ]/i.test(s)) {
    return s[0].toUpperCase() + s.slice(1);
  }
  return titleCase(s);
}
