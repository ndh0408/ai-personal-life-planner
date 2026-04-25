import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { UserAiProvider } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { EncryptionService } from '../../../common/crypto/encryption.service';
import {
  AiCompletionRequest,
  AiCompletionResponse,
  AiProvider,
} from '../providers/ai-provider.interface';
import { AI_PROVIDER_TOKEN } from '../providers/ai-provider.factory';
import {
  buildUserProvider,
  InvalidUserProviderConfigError,
} from '../providers/user-provider.builder';
import { AiProviderService, briefAiError, OrchestratorOptions } from './ai-provider.service';

export type AiTask =
  | 'chat'
  | 'planner'
  | 'finance'
  | 'meal'
  | 'health'
  | 'report';

const TASK_FIELD: Record<AiTask, keyof Pick<UserAiProvider,
  | 'defaultChatModel'
  | 'defaultPlannerModel'
  | 'defaultFinanceModel'
  | 'defaultMealModel'
  | 'defaultHealthModel'
  | 'defaultReportModel'
>> = {
  chat: 'defaultChatModel',
  planner: 'defaultPlannerModel',
  finance: 'defaultFinanceModel',
  meal: 'defaultMealModel',
  health: 'defaultHealthModel',
  report: 'defaultReportModel',
};

/**
 * Resolves which AI provider should handle a given user's request, and runs
 * the completion through {@link AiProviderService} for shared timeout/retry/
 * logging behaviour.
 *
 * Decision order (per task):
 *   1. UserAiPreference.useOwnApiKey === true AND a usable UserAiProvider →
 *      build an ephemeral client, call it. On error:
 *        - fallbackToGlobalProvider → fall through to (3)
 *        - else → USER_AI_PROVIDER_FAILED (502)
 *   2. useOwnApiKey === false → straight to global (3).
 *   3. Global provider (env-configured) — when missing/mock and no user
 *      provider, throw AI_PROVIDER_NOT_CONFIGURED.
 *
 * The decrypted user API key is held only for the lifetime of the call and
 * never logged. Per-request log lines record `provider`, `model`, `task`,
 * `usedFallback`, and `userScope` (user|global) only.
 */
@Injectable()
export class AiProviderResolverService {
  private readonly logger = new Logger(AiProviderResolverService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly encryption: EncryptionService,
    private readonly config: ConfigService,
    private readonly orchestrator: AiProviderService,
    @Inject(AI_PROVIDER_TOKEN) private readonly globalProvider: AiProvider,
  ) {}

  /**
   * Run an AI completion for a user, picking the right provider per the
   * BYOK rules above. Returns the same shape as
   * {@link AiProviderService.complete} plus `usedFallback`.
   */
  async completeForUser(
    userId: string,
    task: AiTask,
    req: AiCompletionRequest,
    opts: OrchestratorOptions = {},
  ): Promise<AiCompletionResponse & { usedFallback: boolean; userScope: 'user' | 'global' }> {
    const pref = await this.prisma.userAiPreference.findUnique({ where: { userId } });
    const useOwn = pref?.useOwnApiKey ?? false;
    const allowFallback = pref?.fallbackToGlobalProvider ?? true;

    if (useOwn) {
      const userProvider = await this.pickUserProvider(userId, task, pref?.defaultProviderId);
      if (userProvider) {
        try {
          const ephemeral = this.buildClient(userProvider, task);
          const result = await this.orchestrator.complete(req, opts, ephemeral);
          this.logger.log(
            `task=${task} userScope=user provider=${result.provider} model=${result.model}`,
          );
          return { ...result, usedFallback: false, userScope: 'user' };
        } catch (err) {
          this.logger.warn(
            `task=${task} userScope=user provider=${userProvider.provider} failed: ${briefAiError(err)}`,
          );
          if (!allowFallback) {
            throw new ServiceUnavailableException({
              message: 'User AI provider failed',
              errorCode: 'USER_AI_PROVIDER_FAILED',
            });
          }
          // fall through to global with usedFallback=true
        }
      } else if (!allowFallback) {
        throw new BadRequestException({
          message: 'No usable user AI provider configured',
          errorCode: 'AI_PROVIDER_NOT_CONFIGURED',
        });
      }
    }

    // Global path
    if (!this.isGlobalUsable()) {
      throw new ServiceUnavailableException({
        message: 'No AI provider configured',
        errorCode: 'AI_PROVIDER_NOT_CONFIGURED',
      });
    }
    const result = await this.orchestrator.complete(req, opts);
    this.logger.log(
      `task=${task} userScope=global provider=${result.provider} model=${result.model}`,
    );
    return { ...result, usedFallback: useOwn, userScope: 'global' };
  }

  /**
   * Run a single low-cost call against a stored user provider — used by the
   * "Test connection" endpoint. Returns the response on success; on failure
   * throws the underlying provider error so the controller can record
   * `lastTestError` accurately.
   *
   * We deliberately bypass the orchestrator's retry/log logic so a transient
   * upstream blip is reported clearly to the user instead of being silently
   * retried.
   */
  async testProvider(
    record: UserAiProvider,
    timeoutMs = 12_000,
  ): Promise<AiCompletionResponse> {
    const ephemeral = this.buildClient(record, 'chat');
    const probe: AiCompletionRequest = {
      system: 'You are a connectivity probe. Respond with a single word.',
      prompt: 'pong',
      maxTokens: 8,
      temperature: 0,
    };
    return this.withTimeout(ephemeral.complete(probe), timeoutMs);
  }

  private async pickUserProvider(
    userId: string,
    task: AiTask,
    preferredId?: string | null,
  ): Promise<UserAiProvider | null> {
    if (preferredId) {
      const explicit = await this.prisma.userAiProvider.findFirst({
        where: { id: preferredId, userId, isActive: true },
      });
      if (explicit) return explicit;
    }
    const def = await this.prisma.userAiProvider.findFirst({
      where: { userId, isActive: true, isDefault: true },
    });
    if (def) return def;
    return this.prisma.userAiProvider.findFirst({
      where: { userId, isActive: true },
      orderBy: { createdAt: 'asc' },
    });
  }

  private buildClient(record: UserAiProvider, task: AiTask): AiProvider {
    const decryptedApiKey = this.encryption.decrypt(record.encryptedApiKey);
    const taskModel = (record[TASK_FIELD[task]] as string | null) ?? null;
    const fallbackModel =
      taskModel ?? record.defaultChatModel ?? this.config.get<string>('AI_MODEL') ?? '';
    if (!fallbackModel) {
      throw new InvalidUserProviderConfigError(
        `No model configured for task=${task} on provider=${record.provider}`,
      );
    }
    return buildUserProvider(
      {
        provider: record.provider,
        baseUrl: record.baseUrl,
        decryptedApiKey,
        model: fallbackModel,
      },
      this.config,
    );
  }

  private isGlobalUsable(): boolean {
    // The factory falls back to MockAiProvider when AI_API_KEY is missing.
    // Mock is only "usable" in non-production for development convenience.
    if (this.globalProvider.name !== 'mock') return true;
    return this.config.get<string>('NODE_ENV') !== 'production';
  }

  private async withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
    let timer: NodeJS.Timeout | undefined;
    const tp = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error(`Timed out after ${ms}ms`)), ms);
    });
    try {
      return await Promise.race([p, tp]);
    } finally {
      if (timer) clearTimeout(timer);
    }
  }
}
