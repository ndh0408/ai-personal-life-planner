/**
 * Assistant streaming pipeline (round 24).
 *
 * Same end state as AssistantService.send(): a USER message is persisted,
 * the LLM runs against history + LifeSnapshot, an ASSISTANT message is
 * persisted. The difference is *how the answer arrives* — instead of a
 * single response payload at the end, this service yields events as the
 * pipeline progresses:
 *
 *   started → progress(reading_snapshot) → progress(calling_llm) →
 *   delta × N (one per OpenAI streaming chunk) → completed
 *
 * The transport (SSE today, WebSocket once mobile RN gets a streaming
 * fetch story) maps each event to its wire format. By keeping the
 * generator transport-agnostic, the same logic powers both adapters
 * without conditionals.
 *
 * On any thrown error the generator yields a final `error` event before
 * propagating; consumers only need to listen for `completed | error` to
 * know it's safe to close the connection.
 */
import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AiMessageRole } from '@prisma/client';
import OpenAI from 'openai';
import type { AssistantStreamEvent } from '@lifeos/shared';
import { EncryptionService } from '../../common/crypto/encryption.service';
import { PrismaService } from '../../prisma/prisma.service';
import { UserContextService } from '../intelligence/user-context.service';

const TIMEOUT_MS = 30_000;
const MAX_HISTORY_MESSAGES = 24;

const SYS_PROMPT = `You are LifeOS AI — a personal assistant for everyday life.

Your priorities, in order:
1. Answer concisely. One short paragraph by default; bullet lists for steps.
2. Use the user's language. If they write Vietnamese, reply in Vietnamese.
3. Stay practical. Reference what the snapshot tells you, not what you can't see.
4. Never claim to do something the app doesn't yet do.
5. No fluff, no apologies, no "as an AI" disclaimers.

Length budget: 80 words for casual chat, 200 max for advice with steps.`;

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
    private readonly enc: EncryptionService,
    private readonly config: ConfigService,
    private readonly userCtx: UserContextService,
  ) {}

  /**
   * Async generator over AssistantStreamEvents. Each event is fully formed —
   * adapters serialise as needed. The generator persists the assistant
   * message at the very end so a partial stream never produces a half-saved row.
   */
  async *run(args: StartArgs): AsyncGenerator<AssistantStreamEvent, void, unknown> {
    let seq = 0;
    const base = { threadId: args.threadId, messageId: args.messageId };

    try {
      yield { type: 'assistant.stream.started', ...base, seq: seq++ };

      // 1. Load LifeSnapshot — surfaced as visible progress because it can
      //    take 100-300 ms cold and the user otherwise sees nothing happen.
      yield {
        type: 'assistant.stream.progress',
        ...base,
        seq: seq++,
        stage: 'reading_snapshot',
        label: 'Đang đọc dữ liệu hôm nay…',
      };
      const ctx = await this.userCtx.build(args.userId);

      // Yield a started event refresh with snapshotVersion now that we have it,
      // so debug consumers can correlate.
      yield {
        type: 'assistant.stream.progress',
        ...base,
        seq: seq++,
        stage: 'calling_llm',
        label: 'Đang suy nghĩ…',
      };

      // 2. Build messages and stream from OpenAI.
      const history = await this.prisma.aIMessage.findMany({
        where: { conversationId: args.conversationId },
        orderBy: { createdAt: 'asc' },
        take: MAX_HISTORY_MESSAGES,
      });
      const ctxPrelude = renderContextPrelude(ctx);
      const key = await this.userKeyOrThrow(args.userId);

      const client = new OpenAI({ apiKey: key.apiKey, baseURL: key.baseUrl });
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);

      let assembled = '';
      try {
        const stream = await client.chat.completions.create(
          {
            model: key.model,
            stream: true,
            temperature: 0.7,
            max_tokens: 600,
            messages: [
              { role: 'system', content: SYS_PROMPT },
              ...(ctxPrelude ? [{ role: 'system' as const, content: ctxPrelude }] : []),
              ...history.map((m) => ({
                role: m.role.toLowerCase() as 'user' | 'assistant' | 'system',
                content: m.content,
              })),
            ],
          },
          { signal: ctrl.signal },
        );

        for await (const chunk of stream) {
          const delta = chunk.choices[0]?.delta?.content;
          if (!delta) continue;
          assembled += delta;
          yield { type: 'assistant.stream.delta', ...base, seq: seq++, delta };
        }
      } finally {
        clearTimeout(timer);
      }

      if (!assembled.trim()) {
        throw new ServiceUnavailableException({
          error: { code: 'ASSISTANT_TIMEOUT', message: 'OpenAI không trả lời.' },
        });
      }

      // 3. Persist the assistant message + bump the conversation.
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
    } catch (e) {
      const err = e as { status?: number; name?: string; message?: string };
      const code =
        err?.status === 401
          ? 'ASSISTANT_AI_KEY_FAILED'
          : err?.status === 429
            ? 'ASSISTANT_QUOTA_EXCEEDED'
            : err?.name === 'AbortError'
              ? 'ASSISTANT_TIMEOUT'
              : 'ASSISTANT_TIMEOUT';
      this.logger.warn(`stream failed: status=${err?.status} name=${err?.name}`);
      yield {
        type: 'assistant.stream.error',
        ...base,
        seq: seq++,
        code,
        message: err?.message ?? 'Không kết nối được tới OpenAI.',
      };
    }
  }

  private async userKeyOrThrow(userId: string) {
    const row = await this.prisma.userAiKey.findUnique({ where: { userId } });
    if (!row || !row.isActive) {
      throw new BadRequestException({
        error: {
          code: 'ASSISTANT_AI_KEY_MISSING',
          message: 'Cần API key OpenAI. Vào Cài đặt để thêm.',
        },
      });
    }
    let apiKey: string;
    try {
      apiKey = this.enc.open(row.encryptedApiKey);
    } catch {
      throw new BadRequestException({
        error: {
          code: 'ASSISTANT_AI_KEY_FAILED',
          message: 'Không giải mã được API key. Cài lại trong Cài đặt.',
        },
      });
    }
    return {
      apiKey,
      baseUrl: row.baseUrl,
      model:
        row.defaultModel ?? this.config.get<string>('OPENAI_DEFAULT_MODEL') ?? 'gpt-4o-mini',
    };
  }
}

/** Compact text prelude — same shape AssistantService uses for non-streaming. */
function renderContextPrelude(ctx: import('../intelligence/user-context.service').UserContext): string {
  if (!ctx.profile) return '';
  const lines: string[] = ['Background facts about this user:'];
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
