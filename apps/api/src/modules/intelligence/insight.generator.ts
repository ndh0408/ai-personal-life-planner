/**
 * LLM-based insight generator. Replaces the 5-rule recommendations engine
 * for users with an AI key configured. Reads the full UserContext (profile +
 * behavior summary + recent events + memories) and asks GPT to emit 1-3
 * actionable nudges that are *specific* to this person right now.
 *
 * Falls through to the rule-based generator on no-key / failure.
 */
import { Injectable, Logger } from '@nestjs/common';
import { UserContextService, type UserContext } from './user-context.service';
import type { DraftRec } from '../assistant/recommendations.generator';
import { LlmService } from '../../common/llm/llm.service';
import { LlmError } from '../../common/llm/llm.types';

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

interface LlmInsight {
  type?: string;
  title?: string;
  content?: string;
  priority?: 'LOW' | 'MEDIUM' | 'HIGH';
}

interface InsightOutput {
  items: LlmInsight[];
}

const INSIGHT_TYPES = ['SCHEDULE', 'TASK', 'MEAL', 'SLEEP', 'MOOD', 'FINANCE', 'GENERAL'] as const;
const PRIO_VALUES = ['LOW', 'MEDIUM', 'HIGH'] as const;

const INSIGHT_SCHEMA = {
  name: 'insights',
  strict: true,
  schema: {
    type: 'object',
    additionalProperties: false,
    required: ['items'],
    properties: {
      items: {
        type: 'array',
        maxItems: 3,
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['type', 'title', 'content', 'priority'],
          properties: {
            type: { type: 'string', enum: [...INSIGHT_TYPES] },
            title: { type: 'string', maxLength: 80 },
            content: { type: 'string', maxLength: 240 },
            priority: { type: 'string', enum: [...PRIO_VALUES] },
          },
        },
      },
    },
  },
};

@Injectable()
export class InsightGenerator {
  private readonly logger = new Logger(InsightGenerator.name);

  constructor(
    private readonly context: UserContextService,
    private readonly llm: LlmService,
  ) {}

  /**
   * Returns drafts (same shape as the rule generator) when AI is available
   * and emits something. Returns null when the rule engine should run instead.
   */
  async generate(userId: string): Promise<DraftRec[] | null> {
    const ctx = await this.context.build(userId);
    let parsed: InsightOutput;
    try {
      parsed = await this.llm.responsesJson<InsightOutput>({
        userId,
        feature: 'insight-generator',
        tier: 'smart',
        instructions: SYS,
        input: packContext(ctx),
        schema: INSIGHT_SCHEMA,
        temperature: 0.5,
        maxOutputTokens: 600,
        timeoutMs: 15_000,
      });
    } catch (e) {
      // No-key, schema violation, or timeout — caller falls back to rules.
      if (e instanceof LlmError) this.logger.debug(`insight ${e.code}`);
      else this.logger.warn(`insight unexpected: ${(e as Error).message}`);
      return null;
    }

    if (!Array.isArray(parsed.items)) return null;
    return parsed.items
      .filter((i) => i?.title && i?.content)
      .slice(0, 3)
      .map((i) => ({
        type: i.type as DraftRec['type'],
        title: i.title!.slice(0, 80),
        content: i.content!.slice(0, 240),
        priority: (i.priority ?? 'MEDIUM') as DraftRec['priority'],
        evidence: { source: 'AI' },
      }));
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
