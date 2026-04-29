/**
 * Assistant streaming pipeline (round 29 rewrite).
 *
 * Responsibilities are unchanged — yield events as the assistant turn
 * progresses through `started → progress(reading_snapshot) →
 * progress(calling_llm) → delta × N → completed` — but the LLM call
 * itself now goes through LlmService.responsesStream() so:
 *
 *   - Model is picked by tier ('smart') from OPENAI_SMART_MODEL.
 *   - Errors come back as typed LlmError codes (AI_KEY_MISSING,
 *     AI_QUOTA_EXCEEDED, AI_TIMEOUT) instead of raw OpenAI HTTP statuses.
 *   - The Responses API replaces chat.completions; structured outputs +
 *     instructions field replace the old system message dance.
 *
 * Persistence semantics are unchanged: the assistant message row is
 * written only on a clean `done` event so a partial stream never leaves
 * a half-saved bubble.
 */
import { Injectable, Logger } from '@nestjs/common';
import { AiMessageRole } from '@prisma/client';
import type { AssistantStreamEvent } from '@lifeos/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { UserContextService } from '../intelligence/user-context.service';
import { LlmService } from '../../common/llm/llm.service';

const SYS_INSTRUCTIONS = `You are LifeOS AI — a personal assistant for everyday life.

Priorities, in order:
1. Answer concisely. One short paragraph by default; bullet lists for steps.
2. Use the user's language. If they write Vietnamese, reply in Vietnamese.
3. Stay practical. Reference what the snapshot tells you, not what you can't see.
4. Never claim to do something the app doesn't yet do.
5. No fluff, no apologies, no "as an AI" disclaimers.

Length budget: 80 words for casual chat, 200 max for advice with steps.`;

const MAX_HISTORY_MESSAGES = 24;

interface StartArgs {
  userId: string;
  threadId: string;
  messageId: string;
  conversationId: string;
  userText: string;
}

@Injectable()
export class AssistantStreamingService {
  private readonly logger = new Logger(AssistantStreamingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly userCtx: UserContextService,
    private readonly llm: LlmService,
  ) {}

  /**
   * Async generator over AssistantStreamEvents. Each event is fully
   * transport-agnostic — adapters serialise as needed. Persists the
   * assistant message at the very end so a torn stream never leaves a
   * half-saved row.
   */
  async *run(args: StartArgs): AsyncGenerator<AssistantStreamEvent, void, unknown> {
    let seq = 0;
    const base = { threadId: args.threadId, messageId: args.messageId };

    yield { type: 'assistant.stream.started', ...base, seq: seq++ };

    // Stage 1: load LifeSnapshot. Surfaced as visible progress because the
    // privacy-gated query can take 100-300 ms cold.
    yield {
      type: 'assistant.stream.progress',
      ...base,
      seq: seq++,
      stage: 'reading_snapshot',
      label: 'Đang đọc dữ liệu hôm nay…',
    };
    const ctx = await this.userCtx.build(args.userId);

    yield {
      type: 'assistant.stream.progress',
      ...base,
      seq: seq++,
      stage: 'calling_llm',
      label: 'Đang suy nghĩ…',
    };

    // Stage 2: build prompt + stream from OpenAI. Conversation history is
    // serialised into the input string because the Responses API takes a
    // single `input` (vs chat.completions's messages array). The
    // user→assistant turn-taking is preserved by labelling each line.
    const history = await this.prisma.aIMessage.findMany({
      where: { conversationId: args.conversationId },
      orderBy: { createdAt: 'asc' },
      take: MAX_HISTORY_MESSAGES,
    });
    const ctxPrelude = renderContextPrelude(ctx);
    const fullInput = renderConversationInput(history, ctxPrelude, args.userText);

    let assembled = '';
    try {
      const stream = this.llm.responsesStream({
        userId: args.userId,
        feature: 'assistant-chat',
        tier: 'smart',
        instructions: SYS_INSTRUCTIONS,
        input: fullInput,
        temperature: 0.7,
        maxOutputTokens: 600,
        timeoutMs: 30_000,
      });

      for await (const ev of stream) {
        if (ev.type === 'delta' && ev.delta) {
          assembled += ev.delta;
          yield { type: 'assistant.stream.delta', ...base, seq: seq++, delta: ev.delta };
        } else if (ev.type === 'error') {
          yield {
            type: 'assistant.stream.error',
            ...base,
            seq: seq++,
            code: ev.code ?? 'AI_UNAVAILABLE',
            message: ev.message ?? 'OpenAI không phản hồi',
          };
          return;
        }
      }
    } catch (e) {
      // responsesStream() is supposed to deliver errors as events, but
      // catch a hard throw as belt-and-braces.
      this.logger.warn(`stream wrapper threw: ${(e as Error).message}`);
      yield {
        type: 'assistant.stream.error',
        ...base,
        seq: seq++,
        code: 'AI_UNAVAILABLE',
        message: 'Không kết nối được tới OpenAI.',
      };
      return;
    }

    if (!assembled.trim()) {
      yield {
        type: 'assistant.stream.error',
        ...base,
        seq: seq++,
        code: 'AI_UNAVAILABLE',
        message: 'OpenAI không trả lời.',
      };
      return;
    }

    // Stage 3: persist the assistant message + bump the conversation.
    await this.prisma.aIMessage.create({
      data: {
        userId: args.userId,
        conversationId: args.conversationId,
        role: AiMessageRole.ASSISTANT,
        content: assembled,
      },
    });
    await this.prisma.aIConversation.update({
      where: { id: args.conversationId },
      data: { updatedAt: new Date() },
    });

    yield {
      type: 'assistant.stream.completed',
      ...base,
      seq: seq++,
      finalText: assembled,
    };
  }
}

/** Compose the conversation history into a single input string. The
 *  Responses API takes one `input`; we label each line with the role so
 *  the model still sees the back-and-forth. */
function renderConversationInput(
  history: { role: string; content: string }[],
  ctxPrelude: string,
  latestUserText: string,
): string {
  const lines: string[] = [];
  if (ctxPrelude) {
    lines.push('Background facts:');
    lines.push(ctxPrelude);
    lines.push('');
  }
  for (const m of history) {
    const role = m.role.toLowerCase() === 'assistant' ? 'Assistant' : 'User';
    lines.push(`${role}: ${m.content}`);
  }
  // The latest user message is also already in `history` because we
  // persisted it before opening the stream. Avoid double-printing only
  // if the last entry already matches.
  const last = history[history.length - 1];
  if (!last || last.role !== 'USER' || last.content !== latestUserText) {
    lines.push(`User: ${latestUserText}`);
  }
  return lines.join('\n');
}

/** Compact text prelude — same shape AssistantService uses for non-streaming. */
function renderContextPrelude(ctx: import('../intelligence/user-context.service').UserContext): string {
  if (!ctx.profile) return '';
  const lines: string[] = [];
  const p = ctx.profile;
  if (p.preferredName) lines.push(`- Name: ${p.preferredName}`);
  if (p.usualWakeTime || p.usualSleepTime) {
    lines.push(`- Sleep window: ${p.usualWakeTime ?? '?'} → ${p.usualSleepTime ?? '?'} (local)`);
  }
  if (p.workPattern) lines.push(`- Work pattern: ${p.workPattern}`);
  if (p.mainGoals.length) lines.push(`- Main goals: ${p.mainGoals.join(', ')}`);
  if (p.dislikes.length) lines.push(`- Dislikes (avoid suggesting): ${p.dislikes.join(', ')}`);
  if (p.allergies.length) lines.push(`- Allergies (NEVER suggest): ${p.allergies.join(', ')}`);
  if (
    p.budgetMonthly != null &&
    ctx.todaySpendVnd != null &&
    ctx.monthSpendVnd != null
  ) {
    lines.push(`- Monthly budget: ${p.budgetMonthly} VND (today: ${ctx.todaySpendVnd}, month: ${ctx.monthSpendVnd})`);
  }
  if (ctx.lastSleepMinutes != null) {
    lines.push(`- Last sleep: ${(ctx.lastSleepMinutes / 60).toFixed(1)}h`);
  }
  if (ctx.openHighPriorityTaskCount != null && ctx.openHighPriorityTaskCount > 0) {
    lines.push(`- ${ctx.openHighPriorityTaskCount} HIGH-priority task(s) still open`);
  }
  if (ctx.memories.length) {
    lines.push('Things the user told you in earlier chats:');
    for (const m of ctx.memories.slice(0, 8)) lines.push(`  • ${m.fact}`);
  }
  lines.push(`Now: ${ctx.now} (${ctx.tz}).`);
  return lines.join('\n');
}
