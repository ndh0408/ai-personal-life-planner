import { ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { LocaleService } from '../../../common/i18n/locale.service';
import { AiProviderService, briefAiError } from './ai-provider.service';
import { AiPromptTemplateService } from './ai-prompt-template.service';
import { AiJsonValidationService } from './ai-json-validation.service';
import { ChatReplySchema, type ChatReply } from '../schemas/chat.schema';
import { buildChatPrompt, buildChatSystem, type ChatContext } from '../prompts/chat.prompt';

export interface AiChatInput {
  message: string;
  conversationId?: string;
  contextType?: string;
}

type RequestLike = { headers?: Record<string, string | string[] | undefined>; locale?: string };

const FALLBACK_BY_LOCALE: Record<'vi' | 'en', ChatReply> = {
  en: {
    answer: 'I had trouble responding just now. Please try rephrasing in a moment.',
    suggestedActions: [],
  },
  vi: {
    answer: 'Mình đang gặp trục trặc khi trả lời. Bạn thử diễn đạt lại sau một lát nhé.',
    suggestedActions: [],
  },
};

@Injectable()
export class AiChatService {
  private readonly logger = new Logger(AiChatService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly provider: AiProviderService,
    private readonly tpl: AiPromptTemplateService,
    private readonly json: AiJsonValidationService,
    private readonly locale: LocaleService,
  ) {}

  async chat(userId: string, input: AiChatInput, req: RequestLike = {}) {
    const localeTag = await this.locale.forUser(userId, req);
    const profile = await this.prisma.userProfile.findUnique({ where: { userId } });

    let conversation = input.conversationId
      ? await this.prisma.aIConversation.findUnique({ where: { id: input.conversationId } })
      : null;
    if (input.conversationId) {
      if (!conversation) throw new NotFoundException('Conversation not found');
      if (conversation.userId !== userId) throw new ForbiddenException();
    }
    if (!conversation) {
      conversation = await this.prisma.aIConversation.create({
        data: {
          userId,
          contextType: input.contextType ?? null,
          title: input.message.slice(0, 60),
        },
      });
    }

    const history = await this.prisma.aIMessage.findMany({
      where: { conversationId: conversation.id },
      orderBy: { createdAt: 'asc' },
      take: 16,
    });

    const ctx: ChatContext = {
      message: input.message,
      contextType: input.contextType ?? conversation.contextType ?? undefined,
      history: history.map((m) => ({ role: m.role, content: m.content })),
      userSnapshot: {
        mainGoal: profile?.mainGoal ?? null,
        activityLevel: profile?.activityLevel ?? null,
        timezone: profile?.timezone ?? null,
      },
    };

    const system = buildChatSystem(localeTag);
    const prompt = buildChatPrompt(this.tpl, ctx);

    let reply: ChatReply;
    let usedFallback = false;
    try {
      const completion = await this.provider.complete(
        { system, prompt, jsonMode: true, maxTokens: 1200, temperature: 0.7 },
      );
      reply = await this.json.parseAndValidate(completion.text, ChatReplySchema, {
        task: 'chat',
        system,
      });
    } catch (e) {
      this.logger.warn(`chat fell back: ${briefAiError(e)}`);
      reply = FALLBACK_BY_LOCALE[localeTag];
      usedFallback = true;
    }

    // Persist user message + assistant message (best-effort)
    await this.prisma.aIMessage.create({
      data: { conversationId: conversation.id, userId, role: 'USER', content: input.message },
    });
    await this.prisma.aIMessage.create({
      data: {
        conversationId: conversation.id,
        userId,
        role: 'ASSISTANT',
        content: reply.answer,
        // round-trip through JSON to satisfy Prisma's InputJsonValue type
        metadata: JSON.parse(
          JSON.stringify({ suggestedActions: reply.suggestedActions, fallback: usedFallback }),
        ),
      },
    });

    return {
      conversationId: conversation.id,
      reply,
      usedFallback,
    };
  }
}
