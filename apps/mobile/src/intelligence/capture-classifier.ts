import type { CaptureKind } from '@lifeos/taxonomy';

/**
 * On-device capture classifier — rule-based stub for Round 41.
 *
 * The Phase-2 plan is a DistilBERT-multilingual ONNX model (~60MB) running
 * via onnxruntime-react-native. Until that's wired in, this regex-driven
 * classifier gives instant (sub-1ms) suggestions while the user is still
 * typing — same hot path the ML model will replace, same `(text) → result`
 * signature, no API surface change at swap time.
 *
 * Rules are intentionally conservative: when a pattern doesn't match
 * confidently, we return UNKNOWN at low confidence and let the user pick.
 * This is better than guessing wrong and silently miscategorising data.
 */

export interface CaptureSuggestion {
  kind: CaptureKind;
  confidence: number;
}

// Matches: VN-style 35k / 35K, group-separated 1.000.000, plain 4-digit+,
// and decimal amounts like 4.50 / 4,50 (USD/EUR style for EN inputs).
const VND_NUM = /\d{1,3}([.,]?\d{3})+|\d+\s*[kK]\b|\d{4,}|\d+[.,]\d{2}/;
const EXPENSE_HINTS_VI = [
  'mua', 'trả', 'tốn', 'ăn', 'uống', 'cà phê', 'cafe', 'taxi', 'grab',
  'điện', 'nước', 'tiền', 'chi', 'thanh toán', 'phí',
];
const EXPENSE_HINTS_EN = [
  'paid', 'bought', 'spent', 'coffee', 'lunch', 'dinner', 'gas', 'taxi',
  'uber', 'lyft', 'rent', 'bill',
];
const INCOME_HINTS_VI = ['lương', 'thu nhập', 'nhận tiền', 'thưởng', 'hoa hồng', 'lãi', 'bán'];
const INCOME_HINTS_EN = ['salary', 'paycheck', 'bonus', 'received', 'sold', 'income', 'commission'];

const TASK_HINTS_VI = ['cần', 'phải', 'làm', 'gửi', 'gọi', 'nhắn', 'nhớ', 'đặt lịch', 'mua', 'check'];
const TASK_HINTS_EN = ['need to', 'have to', 'must', 'todo', 'remind me', 'schedule', 'call', 'email'];

const EVENT_HINTS_VI = ['hẹn', 'họp', 'gặp', 'sự kiện', 'lúc', 'giờ', 'tối nay', 'ngày mai', 'tuần sau'];
const EVENT_HINTS_EN = ['meeting', 'appointment', 'event', 'at ', 'tomorrow', 'tonight', 'next week'];

const MEAL_HINTS_VI = ['ăn sáng', 'ăn trưa', 'ăn tối', 'bữa', 'phở', 'bún', 'cơm', 'salad'];
const MEAL_HINTS_EN = ['breakfast', 'lunch', 'dinner', 'snack', 'meal'];

const SLEEP_HINTS_VI = ['ngủ', 'thức dậy', 'mất ngủ', 'giấc ngủ'];
const SLEEP_HINTS_EN = ['slept', 'sleep', 'woke up', 'insomnia'];

const MOOD_HINTS_VI = ['cảm thấy', 'tâm trạng', 'vui', 'buồn', 'mệt', 'hứng khởi', 'lo lắng', 'stress'];
const MOOD_HINTS_EN = ['feel', 'feeling', 'mood', 'happy', 'sad', 'tired', 'anxious', 'stressed'];

const IDEA_HINTS_VI = ['ý tưởng', 'idea', 'nghĩ ra', 'có thể', 'biết đâu'];
const IDEA_HINTS_EN = ['idea', 'thought', 'maybe', 'what if'];

function any(text: string, hints: string[]): boolean {
  return hints.some((h) => text.includes(h));
}

/**
 * Returns the best-guess kind plus a confidence in [0, 1]. Confidence is
 * a heuristic blend of (1) hint-density and (2) presence of a unique
 * disambiguator (numeric amount → finance, time word → event, etc.). It
 * is not a probability — downstream code treats anything < 0.5 as "ask".
 */
export function classifyCapture(text: string): CaptureSuggestion {
  const lower = text.toLowerCase().trim();
  if (lower.length === 0) return { kind: 'UNKNOWN', confidence: 0 };

  const hasNumber = VND_NUM.test(lower);

  // Money — strongest signal: number + verb. Direction (income vs expense)
  // resolves on hint match; if neither hits, default to EXPENSE since users
  // log expenses far more often.
  if (hasNumber && (any(lower, EXPENSE_HINTS_VI) || any(lower, EXPENSE_HINTS_EN))) {
    return { kind: 'EXPENSE', confidence: 0.9 };
  }
  if (hasNumber && (any(lower, INCOME_HINTS_VI) || any(lower, INCOME_HINTS_EN))) {
    return { kind: 'INCOME', confidence: 0.88 };
  }
  if (hasNumber) {
    return { kind: 'EXPENSE', confidence: 0.62 };
  }

  // Event — "lúc 3h", "at 5pm", explicit dates
  if (
    /\b\d{1,2}\s*(h|giờ|am|pm|:\d{2})\b/i.test(lower) ||
    any(lower, EVENT_HINTS_VI) ||
    any(lower, EVENT_HINTS_EN)
  ) {
    return { kind: 'EVENT', confidence: 0.78 };
  }

  // Task — imperative-ish phrases
  if (any(lower, TASK_HINTS_VI) || any(lower, TASK_HINTS_EN)) {
    return { kind: 'TASK', confidence: 0.72 };
  }

  // Sleep / mood / meal / idea — keyword lookup
  if (any(lower, SLEEP_HINTS_VI) || any(lower, SLEEP_HINTS_EN)) {
    return { kind: 'SLEEP', confidence: 0.8 };
  }
  if (any(lower, MEAL_HINTS_VI) || any(lower, MEAL_HINTS_EN)) {
    return { kind: 'MEAL', confidence: 0.8 };
  }
  if (any(lower, MOOD_HINTS_VI) || any(lower, MOOD_HINTS_EN)) {
    return { kind: 'MOOD', confidence: 0.75 };
  }
  if (any(lower, IDEA_HINTS_VI) || any(lower, IDEA_HINTS_EN)) {
    return { kind: 'IDEA', confidence: 0.65 };
  }

  // Anything left is a free-form NOTE if it's > 4 words; otherwise unknown.
  const wordCount = lower.split(/\s+/).length;
  if (wordCount >= 4) return { kind: 'NOTE', confidence: 0.5 };
  return { kind: 'UNKNOWN', confidence: 0.1 };
}
