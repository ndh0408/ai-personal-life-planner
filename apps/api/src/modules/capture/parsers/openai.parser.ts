/**
 * Fallback parser that asks OpenAI to classify + extract a Quick Capture.
 *
 * Round 29 rewrite:
 *   - Routes through LlmService.responsesJson() instead of `new OpenAI(...)`
 *     directly. Strict JSON schema enforced by the Responses API means the
 *     model can't return a malformed shape — we get a typed object or a
 *     `LlmError(AI_SCHEMA_VIOLATION)`.
 *   - Few-shot user-correction examples from CorrectionsService still ride
 *     in the user prompt (steers the model toward this user's idiolect).
 *   - The `tier: 'fast'` hint picks `OPENAI_FAST_MODEL` because capture is
 *     high-volume and latency-sensitive — assistant chat uses 'smart'.
 */
import { Injectable, Logger } from '@nestjs/common';
import type { ParseContext, ParseHit } from './types';
import type { CorrectionExample } from '../corrections.service';
import { LlmService } from '../../../common/llm/llm.service';
import { LlmError } from '../../../common/llm/llm.types';

const SYS_PROMPT = `You classify a single short user utterance about everyday life into ONE of:
- EXPENSE: money the user SPENT on something (food, bills, transport, shopping, …)
- INCOME: money the user RECEIVED (salary, bonus, freelance, refund, gift, dividends)
- MEAL: a meal eaten (breakfast / lunch / dinner / snack) — no money flow
- TASK: something to do, sometimes with a time
- SLEEP: a sleep duration
- MOOD: an emotional state
- UNKNOWN: when none of the above fits

Direction rule (critical):
- "lương 15tr", "thưởng tết 5tr", "freelance được 3tr", "hoàn tiền 200k" → INCOME
- "phở 60k", "trả tiền điện 280k", "mua sách 240k", "đổ xăng 100k" → EXPENSE
- If the verb is missing, the bias is EXPENSE (people log spends more often).

Bias toward Vietnamese if the input is Vietnamese.`;

const KIND_VALUES = [
  'EXPENSE',
  'INCOME',
  'MEAL',
  'TASK',
  'SLEEP',
  'MOOD',
  'UNKNOWN',
] as const;

const CAPTURE_SCHEMA = {
  name: 'capture_extraction',
  strict: true,
  schema: {
    type: 'object',
    additionalProperties: false,
    required: ['kind', 'confidence'],
    properties: {
      kind: { type: 'string', enum: [...KIND_VALUES] },
      confidence: { type: 'number', minimum: 0, maximum: 1 },
      title: { type: 'string' },
      amount: { type: 'number', minimum: 0 },
      category: { type: 'string' },
      incomeCategory: { type: 'string' },
      mealType: { type: 'string', enum: ['BREAKFAST', 'LUNCH', 'DINNER', 'SNACK'] },
      priority: { type: 'string', enum: ['LOW', 'MEDIUM', 'HIGH'] },
      dueAt: { type: 'string', format: 'date-time' },
      loggedAt: { type: 'string', format: 'date-time' },
      expenseDate: { type: 'string', format: 'date-time' },
      incomeDate: { type: 'string', format: 'date-time' },
      durationMinutes: { type: 'integer', minimum: 0 },
      sleepAt: { type: 'string', format: 'date-time' },
      wakeAt: { type: 'string', format: 'date-time' },
      quality: { type: 'string', enum: ['GOOD', 'OK', 'BAD'] },
      mood: {
        type: 'string',
        enum: ['GREAT', 'GOOD', 'OK', 'TIRED', 'STRESSED', 'SAD'],
      },
      energy: { type: 'string', enum: ['LOW', 'MEDIUM', 'HIGH'] },
    },
  },
};

interface LlmExtraction {
  kind: (typeof KIND_VALUES)[number];
  confidence: number;
  title?: string;
  amount?: number;
  category?: string;
  incomeCategory?: string;
  mealType?: 'BREAKFAST' | 'LUNCH' | 'DINNER' | 'SNACK';
  priority?: 'LOW' | 'MEDIUM' | 'HIGH';
  dueAt?: string;
  loggedAt?: string;
  expenseDate?: string;
  incomeDate?: string;
  durationMinutes?: number;
  sleepAt?: string;
  wakeAt?: string;
  quality?: 'GOOD' | 'OK' | 'BAD';
  mood?: 'GREAT' | 'GOOD' | 'OK' | 'TIRED' | 'STRESSED' | 'SAD';
  energy?: 'LOW' | 'MEDIUM' | 'HIGH';
}

@Injectable()
export class OpenAiParser {
  private readonly logger = new Logger(OpenAiParser.name);

  constructor(private readonly llm: LlmService) {}

  /** Returns null if the user has no key, or the call fails for any reason. */
  async tryParse(
    userId: string,
    text: string,
    ctx: ParseContext,
    corrections: CorrectionExample[] = [],
  ): Promise<ParseHit | null> {
    const fewShot = renderFewShot(corrections);
    const userInput =
      `Now in user TZ ${ctx.tz}: ${ctx.now.toISOString()}` +
      (fewShot
        ? `\n\nPast corrections from this user (do not repeat their misclassifications):\n${fewShot}`
        : '') +
      `\n\nInput: ${text}`;

    let extraction: LlmExtraction;
    try {
      extraction = await this.llm.responsesJson<LlmExtraction>({
        userId,
        feature: 'capture-parse',
        tier: 'fast',
        instructions: SYS_PROMPT,
        input: userInput,
        schema: CAPTURE_SCHEMA,
        temperature: 0,
        maxOutputTokens: 400,
        timeoutMs: 12_000,
      });
    } catch (e) {
      // The orchestrator (CaptureService) treats null as "rule wins". A
      // schema violation or missing key shouldn't 500 the whole request.
      if (e instanceof LlmError) {
        this.logger.debug(`capture-parse ${e.code}: ${e.message}`);
      } else {
        this.logger.warn(`capture-parse unexpected error: ${(e as Error).message}`);
      }
      return null;
    }

    return mapToHit(extraction, ctx);
  }
}

function renderFewShot(corrections: CorrectionExample[]): string {
  return corrections
    .filter((c) => c.correctedKind && c.originalKind && c.correctedKind !== c.originalKind)
    .slice(0, 5)
    .map(
      (c) =>
        `- "${c.rawText}" — was classified ${c.originalKind} but the user changed it to ${c.correctedKind}.`,
    )
    .join('\n');
}

function mapToHit(x: LlmExtraction, ctx: ParseContext): ParseHit | null {
  if (!x?.kind || x.kind === 'UNKNOWN') {
    return {
      kind: 'UNKNOWN',
      source: 'OPENAI',
      confidence: 0,
      fields: {},
      previewText: '?',
      hint: 'Mình chưa rõ ý — chọn loại bên dưới hoặc gõ rõ hơn.',
    };
  }

  const conf = Math.max(0, Math.min(1, Number(x.confidence) || 0.6));
  const nowIso = ctx.now.toISOString();
  const title = x.title?.trim() || 'Mục mới';

  switch (x.kind) {
    case 'EXPENSE':
      if (typeof x.amount !== 'number' || x.amount < 0) return null;
      return {
        kind: 'EXPENSE',
        source: 'OPENAI',
        confidence: conf,
        fields: {
          title,
          amount: Math.round(x.amount),
          currency: 'VND',
          category: x.category ?? 'other',
          expenseDateIso: x.expenseDate ?? nowIso,
        },
        previewText: `${title} — ${x.amount.toLocaleString('vi-VN')} ₫`,
      };
    case 'INCOME':
      if (typeof x.amount !== 'number' || x.amount < 0) return null;
      return {
        kind: 'INCOME',
        source: 'OPENAI',
        confidence: conf,
        fields: {
          title,
          amount: Math.round(x.amount),
          currency: 'VND',
          category: x.incomeCategory ?? x.category ?? 'other',
          incomeDateIso: x.incomeDate ?? x.expenseDate ?? nowIso,
        },
        previewText: `${title} — +${x.amount.toLocaleString('vi-VN')} ₫`,
      };
    case 'MEAL':
      return {
        kind: 'MEAL',
        source: 'OPENAI',
        confidence: conf,
        fields: {
          title,
          mealType: x.mealType ?? 'LUNCH',
          cost: typeof x.amount === 'number' ? Math.round(x.amount) : null,
          loggedAtIso: x.loggedAt ?? nowIso,
        },
        previewText: title,
      };
    case 'TASK':
      return {
        kind: 'TASK',
        source: 'OPENAI',
        confidence: conf,
        fields: {
          title,
          dueAtIso: x.dueAt ?? null,
          priority: x.priority ?? 'MEDIUM',
        },
        previewText: title,
      };
    case 'SLEEP':
      if (!x.sleepAt || !x.wakeAt || !x.durationMinutes) return null;
      return {
        kind: 'SLEEP',
        source: 'OPENAI',
        confidence: conf,
        fields: {
          sleepAtIso: x.sleepAt,
          wakeAtIso: x.wakeAt,
          durationMinutes: Math.round(x.durationMinutes),
          quality: x.quality ?? null,
        },
        previewText: `${(x.durationMinutes / 60).toFixed(1)} tiếng`,
      };
    case 'MOOD':
      if (!x.mood) return null;
      return {
        kind: 'MOOD',
        source: 'OPENAI',
        confidence: conf,
        fields: {
          mood: x.mood,
          energy: x.energy ?? 'MEDIUM',
          loggedAtIso: x.loggedAt ?? nowIso,
        },
        previewText: x.mood.toLowerCase(),
      };
    default:
      return null;
  }
}
