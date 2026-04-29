/**
 * Conversational AI assistant. Persists every USER + ASSISTANT message to
 * AIConversation/AIMessage; sends the rolling window to OpenAI on each turn
 * so the model has context across replies.
 *
 * The user's OpenAI key is decrypted in-memory only for the duration of the
 * outbound call — never logged, never persisted in plaintext.
 */
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { AiMessageRole, type AIConversation, type AIMessage } from '@prisma/client';
import type {
  AiConversationPublic,
  AiMessagePublic,
  ConversationDetail,
  SendMessageRequest,
  SendMessageResponse,
} from '@lifeos/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { UserContextService } from '../intelligence/user-context.service';
import { AssistantMemoryService } from '../intelligence/assistant-memory.service';
import { EventLogService } from '../intelligence/event-log.service';
import { LlmService } from '../../common/llm/llm.service';
import { LlmError } from '../../common/llm/llm.types';
import { ActionSuggesterService } from './action-suggester.service';

const SYS_INSTRUCTIONS = `You are LifeOS AI — a personal assistant for everyday life.

Your priorities, in order:
1. Answer concisely. One short paragraph by default; bullet lists for steps.
2. Use the user's language. If they write Vietnamese, reply in Vietnamese.
3. Stay practical. The user is tracking tasks, expenses, meals, sleep, mood
   in this app. Reference what they tell you, not what you can't see.
4. Never claim to do something the app doesn't yet do. (You can suggest;
   the user confirms via Quick Capture.)
5. No fluff, no apologies, no "as an AI" disclaimers.

Length budget: 80 words for casual chat, 200 max for advice with steps.`;

const MAX_HISTORY_MESSAGES = 24;

@Injectable()
export class AssistantService {
  private readonly logger = new Logger(AssistantService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly userCtx: UserContextService,
    private readonly memory: AssistantMemoryService,
    private readonly llm: LlmService,
    private readonly actions: ActionSuggesterService,
    private readonly events: EventLogService,
  ) {}

  // ── Send message (creates conversation if needed, calls LLM, stores) ─────

  async send(userId: string, input: SendMessageRequest): Promise<SendMessageResponse> {
    const conversation = input.conversationId
      ? await this.requireConversation(userId, input.conversationId)
      : await this.prisma.aIConversation.create({
          data: { userId, title: input.content.slice(0, 60) },
        });

    const userMsg = await this.prisma.aIMessage.create({
      data: {
        userId,
        conversationId: conversation.id,
        role: AiMessageRole.USER,
        content: input.content,
      },
    });

    const history = await this.prisma.aIMessage.findMany({
      where: { conversationId: conversation.id },
      orderBy: { createdAt: 'asc' },
      take: MAX_HISTORY_MESSAGES,
    });

    // Build a tight context prelude: profile + behavior + memories. The
    // assistant treats this as background facts the user has already shared,
    // so it can answer questions like "what should I eat for lunch" without
    // re-asking who the user is.
    const ctx = await this.userCtx.build(userId);
    const ctxPrelude = buildContextPrelude(ctx);

    let assistantContent: string;
    try {
      assistantContent = await this.callLlm(userId, history, ctxPrelude, input.content);
    } catch (e) {
      // Roll back: delete the user message we just wrote so the conversation
      // doesn't end with an unanswered turn the next call will misread.
      await this.prisma.aIMessage.delete({ where: { id: userMsg.id } }).catch(() => undefined);
      throw e;
    }

    const assistantMsg = await this.prisma.aIMessage.create({
      data: {
        userId,
        conversationId: conversation.id,
        role: AiMessageRole.ASSISTANT,
        content: assistantContent,
      },
    });

    // Bump the conversation's updatedAt so list ordering is correct.
    await this.prisma.aIConversation.update({
      where: { id: conversation.id },
      data: { updatedAt: new Date() },
    });

    // Round 18: fire-and-forget long-term memory extraction. Reads the last
    // 6 turns and asks the user's own LLM to extract durable facts. Non-
    // blocking — the user response is already returned by the time this
    // resolves.
    void this.memory
      .extractAndStore(
        userId,
        conversation.id,
        [...history, assistantMsg].slice(-6).map((m) => ({
          role: m.role.toLowerCase() === 'assistant' ? 'assistant' : 'user',
          content: m.content,
        })),
      )
      .catch(() => undefined);

    // Round 30: derive follow-up action chips from the assistant's reply +
    // the snapshot we already loaded. Heuristic, no extra LLM call.
    const suggestedActions = this.actions.suggest({
      assistantText: assistantContent,
      ctx,
      userText: input.content,
    });

    // Round 35: log assistant turn for behaviour profile / activity tracking.
    // Payload deliberately holds only message ids — content stays in
    // AIMessage to avoid double-storage and keep the event row small.
    void this.events
      .log(userId, 'ASSISTANT_MESSAGE_SENT', input.content.slice(0, 280), {
        conversationId: conversation.id,
        userMessageId: userMsg.id,
        assistantMessageId: assistantMsg.id,
        suggestedActionCount: suggestedActions.length,
      })
      .catch(() => undefined);

    return {
      conversationId: conversation.id,
      userMessage: toMessage(userMsg),
      assistantMessage: toMessage(assistantMsg),
      suggestedActions,
    };
  }

  // ── List + detail + delete ───────────────────────────────────────────────

  async list(userId: string): Promise<AiConversationPublic[]> {
    const rows = await this.prisma.aIConversation.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
      take: 50,
      include: { _count: { select: { messages: true } } },
    });
    return rows.map((r) => ({
      id: r.id,
      title: r.title,
      messageCount: r._count.messages,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    }));
  }

  async detail(userId: string, conversationId: string): Promise<ConversationDetail> {
    const conv = await this.requireConversation(userId, conversationId);
    const messages = await this.prisma.aIMessage.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'asc' },
      take: 200,
    });
    const messageCount = messages.length;
    return {
      conversation: {
        id: conv.id,
        title: conv.title,
        messageCount,
        createdAt: conv.createdAt.toISOString(),
        updatedAt: conv.updatedAt.toISOString(),
      },
      messages: messages.map(toMessage),
    };
  }

  async remove(userId: string, conversationId: string): Promise<void> {
    await this.requireConversation(userId, conversationId);
    await this.prisma.aIConversation.delete({ where: { id: conversationId } });
  }

  // ── Internals ────────────────────────────────────────────────────────────

  private async requireConversation(userId: string, id: string): Promise<AIConversation> {
    const c = await this.prisma.aIConversation.findUnique({ where: { id } });
    if (!c) {
      throw new NotFoundException({
        error: { code: 'NOT_FOUND', message: 'Hội thoại không tồn tại.' },
      });
    }
    if (c.userId !== userId) {
      throw new ForbiddenException({
        error: { code: 'FORBIDDEN', message: 'Bạn không có quyền với hội thoại này.' },
      });
    }
    return c;
  }

  private async callLlm(
    userId: string,
    history: AIMessage[],
    ctxPrelude: string,
    latestUserText: string,
  ): Promise<string> {
    // Compose the conversation into a single Responses-API input. The
    // streaming path does the same — kept consistent so both surfaces feed
    // the model the exact same prompt structure.
    const lines: string[] = [];
    if (ctxPrelude) {
      lines.push('Background facts:', ctxPrelude, '');
    }
    for (const m of history) {
      const role = m.role.toLowerCase() === 'assistant' ? 'Assistant' : 'User';
      lines.push(`${role}: ${m.content}`);
    }
    const last = history[history.length - 1];
    if (!last || last.role !== 'USER' || last.content !== latestUserText) {
      lines.push(`User: ${latestUserText}`);
    }

    try {
      return await this.llm.responsesText({
        userId,
        feature: 'assistant-chat',
        tier: 'smart',
        instructions: SYS_INSTRUCTIONS,
        input: lines.join('\n'),
        temperature: 0.7,
        maxOutputTokens: 600,
        timeoutMs: 30_000,
      });
    } catch (e) {
      // Translate LlmError → HTTP envelope so existing clients keep their
      // error codes (ASSISTANT_AI_KEY_MISSING etc).
      if (e instanceof LlmError) {
        const map: Record<string, [() => Error, string]> = {
          AI_KEY_MISSING: [
            () => new BadRequestException({
              error: { code: 'ASSISTANT_AI_KEY_MISSING', message: 'Cần API key OpenAI. Vào Cài đặt để thêm.' },
            }),
            '',
          ],
          AI_KEY_DECRYPT_FAILED: [
            () => new BadRequestException({
              error: { code: 'ASSISTANT_AI_KEY_FAILED', message: 'Không giải mã được API key. Cài lại trong Cài đặt.' },
            }),
            '',
          ],
          AI_KEY_REJECTED: [
            () => new BadRequestException({
              error: { code: 'ASSISTANT_AI_KEY_FAILED', message: 'API key đã bị từ chối. Cài lại trong Cài đặt.' },
            }),
            '',
          ],
          AI_QUOTA_EXCEEDED: [
            () => new ServiceUnavailableException({
              error: { code: 'ASSISTANT_QUOTA_EXCEEDED', message: 'Key đã hết quota hoặc bị rate-limit.' },
            }),
            '',
          ],
          AI_TIMEOUT: [
            () => new ServiceUnavailableException({
              error: { code: 'ASSISTANT_TIMEOUT', message: 'OpenAI phản hồi quá lâu.' },
            }),
            '',
          ],
        };
        const entry = map[e.code];
        if (entry) throw entry[0]();
      }
      this.logger.warn(`assistant call failed: ${(e as Error).message}`);
      throw new ServiceUnavailableException({
        error: { code: 'ASSISTANT_TIMEOUT', message: 'Không kết nối được tới OpenAI.' },
      });
    }
  }
}

function toMessage(m: AIMessage): AiMessagePublic {
  return {
    id: m.id,
    conversationId: m.conversationId,
    role: m.role,
    content: m.content,
    createdAt: m.createdAt.toISOString(),
  };
}

/**
 * Render the user's UserContext into a compact background prelude the
 * assistant can read like a memory. Plain text — not JSON — so the LLM
 * treats it as accepted facts rather than something to reformat.
 */
function buildContextPrelude(ctx: import('../intelligence/user-context.service').UserContext): string {
  if (!ctx.profile) return '';
  const lines: string[] = ['Background facts about this user:'];
  const p = ctx.profile;
  if (p.preferredName) lines.push(`- Name: ${p.preferredName}`);
  if (p.usualWakeTime || p.usualSleepTime) {
    lines.push(
      `- Sleep window: ${p.usualWakeTime ?? '?'} → ${p.usualSleepTime ?? '?'} (local)`,
    );
  }
  if (p.workPattern) lines.push(`- Work pattern: ${p.workPattern}`);
  if (p.mainGoals.length) lines.push(`- Main goals: ${p.mainGoals.join(', ')}`);
  if (p.monthlyGoal) lines.push(`- Monthly goal: ${p.monthlyGoal}`);
  if (p.dislikes.length) lines.push(`- Dislikes (avoid suggesting): ${p.dislikes.join(', ')}`);
  if (p.allergies.length) lines.push(`- Allergies (NEVER suggest): ${p.allergies.join(', ')}`);
  if (p.budgetMonthly != null && ctx.todaySpendVnd != null && ctx.monthSpendVnd != null) {
    lines.push(`- Monthly budget: ${p.budgetMonthly} VND (today: ${ctx.todaySpendVnd}, month: ${ctx.monthSpendVnd})`);
  }
  if (ctx.lastSleepMinutes != null) {
    lines.push(`- Last sleep: ${(ctx.lastSleepMinutes / 60).toFixed(1)}h`);
  }
  if (ctx.lastMood) lines.push(`- Last mood: ${ctx.lastMood}`);
  if (ctx.openHighPriorityTaskCount != null && ctx.openHighPriorityTaskCount > 0) {
    lines.push(`- ${ctx.openHighPriorityTaskCount} HIGH-priority task(s) still open`);
  }
  // Privacy hint so the LLM can answer truthfully when a domain is hidden
  // instead of inventing numbers it doesn't have.
  const hidden: string[] = [];
  if (!ctx.privacy.useFinanceForAI) hidden.push('finance');
  if (!ctx.privacy.useHealthForAI) hidden.push('sleep/mood');
  if (!ctx.privacy.useMealsForAI) hidden.push('meals');
  if (!ctx.privacy.useTasksForAI) hidden.push('tasks');
  if (hidden.length) {
    lines.push(`- The user has hidden these domains from AI: ${hidden.join(', ')}. Don't speculate about them.`);
  }
  if (ctx.behavior.peakFocus) {
    lines.push(`- Peak focus window: ${ctx.behavior.peakFocus.start}:00–${ctx.behavior.peakFocus.end}:00`);
  }
  if (ctx.behavior.recentMealTitles.length) {
    lines.push(`- Recent meals: ${ctx.behavior.recentMealTitles.slice(0, 5).join(' / ')}`);
  }
  if (ctx.memories.length) {
    lines.push('Things the user has told you in earlier chats:');
    for (const m of ctx.memories.slice(0, 8)) lines.push(`  • ${m.fact}`);
  }
  lines.push(`Now: ${ctx.now} (${ctx.tz}).`);
  return lines.join('\n');
}
