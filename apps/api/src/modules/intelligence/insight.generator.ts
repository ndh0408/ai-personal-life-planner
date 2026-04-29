/**
 * LLM-based insight generator. Replaces the 5-rule recommendations engine
 * for users with an AI key configured. Reads the full UserContext (profile +
 * behavior summary + recent events + memories) and asks GPT to emit 1-3
 * actionable nudges that are *specific* to this person right now.
 *
 * Falls through to the rule-based generator on no-key / failure.
 */
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { PrismaService } from '../../prisma/prisma.service';
import { EncryptionService } from '../../common/crypto/encryption.service';
import { UserContextService, type UserContext } from './user-context.service';
import type { DraftRec } from '../assistant/recommendations.generator';

const SYS = `You are LifeOS AI's personal insight engine. From the user's full
context, emit 1-3 ACTIONABLE nudges that are specific to THIS user, RIGHT NOW.

Rules:
- Each nudge must point to a concrete signal: "your sleep dropped to 5.2h
  the last 3 nights" beats "try to sleep more".
- Reference the user's mainGoals + monthlyGoal + dislikes when relevant. Do NOT
  suggest food they dislike or are allergic to.
- If behavior.moodSleepCorrelation is < -0.4, include a sleep nudge.
- If todaySpendVnd / monthSpendVnd > 0.7 of budgetMonthly, include a finance nudge.
- If the user has a HIGH-priority task open and it's past wake+3h, suggest tackling it.
- Do NOT repeat insights the user has already INSIGHT_DISMISSED or INSIGHT_LIKED in
  recentEvents.
- Title ≤ 60 chars, content ≤ 200 chars, both Vietnamese for VN locale users.

Output STRICT JSON: { "items": [
  { "type": "FINANCE"|"SLEEP"|"MOOD"|"TASK"|"MEAL"|"SCHEDULE"|"GENERAL",
    "title": "string", "content": "string",
    "priority": "LOW"|"MEDIUM"|"HIGH" }
] }
0 items if there's nothing useful to say. Quality > quantity.`;

const TIMEOUT_MS = 15_000;

interface LlmInsight {
  type?: string;
  title?: string;
  content?: string;
  priority?: 'LOW' | 'MEDIUM' | 'HIGH';
}

const VALID_TYPES = new Set([
  'SCHEDULE',
  'TASK',
  'MEAL',
  'SLEEP',
  'MOOD',
  'FINANCE',
  'GENERAL',
]);

@Injectable()
export class InsightGenerator {
  private readonly logger = new Logger(InsightGenerator.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly enc: EncryptionService,
    private readonly config: ConfigService,
    private readonly context: UserContextService,
  ) {}

  /**
   * Returns drafts (same shape as the rule generator) when AI is available
   * and emits something. Returns null when caller should fall through.
   */
  async generate(userId: string): Promise<DraftRec[] | null> {
    const keyRow = await this.prisma.userAiKey.findUnique({ where: { userId } });
    if (!keyRow?.isActive) return null;
    let plain: string;
    try {
      plain = this.enc.open(keyRow.encryptedApiKey);
    } catch {
      return null;
    }

    const ctx = await this.context.build(userId);
    const userMsg = packContext(ctx);

    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    try {
      const client = new OpenAI({ apiKey: plain, baseURL: keyRow.baseUrl });
      const model =
        keyRow.defaultModel ??
        this.config.get<string>('OPENAI_DEFAULT_MODEL') ??
        'gpt-4o-mini';
      const res = await client.chat.completions.create(
        {
          model,
          messages: [
            { role: 'system', content: SYS },
            { role: 'user', content: userMsg },
          ],
          response_format: { type: 'json_object' },
          temperature: 0.5,
          max_tokens: 600,
        },
        { signal: ctrl.signal },
      );
      const raw = res.choices[0]?.message?.content;
      if (!raw) return null;
      const parsed = JSON.parse(raw) as { items?: LlmInsight[] };
      if (!Array.isArray(parsed.items)) return null;
      return parsed.items
        .filter((i) => i?.title && i?.content && VALID_TYPES.has(i.type ?? ''))
        .slice(0, 3)
        .map((i) => ({
          type: i.type as DraftRec['type'],
          title: i.title!.slice(0, 80),
          content: i.content!.slice(0, 240),
          priority: i.priority ?? 'MEDIUM',
          evidence: { source: 'AI', model },
        }));
    } catch (e) {
      this.logger.warn(`Insight generation failed for ${userId}: ${(e as Error).message}`);
      return null;
    } finally {
      clearTimeout(timer);
    }
  }
}

function packContext(ctx: UserContext): string {
  // Trim before send — recentEvents and behavior can balloon.
  return JSON.stringify({
    now: ctx.now,
    tz: ctx.tz,
    profile: ctx.profile,
    behaviorSummary: {
      avgSleepByWeekday: ctx.behavior.avgSleepByWeekday,
      moodSleepCorrelation: ctx.behavior.moodSleepCorrelation,
      taskCompletionByPrio: ctx.behavior.taskCompletionByPrio,
      topExpenseCategories: ctx.behavior.topExpenseCategories,
      peakFocus: ctx.behavior.peakFocus,
    },
    recentEvents: ctx.recentEvents.slice(0, 15).map((e) => ({
      kind: e.kind,
      summary: e.summary,
    })),
    memories: ctx.memories.map((m) => m.fact),
    lastSleepHours:
      ctx.lastSleepMinutes != null ? +(ctx.lastSleepMinutes / 60).toFixed(1) : null,
    lastMood: ctx.lastMood,
    todaySpendVnd: ctx.todaySpendVnd,
    monthSpendVnd: ctx.monthSpendVnd,
    openHighPriorityTaskCount: ctx.openHighPriorityTaskCount,
  });
}
