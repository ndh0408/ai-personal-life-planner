/**
 * Heuristic action suggester (round 30).
 *
 * After every assistant turn we surface 1-3 follow-up actions as chips
 * the user can tap. No silent-create per Microsoft HAI / Google PAIR:
 * every chip either opens a screen the user can read first, or pre-fills
 * SmartEntry where the user still confirms via the existing preview.
 *
 * Why heuristic over LLM:
 *   - Round-trip latency. The chat turn already cost 1-3 s; adding a
 *     second LLM call to *generate* chips would visibly delay the chip
 *     row appearing. The signal is small enough that simple text+context
 *     matching gets us ~80% of the value at zero added latency.
 *   - Determinism. We don't want the chip row jittering between turns
 *     for similar prompts. Hardcoded heuristics produce stable suggestions.
 *
 * The matchers are intentionally Vietnamese-first because the user base
 * is. English fall-back keywords are added where the cost is low.
 */
import { Injectable } from '@nestjs/common';
import type { AssistantAction } from '@lifeos/shared';
import type { UserContext } from '../intelligence/user-context.service';

const MAX_ACTIONS = 3;

/** Substrings (lowercased) that signal a particular intent in the assistant's reply. */
const PLAN_TRIGGERS = ['kế hoạch', 'lịch hôm nay', 'lập kế hoạch', 'plan today', 'schedule'];
const SAVE_EXPENSE_TRIGGERS = ['ghi chi tiêu', 'log expense', 'lưu khoản chi'];
const SAVE_TASK_TRIGGERS = ['việc cần', 'todo', 'task này', 'add a task'];

@Injectable()
export class ActionSuggesterService {
  /**
   * Build the chip list from the assistant's reply + the LifeSnapshot we
   * already loaded for the turn. Idempotent / pure — no DB writes.
   */
  suggest(args: { assistantText: string; ctx: UserContext; userText: string }): AssistantAction[] {
    const lower = args.assistantText.toLowerCase();
    const userLower = args.userText.toLowerCase();
    const out: AssistantAction[] = [];

    // 1. Plan-shaped suggestion: assistant talked about planning, OR the
    //    user asked "what should I do today" and there's no plan yet.
    if (
      out.length < MAX_ACTIONS &&
      (PLAN_TRIGGERS.some((t) => lower.includes(t) || userLower.includes(t)))
    ) {
      out.push({
        type: 'GENERATE_TODAY_PLAN',
        label: 'Lập kế hoạch hôm nay',
      });
    }

    // 2. Capture-shaped suggestion: prefill SmartEntry with the user's own
    //    raw text so they can tap "Save" if they wanted to log it. Only
    //    when their message looked like a capture candidate (short + has
    //    a number or food/task keyword).
    if (
      out.length < MAX_ACTIONS &&
      args.userText.length < 200 &&
      /\d/.test(args.userText) &&
      (SAVE_EXPENSE_TRIGGERS.some((t) => lower.includes(t)) ||
        /(\d+\s?(k|tr|nghìn|triệu|đ|vnd|đồng))/i.test(args.userText))
    ) {
      out.push({
        type: 'OPEN_SMART_ENTRY',
        label: 'Lưu vào sổ chi tiêu',
        prefillText: args.userText.slice(0, 500),
        mode: 'EXPENSE',
      });
    }

    if (
      out.length < MAX_ACTIONS &&
      SAVE_TASK_TRIGGERS.some((t) => lower.includes(t) || userLower.includes(t))
    ) {
      out.push({
        type: 'OPEN_SMART_ENTRY',
        label: 'Tạo việc cần làm',
        prefillText: args.userText.slice(0, 500),
        mode: 'TASK',
      });
    }

    // 3. Recommendations refresh — useful when the assistant mentions
    //    "gợi ý" / "recommend" or when the user has an AI key but their
    //    snapshot has no high-priority signals lately.
    if (
      out.length < MAX_ACTIONS &&
      (lower.includes('gợi ý') || lower.includes('recommend')) &&
      args.ctx.privacy.personalizationEnabled
    ) {
      out.push({
        type: 'REFRESH_RECOMMENDATIONS',
        label: 'Cập nhật gợi ý',
      });
    }

    // 4. Floor: if we ended up with zero suggestions, give the user a
    //    "see today" navigation chip rather than an empty row. This is
    //    the no-op fallback the chat surface always shows.
    if (out.length === 0) {
      out.push({
        type: 'OPEN_SCREEN',
        label: 'Xem hôm nay',
        screen: 'Today',
      });
    }

    return out;
  }
}
