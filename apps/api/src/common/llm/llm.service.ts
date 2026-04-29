/**
 * Centralised gateway to OpenAI (round 29).
 *
 * Every AI feature in the codebase routes through this service rather than
 * instantiating `new OpenAI(...)` directly. Benefits:
 *
 *   1. **One place for the user-key dance.** Decrypt the per-user key,
 *      catch decrypt failures, surface as `LlmError(AI_KEY_DECRYPT_FAILED)`
 *      instead of a Prisma exception leaking out.
 *   2. **Tier-based model routing.** Callers ask for `fast` or `smart`;
 *      the service picks `OPENAI_FAST_MODEL` / `OPENAI_SMART_MODEL` from env
 *      (per-user `defaultModel` still wins when set). This means swapping
 *      `gpt-5.4-mini` → `gpt-5.5` for capture is one env change, not a
 *      grep across the codebase.
 *   3. **Responses API + Structured Outputs.** Two methods cover 95% of
 *      callers:
 *        - `responsesJson(req)` — strict JSON schema, returns typed T.
 *        - `responsesStream(req)` — async-iterable of `delta` / `done` /
 *          `error` events for UI streaming.
 *      The old `chat.completions.create + response_format: json_object`
 *      path still works under the hood for legacy callers but is
 *      deprecated in this codebase.
 *   4. **Uniform error mapping.** OpenAI's `status: 401 / 429 / AbortError`
 *      become `LlmError(AI_KEY_REJECTED / AI_QUOTA_EXCEEDED / AI_TIMEOUT)`,
 *      so callers don't all have to match HTTP status codes themselves.
 *   5. **Usage logging.** Every call writes an `AiUsageLog` row (latency,
 *      success, errorCode, feature) so we can audit cost per feature later.
 */
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { EncryptionService } from '../crypto/encryption.service';
import { PrismaService } from '../../prisma/prisma.service';
import {
  LlmError,
  type LlmJsonRequest,
  type LlmStreamEvent,
  type LlmStreamRequest,
  type LlmTextRequest,
  type LlmTier,
} from './llm.types';

const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_MAX_OUTPUT_TOKENS = 800;

interface ResolvedKey {
  apiKey: string;
  baseUrl: string;
  modelOverride: string | null;
}

@Injectable()
export class LlmService {
  private readonly logger = new Logger(LlmService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly enc: EncryptionService,
    private readonly config: ConfigService,
  ) {}

  // ── Public API ───────────────────────────────────────────────────────────

  /**
   * Run a Responses-API call with strict JSON schema. Returns the parsed
   * (and optionally validated) object. Throws `LlmError` on any failure —
   * never returns a malformed value.
   */
  async responsesJson<T>(req: LlmJsonRequest<T>): Promise<T> {
    const key = await this.resolveKey(req.userId);
    const model = this.pickModel(req.tier, req.modelOverride ?? key.modelOverride);
    const client = new OpenAI({ apiKey: key.apiKey, baseURL: key.baseUrl });
    const ctrl = new AbortController();
    const timeout = setTimeout(() => ctrl.abort(), req.timeoutMs ?? DEFAULT_TIMEOUT_MS);
    const startedAt = Date.now();

    try {
      const res = await client.responses.create(
        {
          model,
          input: req.input,
          ...(req.instructions ? { instructions: req.instructions } : {}),
          text: {
            format: {
              type: 'json_schema',
              name: req.schema.name,
              strict: req.schema.strict ?? true,
              schema: req.schema.schema,
            },
          },
          temperature: req.temperature ?? 0,
          max_output_tokens: req.maxOutputTokens ?? DEFAULT_MAX_OUTPUT_TOKENS,
        },
        { signal: ctrl.signal },
      );

      const text = extractOutputText(res);
      if (!text) {
        await this.logUsage(req, model, startedAt, false, 'AI_SCHEMA_VIOLATION');
        throw new LlmError('AI_SCHEMA_VIOLATION', 'LLM returned no text output');
      }

      let parsed: unknown;
      try {
        parsed = JSON.parse(text);
      } catch (e) {
        await this.logUsage(req, model, startedAt, false, 'AI_SCHEMA_VIOLATION');
        throw new LlmError('AI_SCHEMA_VIOLATION', 'LLM output was not valid JSON', e);
      }

      const value = req.validate ? req.validate(parsed) : (parsed as T);
      await this.logUsage(req, model, startedAt, true, null);
      return value;
    } catch (e) {
      throw this.mapError(e, req, model, startedAt);
    } finally {
      clearTimeout(timeout);
    }
  }

  /**
   * Run a Responses-API call as a streaming generator. Yields `delta`
   * events as text arrives; one `done` at the end with the assembled text;
   * one `error` if anything goes wrong (then the generator returns).
   *
   * Does NOT throw — errors come through the event channel so transports
   * (SSE, WebSocket) can serialise them uniformly with the success path.
   */
  async *responsesStream(req: LlmStreamRequest): AsyncGenerator<LlmStreamEvent, void, unknown> {
    let key: ResolvedKey;
    try {
      key = await this.resolveKey(req.userId);
    } catch (e) {
      const code = e instanceof LlmError ? e.code : 'AI_UNAVAILABLE';
      yield { type: 'error', code, message: (e as Error).message };
      return;
    }

    const model = this.pickModel(req.tier, req.modelOverride ?? key.modelOverride);
    const client = new OpenAI({ apiKey: key.apiKey, baseURL: key.baseUrl });
    const ctrl = new AbortController();
    const timeout = setTimeout(() => ctrl.abort(), req.timeoutMs ?? DEFAULT_TIMEOUT_MS);
    if (req.signal) {
      // Forward the caller's abort signal — letting Stop hooks in the UI cut
      // a long answer mid-flight.
      req.signal.addEventListener('abort', () => ctrl.abort(), { once: true });
    }
    const startedAt = Date.now();

    let assembled = '';
    try {
      const stream = await client.responses.create(
        {
          model,
          input: req.input,
          ...(req.instructions ? { instructions: req.instructions } : {}),
          temperature: req.temperature ?? 0.7,
          max_output_tokens: req.maxOutputTokens ?? DEFAULT_MAX_OUTPUT_TOKENS,
          stream: true,
        },
        { signal: ctrl.signal },
      );

      for await (const event of stream as unknown as AsyncIterable<{
        type?: string;
        delta?: string;
      }>) {
        // Only `response.output_text.delta` carries user-visible text. Tool
        // calls / other events are no-ops for the assistant-chat use case.
        if (event.type === 'response.output_text.delta' && typeof event.delta === 'string') {
          assembled += event.delta;
          yield { type: 'delta', delta: event.delta };
        }
      }

      yield { type: 'done', finalText: assembled };
      await this.logUsage(req, model, startedAt, true, null);
    } catch (e) {
      const mapped = this.mapError(e, req, model, startedAt);
      yield { type: 'error', code: mapped.code, message: mapped.message };
    } finally {
      clearTimeout(timeout);
    }
  }

  /** Plain-text Responses call (no schema). Used by the rare caller that
   *  just wants prose back, not JSON. Throws `LlmError` on failure. */
  async responsesText(req: LlmTextRequest): Promise<string> {
    const key = await this.resolveKey(req.userId);
    const model = this.pickModel(req.tier, req.modelOverride ?? key.modelOverride);
    const client = new OpenAI({ apiKey: key.apiKey, baseURL: key.baseUrl });
    const ctrl = new AbortController();
    const timeout = setTimeout(() => ctrl.abort(), req.timeoutMs ?? DEFAULT_TIMEOUT_MS);
    const startedAt = Date.now();

    try {
      const res = await client.responses.create(
        {
          model,
          input: req.input,
          ...(req.instructions ? { instructions: req.instructions } : {}),
          temperature: req.temperature ?? 0.7,
          max_output_tokens: req.maxOutputTokens ?? DEFAULT_MAX_OUTPUT_TOKENS,
        },
        { signal: ctrl.signal },
      );
      const text = extractOutputText(res);
      if (!text) {
        await this.logUsage(req, model, startedAt, false, 'AI_UNAVAILABLE');
        throw new LlmError('AI_UNAVAILABLE', 'LLM returned no text');
      }
      await this.logUsage(req, model, startedAt, true, null);
      return text;
    } catch (e) {
      throw this.mapError(e, req, model, startedAt);
    } finally {
      clearTimeout(timeout);
    }
  }

  // ── Internals ────────────────────────────────────────────────────────────

  private async resolveKey(userId: string): Promise<ResolvedKey> {
    const row = await this.prisma.userAiKey.findUnique({ where: { userId } });
    if (!row || !row.isActive) {
      throw new LlmError('AI_KEY_MISSING', 'User has no active AI key');
    }
    let apiKey: string;
    try {
      apiKey = this.enc.open(row.encryptedApiKey);
    } catch (e) {
      throw new LlmError('AI_KEY_DECRYPT_FAILED', 'Could not decrypt user AI key', e);
    }
    return {
      apiKey,
      baseUrl: row.baseUrl,
      modelOverride: row.defaultModel,
    };
  }

  private pickModel(tier: LlmTier, override: string | null | undefined): string {
    if (override) return override;
    const envKey = tier === 'fast' ? 'OPENAI_FAST_MODEL' : 'OPENAI_SMART_MODEL';
    return (
      this.config.get<string>(envKey) ??
      this.config.get<string>('OPENAI_DEFAULT_MODEL') ??
      'gpt-5.4-mini'
    );
  }

  private mapError(
    e: unknown,
    req: { feature: string; userId: string },
    model: string,
    startedAt: number,
  ): LlmError {
    if (e instanceof LlmError) {
      void this.logUsage(req, model, startedAt, false, e.code);
      return e;
    }
    const err = e as { status?: number; name?: string; message?: string };
    let code: LlmError['code'];
    if (err?.name === 'AbortError') code = 'AI_TIMEOUT';
    else if (err?.status === 401) code = 'AI_KEY_REJECTED';
    else if (err?.status === 429) code = 'AI_QUOTA_EXCEEDED';
    else code = 'AI_UNAVAILABLE';

    void this.logUsage(req, model, startedAt, false, code);
    this.logger.warn(
      `llm call failed feature=${req.feature} model=${model} status=${err?.status} code=${code}`,
    );
    return new LlmError(code, err?.message ?? 'LLM call failed', e);
  }

  /** Best-effort usage row write. A failure here must never break the caller. */
  private async logUsage(
    req: { feature: string; userId: string },
    model: string,
    startedAt: number,
    success: boolean,
    errorCode: string | null,
  ): Promise<void> {
    try {
      await this.prisma.aiUsageLog.create({
        data: {
          userId: req.userId,
          feature: req.feature,
          model,
          success,
          errorCode,
          latencyMs: Date.now() - startedAt,
        },
      });
    } catch {
      /* swallow — telemetry shouldn't break user requests */
    }
  }
}

/**
 * Extract the assistant-visible text from a non-streaming Responses object.
 * The SDK exposes a convenience field `output_text` that joins all output
 * text items, which is what we want here.
 */
function extractOutputText(res: unknown): string | null {
  const r = res as { output_text?: string };
  return typeof r.output_text === 'string' ? r.output_text : null;
}
