import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  AiCompletionRequest,
  AiCompletionResponse,
  AiProvider,
  AiTimeoutError,
} from '../providers/ai-provider.interface';
import { AI_PROVIDER_TOKEN } from '../providers/ai-provider.factory';
import { AiUsageService } from '../../ai-usage/ai-usage.service';
import type { AiFeature } from '@prisma/client';

/**
 * Per-call context for the AI usage ledger. Optional so existing internal
 * call sites (mocks, tests) can omit it; AI feature services always pass it
 * so we get a complete audit trail.
 */
export type AiUsageContext = {
  userId: string;
  feature: AiFeature;
  /** When true (default) we assertWithinQuota first, then log. */
  enforceQuota?: boolean;
};

export interface OrchestratorOptions {
  /** Hard upper bound; cancels the call when exceeded. */
  timeoutMs?: number;
  /** Total tries including the first one. */
  maxAttempts?: number;
  /** Delay between retries in ms (linear). */
  retryDelayMs?: number;
}

const DEFAULTS: Required<OrchestratorOptions> = {
  timeoutMs: 25_000,
  maxAttempts: 2,
  retryDelayMs: 800,
};

/**
 * Compact, log-safe representation of an error for AI fallback paths.
 * Truncates length and drops the trailing serialized payload that some
 * provider SDKs append (Anthropic/OpenAI may include the entire request body
 * in `e.message` on validation failures).
 */
export function briefAiError(e: unknown, maxChars = 200): string {
  const raw = e instanceof Error ? `${e.name}: ${e.message}` : String(e);
  // Strip anything from the first JSON-like object boundary onward, and
  // collapse whitespace.
  const clipped = raw.split(/\s*[\{\[]/)[0]?.trim() ?? raw.trim();
  return clipped.slice(0, maxChars);
}

/**
 * Wraps a raw AiProvider with timeout, retry, and audit-friendly logging that
 * NEVER includes user content or API keys.
 */
@Injectable()
export class AiProviderService {
  private readonly logger = new Logger(AiProviderService.name);

  constructor(
    @Inject(AI_PROVIDER_TOKEN) private readonly provider: AiProvider,
    private readonly usage: AiUsageService,
  ) {}

  get providerName(): string {
    return this.provider.name;
  }

  async complete(
    req: AiCompletionRequest,
    opts: OrchestratorOptions = {},
    override?: AiProvider,
    usageCtx?: AiUsageContext,
  ): Promise<AiCompletionResponse> {
    const { timeoutMs, maxAttempts, retryDelayMs } = { ...DEFAULTS, ...opts };
    const target = override ?? this.provider;
    let lastErr: unknown;

    if (usageCtx && usageCtx.enforceQuota !== false) {
      // Throws AI_DAILY_LIMIT_REACHED before we hit the provider.
      await this.usage.assertWithinQuota(usageCtx.userId, usageCtx.feature);
    }

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const started = Date.now();
      try {
        const result = await this.withTimeout(target.complete(req), timeoutMs);
        const elapsed = Date.now() - started;
        this.logger.log(
          `provider=${target.name} attempt=${attempt} elapsedMs=${elapsed} in=${result.usage?.inputTokens ?? '?'} out=${result.usage?.outputTokens ?? '?'}`,
        );
        if (usageCtx) {
          await this.usage.log({
            userId: usageCtx.userId,
            feature: usageCtx.feature,
            provider: target.name,
            model: result.model ?? 'unknown',
            inputTokens: result.usage?.inputTokens,
            outputTokens: result.usage?.outputTokens,
            totalTokens:
              (result.usage?.inputTokens ?? 0) + (result.usage?.outputTokens ?? 0) || null,
            success: true,
            latencyMs: elapsed,
          });
        }
        return result;
      } catch (err) {
        lastErr = err;
        const elapsed = Date.now() - started;
        const tag = err instanceof AiTimeoutError ? 'timeout' : 'error';
        this.logger.warn(
          `provider=${target.name} attempt=${attempt} ${tag} elapsedMs=${elapsed}`,
        );
        if (attempt < maxAttempts) {
          await new Promise((r) => setTimeout(r, retryDelayMs * attempt));
        }
      }
    }
    if (usageCtx) {
      await this.usage.log({
        userId: usageCtx.userId,
        feature: usageCtx.feature,
        provider: target.name,
        model: 'unknown',
        success: false,
        errorCode:
          lastErr instanceof AiTimeoutError ? 'AI_TIMEOUT' : 'AI_PROVIDER_FAILED',
      });
    }
    throw lastErr;
  }

  private async withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
    let timer: NodeJS.Timeout | undefined;
    const timeoutPromise = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new AiTimeoutError(ms)), ms);
    });
    try {
      return await Promise.race([p, timeoutPromise]);
    } finally {
      if (timer) clearTimeout(timer);
    }
  }
}
