/**
 * Fallback parser that asks OpenAI to classify + extract a Quick Capture.
 * Uses the *user's* key (decrypted in-memory for the request only) so
 * billing follows the user — never the platform.
 *
 * Model is forced to JSON mode with a strict schema; on any error the parser
 * returns null and the orchestrator falls through to UNKNOWN.
 */
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import type { ParseContext, ParseHit } from './types';
import { EncryptionService } from '../../../common/crypto/encryption.service';
import { PrismaService } from '../../../prisma/prisma.service';

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

Return STRICT JSON with this shape (no commentary):
{
  "kind": "EXPENSE" | "INCOME" | "MEAL" | "TASK" | "SLEEP" | "MOOD" | "UNKNOWN",
  "confidence": 0..1,
  "title": "short human-readable label",
  "amount": <integer in smallest unit, only for EXPENSE / INCOME / MEAL cost>,
  "category": one of [food, transport, bills, shopping, health, learning, entertainment, family, other]  (EXPENSE),
  "incomeCategory": one of [salary, bonus, freelance, gift, refund, investment, other]  (INCOME),
  "mealType": "BREAKFAST" | "LUNCH" | "DINNER" | "SNACK"  (MEAL only),
  "priority": "LOW" | "MEDIUM" | "HIGH"  (TASK only),
  "dueAt": "ISO 8601 in user TZ"  (TASK with time only),
  "loggedAt": "ISO 8601 in user TZ"  (MEAL / MOOD),
  "expenseDate": "ISO 8601 in user TZ"  (EXPENSE),
  "incomeDate": "ISO 8601 in user TZ"  (INCOME),
  "durationMinutes": <integer>  (SLEEP),
  "sleepAt": "ISO 8601",
  "wakeAt": "ISO 8601",
  "quality": "GOOD" | "OK" | "BAD"  (SLEEP, optional),
  "mood": "GREAT" | "GOOD" | "OK" | "TIRED" | "STRESSED" | "SAD"  (MOOD only),
  "energy": "LOW" | "MEDIUM" | "HIGH"  (MOOD, optional)
}

Bias toward Vietnamese if the input is Vietnamese.`;

const TIMEOUT_MS = 12_000;

interface LlmExtraction {
  kind: 'EXPENSE' | 'INCOME' | 'MEAL' | 'TASK' | 'SLEEP' | 'MOOD' | 'UNKNOWN';
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

  constructor(
    private readonly prisma: PrismaService,
    private readonly enc: EncryptionService,
    private readonly config: ConfigService,
  ) {}

  /** Returns null if the user has no key, or the call fails for any reason. */
  async tryParse(userId: string, text: string, ctx: ParseContext): Promise<ParseHit | null> {
    const row = await this.prisma.userAiKey.findUnique({ where: { userId } });
    if (!row || !row.isActive) return null;
    let plain: string;
    try {
      plain = this.enc.open(row.encryptedApiKey);
    } catch {
      return null;
    }

    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    let extraction: LlmExtraction | null = null;
    try {
      const client = new OpenAI({ apiKey: plain, baseURL: row.baseUrl });
      const model =
        row.defaultModel ?? this.config.get<string>('OPENAI_DEFAULT_MODEL') ?? 'gpt-4o-mini';
      const userMsg = `Now in user TZ ${ctx.tz}: ${ctx.now.toISOString()}\n\nInput: ${text}`;
      const res = await client.chat.completions.create(
        {
          model,
          messages: [
            { role: 'system', content: SYS_PROMPT },
            { role: 'user', content: userMsg },
          ],
          response_format: { type: 'json_object' },
          temperature: 0,
        },
        { signal: ctrl.signal },
      );
      const raw = res.choices[0]?.message?.content;
      if (!raw) return null;
      extraction = JSON.parse(raw) as LlmExtraction;
    } catch (e) {
      this.logger.warn(`openai parse failed for userId=${userId}`);
      return null;
    } finally {
      clearTimeout(timer);
    }

    return mapToHit(extraction, ctx);
  }
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
        previewText: `💸 ${title} — ${x.amount.toLocaleString('vi-VN')} ₫`,
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
        previewText: `💰 ${title} — +${x.amount.toLocaleString('vi-VN')} ₫`,
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
        previewText: `🍚 ${title}`,
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
        previewText: `✓ ${title}`,
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
        previewText: `💤 ${(x.durationMinutes / 60).toFixed(1)} tiếng`,
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
        previewText: `🎯 ${x.mood.toLowerCase()}`,
      };
    default:
      return null;
  }
}
