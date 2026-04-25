import {
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, type UserAiProvider } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { EncryptionService } from '../../common/crypto/encryption.service';
import {
  AiProviderResolverService,
} from '../ai/services/ai-provider-resolver.service';
import { briefAiError } from '../ai/services/ai-provider.service';
import {
  InvalidUserProviderConfigError,
  validateUserBaseUrl,
} from '../ai/providers/user-provider.builder';
import type {
  CreateUserAiProviderInput,
  UpdateUserAiProviderInput,
} from '@planner/shared';

/**
 * CRUD + connectivity-test for user-supplied AI provider configs.
 *
 * Security invariants:
 *   - Every read/write filters by `userId` from the authed JWT (never trust
 *     client input).
 *   - Plaintext API keys exist only inside `create`/`update`/`testProvider`
 *     stack frames; the encrypted form is what hits the DB and the DTO
 *     mappers in `dto.ts` are the only allowed shape leaving the service.
 *   - The audit logger never receives plaintext keys, prompts, or responses —
 *     only metadata (provider, model, success/failure, brief error class).
 */
@Injectable()
export class UserAiProviderService {
  private readonly logger = new Logger(UserAiProviderService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly encryption: EncryptionService,
    private readonly resolver: AiProviderResolverService,
  ) {}

  list(userId: string): Promise<UserAiProvider[]> {
    return this.prisma.userAiProvider.findMany({
      where: { userId },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
    });
  }

  async get(userId: string, id: string): Promise<UserAiProvider> {
    const row = await this.prisma.userAiProvider.findUnique({ where: { id } });
    if (!row) throw new NotFoundException({ message: 'Provider not found', errorCode: 'NOT_FOUND' });
    if (row.userId !== userId) throw new ForbiddenException({ errorCode: 'FORBIDDEN' });
    return row;
  }

  async create(userId: string, input: CreateUserAiProviderInput): Promise<UserAiProvider> {
    if (!input.apiKey?.trim()) {
      throw new ConflictException({
        message: 'apiKey required',
        errorCode: 'INVALID_PROVIDER_CONFIG',
      });
    }

    if (input.baseUrl?.trim()) {
      try {
        validateUserBaseUrl(input.baseUrl.trim());
      } catch (e) {
        throw new ConflictException({
          message: e instanceof InvalidUserProviderConfigError ? e.message : 'Invalid baseUrl',
          errorCode: 'INVALID_PROVIDER_CONFIG',
        });
      }
    }

    const apiKey = input.apiKey.trim();
    const encryptedApiKey = this.encryption.encrypt(apiKey);
    const apiKeyLast4 = EncryptionService.last4(apiKey);

    const data: Prisma.UserAiProviderCreateInput = {
      user: { connect: { id: userId } },
      provider: input.provider,
      name: input.name.trim(),
      baseUrl: input.baseUrl?.trim() || null,
      encryptedApiKey,
      apiKeyLast4,
      defaultChatModel: input.defaultChatModel ?? null,
      defaultPlannerModel: input.defaultPlannerModel ?? null,
      defaultFinanceModel: input.defaultFinanceModel ?? null,
      defaultMealModel: input.defaultMealModel ?? null,
      defaultHealthModel: input.defaultHealthModel ?? null,
      defaultReportModel: input.defaultReportModel ?? null,
      isDefault: input.isDefault ?? false,
    };

    try {
      return await this.prisma.$transaction(async (tx) => {
        if (data.isDefault) {
          await tx.userAiProvider.updateMany({
            where: { userId, isDefault: true },
            data: { isDefault: false },
          });
        }
        return tx.userAiProvider.create({ data });
      });
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      ) {
        throw new ConflictException({
          message: 'Provider name already in use',
          errorCode: 'CONFLICT',
        });
      }
      throw e;
    }
  }

  async update(
    userId: string,
    id: string,
    input: UpdateUserAiProviderInput,
  ): Promise<UserAiProvider> {
    const existing = await this.get(userId, id);

    const data: Prisma.UserAiProviderUpdateInput = {};
    if (input.name !== undefined) data.name = input.name.trim();
    if (input.baseUrl !== undefined) {
      const candidate = input.baseUrl?.trim() || null;
      if (candidate) {
        try {
          validateUserBaseUrl(candidate);
        } catch (e) {
          throw new ConflictException({
            message: e instanceof InvalidUserProviderConfigError ? e.message : 'Invalid baseUrl',
            errorCode: 'INVALID_PROVIDER_CONFIG',
          });
        }
      }
      data.baseUrl = candidate;
    }
    if (input.defaultChatModel !== undefined) data.defaultChatModel = input.defaultChatModel;
    if (input.defaultPlannerModel !== undefined) data.defaultPlannerModel = input.defaultPlannerModel;
    if (input.defaultFinanceModel !== undefined) data.defaultFinanceModel = input.defaultFinanceModel;
    if (input.defaultMealModel !== undefined) data.defaultMealModel = input.defaultMealModel;
    if (input.defaultHealthModel !== undefined) data.defaultHealthModel = input.defaultHealthModel;
    if (input.defaultReportModel !== undefined) data.defaultReportModel = input.defaultReportModel;
    if (input.isActive !== undefined) data.isActive = input.isActive;

    if (input.apiKey !== undefined && input.apiKey.length > 0) {
      const apiKey = input.apiKey.trim();
      data.encryptedApiKey = this.encryption.encrypt(apiKey);
      data.apiKeyLast4 = EncryptionService.last4(apiKey);
      // Force re-test after key rotation.
      data.lastTestedAt = null;
      data.lastTestStatus = null;
      data.lastTestError = null;
    }

    try {
      return await this.prisma.$transaction(async (tx) => {
        if (input.isDefault === true) {
          await tx.userAiProvider.updateMany({
            where: { userId, isDefault: true, NOT: { id } },
            data: { isDefault: false },
          });
          data.isDefault = true;
        } else if (input.isDefault === false) {
          data.isDefault = false;
        }
        return tx.userAiProvider.update({ where: { id: existing.id }, data });
      });
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      ) {
        throw new ConflictException({
          message: 'Provider name already in use',
          errorCode: 'CONFLICT',
        });
      }
      throw e;
    }
  }

  async delete(userId: string, id: string): Promise<void> {
    const existing = await this.get(userId, id);
    await this.prisma.$transaction(async (tx) => {
      // Clear preference pointers that referenced this provider.
      await tx.userAiPreference.updateMany({
        where: { userId, defaultProviderId: existing.id },
        data: { defaultProviderId: null },
      });
      await tx.userAiProvider.delete({ where: { id: existing.id } });
    });
  }

  /**
   * Run a tiny probe against the user's stored provider; updates `lastTested*`
   * fields and returns a structured outcome. Never logs the raw API key.
   */
  async test(userId: string, id: string): Promise<{
    ok: boolean;
    provider: string;
    model: string | null;
    errorCode: string | null;
    errorMessage: string | null;
    testedAt: Date;
    record: UserAiProvider;
  }> {
    const existing = await this.get(userId, id);
    const startedAt = new Date();
    let updated: UserAiProvider;
    try {
      const res = await this.resolver.testProvider(existing);
      this.logger.log(
        `test ok userId=${userId} provider=${existing.provider} model=${res.model}`,
      );
      updated = await this.prisma.userAiProvider.update({
        where: { id: existing.id },
        data: {
          lastTestedAt: startedAt,
          lastTestStatus: 'SUCCESS',
          lastTestError: null,
        },
      });
      return {
        ok: true,
        provider: res.provider,
        model: res.model,
        errorCode: null,
        errorMessage: null,
        testedAt: startedAt,
        record: updated,
      };
    } catch (err) {
      const message = briefAiError(err, 240);
      this.logger.warn(
        `test failed userId=${userId} provider=${existing.provider}: ${message}`,
      );
      updated = await this.prisma.userAiProvider.update({
        where: { id: existing.id },
        data: {
          lastTestedAt: startedAt,
          lastTestStatus: 'FAILED',
          lastTestError: message,
        },
      });
      return {
        ok: false,
        provider: existing.provider,
        model:
          existing.defaultChatModel ?? existing.defaultPlannerModel ?? null,
        errorCode: 'AI_PROVIDER_TEST_FAILED',
        errorMessage: message,
        testedAt: startedAt,
        record: updated,
      };
    }
  }
}
