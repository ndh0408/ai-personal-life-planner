/**
 * Long-term memory for the Assistant. After each chat turn the Assistant
 * extracts atomic facts ("user prefers cơm gà over phở", "user works night
 * shifts", "user is allergic to peanuts") and saves them here. The top-weight
 * memories are injected into the system prompt of subsequent chats so the AI
 * actually *remembers* what the user has told it.
 *
 * Like ChatGPT memory, but per-user, persisted on our DB, billed against the
 * user's own OpenAI key, and visible to the user (round 19 will surface
 * a "Memory" pane in Settings to edit / delete).
 */
import { Injectable, Logger } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { LlmService } from '../../common/llm/llm.service';
import { LlmError } from '../../common/llm/llm.types';

const EXTRACT_SYS = `From the conversation snippet, extract NEW, durable user facts
worth remembering across chats. Examples of good facts:
- "User prefers cơm gà over phở"
- "User works night shifts (22:00-06:00)"
- "User is allergic to peanuts"
- "User has a 6-month-old baby"
- "User saves for a Tokyo trip in Q4"

NOT facts (do NOT extract):
- One-off mood ("user feels tired today")
- Already-stored facts (avoid duplicates)
- Anything the user said about other people

Output STRICT JSON: { "facts": [{ "fact": "string", "kind": "preference"|"constraint"|"goal"|"fact" }] }
At most 3 facts. If nothing durable, return { "facts": [] }.`;

const MEMORY_KINDS = ['preference', 'constraint', 'goal', 'fact'] as const;

const MEMORY_SCHEMA = {
  name: 'assistant_memory_extraction',
  strict: true,
  schema: {
    type: 'object',
    additionalProperties: false,
    required: ['facts'],
    properties: {
      facts: {
        type: 'array',
        maxItems: 3,
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['fact', 'kind'],
          properties: {
            fact: { type: 'string', minLength: 4, maxLength: 280 },
            kind: { type: 'string', enum: [...MEMORY_KINDS] },
          },
        },
      },
    },
  },
};

interface MemoryExtraction {
  facts: Array<{ fact: string; kind: (typeof MEMORY_KINDS)[number] }>;
}

@Injectable()
export class AssistantMemoryService {
  private readonly logger = new Logger(AssistantMemoryService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly llm: LlmService,
  ) {}

  /** Top-weight memories newest-first, capped to N. */
  async top(userId: string, n = 10) {
    return this.prisma.assistantMemory.findMany({
      where: { userId },
      orderBy: [{ weight: 'desc' }, { lastUsedAt: 'desc' }],
      take: n,
    });
  }

  async list(userId: string) {
    return this.prisma.assistantMemory.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async forget(userId: string, id: string): Promise<{ id: string }> {
    const m = await this.prisma.assistantMemory.findUnique({ where: { id } });
    if (!m || m.userId !== userId) return { id };
    await this.prisma.assistantMemory.delete({ where: { id } });
    return { id };
  }

  /**
   * Best-effort fact extraction. Reads the user's recent conversation,
   * asks their own OpenAI key to extract durable facts, dedupes against
   * existing memories, persists the new ones with weight 0.5.
   */
  async extractAndStore(
    userId: string,
    conversationId: string,
    recentTurns: Array<{ role: 'user' | 'assistant'; content: string }>,
  ): Promise<void> {
    if (recentTurns.length < 2) return;

    const existing = await this.prisma.assistantMemory.findMany({
      where: { userId },
      select: { fact: true },
    });
    const existingSet = new Set(existing.map((e) => e.fact.toLowerCase()));

    const transcript = recentTurns
      .map((t) => `${t.role === 'user' ? 'USER' : 'ASSISTANT'}: ${t.content}`)
      .join('\n');

    let parsed: MemoryExtraction;
    try {
      parsed = await this.llm.responsesJson<MemoryExtraction>({
        userId,
        feature: 'memory-extraction',
        tier: 'fast',
        instructions: EXTRACT_SYS,
        input: transcript,
        schema: MEMORY_SCHEMA,
        temperature: 0.2,
        maxOutputTokens: 240,
        timeoutMs: 8_000,
      });
    } catch (e) {
      // No-key, schema violation, timeout — best-effort, swallow.
      if (e instanceof LlmError) this.logger.debug(`memory-extraction ${e.code}`);
      else this.logger.warn(`memory-extraction unexpected: ${(e as Error).message}`);
      return;
    }

    const toStore: Array<{ fact: string; kind: string }> = [];
    for (const f of parsed.facts ?? []) {
      const fact = f.fact?.trim().slice(0, 280) ?? '';
      if (fact.length < 4) continue;
      if (existingSet.has(fact.toLowerCase())) continue;
      toStore.push({ fact, kind: f.kind });
    }
    if (toStore.length === 0) return;

    await this.prisma.$transaction(
      toStore.map((m) =>
        this.prisma.assistantMemory.create({
          data: {
            userId,
            fact: m.fact,
            kind: m.kind,
            sourceConvId: conversationId,
            weight: 0.5,
          } as Prisma.AssistantMemoryUncheckedCreateInput,
        }),
      ),
    );
  }

  /** Bump weight when the user explicitly confirms a memory. */
  async confirm(userId: string, id: string): Promise<void> {
    const m = await this.prisma.assistantMemory.findUnique({ where: { id } });
    if (!m || m.userId !== userId) return;
    await this.prisma.assistantMemory.update({
      where: { id },
      data: { weight: Math.min(1, m.weight + 0.2), lastUsedAt: new Date() },
    });
  }
}
