import { Injectable, Logger } from '@nestjs/common';
import { ZodSchema, ZodError } from 'zod';
import { AiProviderService } from './ai-provider.service';

export class AiInvalidJsonError extends Error {
  constructor(message: string, public readonly raw: string) {
    super(message);
    this.name = 'AiInvalidJsonError';
  }
}

const FENCE_RE = /```(?:json)?\s*([\s\S]*?)\s*```/i;

function stripFences(text: string): string {
  const m = FENCE_RE.exec(text);
  return m ? m[1].trim() : text.trim();
}

/** Best-effort JSON extraction from a possibly-noisy LLM response. */
function tryParse(text: string): unknown {
  const cleaned = stripFences(text);
  try {
    return JSON.parse(cleaned);
  } catch {
    // Fallback: extract the first balanced JSON object/array we can find.
    const candidate = extractBalanced(cleaned);
    if (candidate) {
      try {
        return JSON.parse(candidate);
      } catch {
        /* fall through */
      }
    }
    throw new SyntaxError('Could not parse JSON');
  }
}

function extractBalanced(text: string): string | null {
  for (const open of ['{', '['] as const) {
    const close = open === '{' ? '}' : ']';
    const start = text.indexOf(open);
    if (start === -1) continue;
    let depth = 0;
    for (let i = start; i < text.length; i++) {
      const ch = text[i];
      if (ch === open) depth++;
      else if (ch === close) {
        depth--;
        if (depth === 0) return text.slice(start, i + 1);
      }
    }
  }
  return null;
}

@Injectable()
export class AiJsonValidationService {
  private readonly logger = new Logger(AiJsonValidationService.name);

  constructor(private readonly provider: AiProviderService) {}

  /**
   * Parse + Zod-validate the AI text. If parse or validation fails, ask the
   * provider ONCE to repair the JSON, then validate again. If that still
   * fails, throws AiInvalidJsonError.
   */
  async parseAndValidate<T>(
    raw: string,
    schema: ZodSchema<T>,
    repairContext: { task: string; system: string },
  ): Promise<T> {
    const fromRaw = this.tryValidate(raw, schema);
    if (fromRaw.ok) return fromRaw.value;

    this.logger.warn(`AI JSON invalid (${fromRaw.reason}); attempting repair for ${repairContext.task}`);

    const repairPrompt = [
      `The previous response for task "${repairContext.task}" was not valid JSON or did not match the required schema.`,
      'Reasons:',
      fromRaw.reason,
      '',
      'Original response (verbatim):',
      '```',
      raw.slice(0, 4000),
      '```',
      '',
      'Re-emit the response as RAW JSON only. No commentary, no markdown fences.',
    ].join('\n');

    const repaired = await this.provider.complete(
      {
        system: repairContext.system,
        prompt: repairPrompt,
        jsonMode: true,
        temperature: 0,
        maxTokens: 1500,
      },
      { maxAttempts: 1, timeoutMs: 15_000 },
    );

    const second = this.tryValidate(repaired.text, schema);
    if (second.ok) return second.value;

    throw new AiInvalidJsonError(`AI response still invalid after repair: ${second.reason}`, raw);
  }

  private tryValidate<T>(
    raw: string,
    schema: ZodSchema<T>,
  ): { ok: true; value: T } | { ok: false; reason: string } {
    let parsed: unknown;
    try {
      parsed = tryParse(raw);
    } catch (e) {
      return { ok: false, reason: e instanceof Error ? e.message : 'parse error' };
    }
    const result = schema.safeParse(parsed);
    if (result.success) return { ok: true, value: result.data };
    const reason =
      result.error instanceof ZodError
        ? result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')
        : 'validation error';
    return { ok: false, reason };
  }
}
