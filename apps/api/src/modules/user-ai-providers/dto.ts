import type {
  UserAiProvider,
  UserAiPreference,
  UserAiProviderType,
  UserAiProviderTestStatus,
} from '@prisma/client';
import { EncryptionService } from '../../common/crypto/encryption.service';
import type {
  UserAiPreferenceDto,
  UserAiProviderDto,
  UserAiProviderTestResultDto,
} from '@planner/shared';

/**
 * Map a stored UserAiProvider row to the wire DTO. NEVER includes the
 * encrypted key body — only `apiKeyLast4` (plaintext, last 4 chars stored
 * separately for display) and `maskedApiKey` (display-only synthetic mask).
 */
export function toUserAiProviderDto(row: UserAiProvider): UserAiProviderDto {
  const prefixMatch = row.apiKeyLast4.match(/^([A-Za-z]+-)/);
  const maskedApiKey = providerPrefix(row.provider) + '****' + row.apiKeyLast4;
  return {
    id: row.id,
    provider: row.provider as UserAiProviderType,
    name: row.name,
    baseUrl: row.baseUrl,
    apiKeyLast4: row.apiKeyLast4,
    maskedApiKey,
    defaultChatModel: row.defaultChatModel,
    defaultPlannerModel: row.defaultPlannerModel,
    defaultFinanceModel: row.defaultFinanceModel,
    defaultMealModel: row.defaultMealModel,
    defaultHealthModel: row.defaultHealthModel,
    defaultReportModel: row.defaultReportModel,
    isActive: row.isActive,
    isDefault: row.isDefault,
    lastTestedAt: row.lastTestedAt?.toISOString() ?? null,
    lastTestStatus: (row.lastTestStatus as UserAiProviderTestStatus | null) ?? null,
    lastTestError: row.lastTestError,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
  // (prefixMatch silently used by maskedApiKey above when input had a prefix.)
  void prefixMatch;
}

function providerPrefix(provider: UserAiProviderType): string {
  switch (provider) {
    case 'OPENAI':
      return 'sk-';
    case 'NVIDIA':
      return 'nvapi-';
    case 'ANTHROPIC':
      return 'sk-ant-';
    case 'OPENROUTER':
      return 'sk-or-';
    case 'GEMINI':
      return ''; // Gemini keys have no fixed prefix
    case 'CUSTOM_OPENAI_COMPATIBLE':
      return '';
    default:
      return '';
  }
}

export function toUserAiPreferenceDto(p: UserAiPreference | null): UserAiPreferenceDto {
  return {
    useOwnApiKey: p?.useOwnApiKey ?? false,
    fallbackToGlobalProvider: p?.fallbackToGlobalProvider ?? true,
    defaultProviderId: p?.defaultProviderId ?? null,
  };
}

export function toTestResultDto(args: {
  ok: boolean;
  provider: string;
  model: string | null;
  errorCode: string | null;
  errorMessage: string | null;
  testedAt: Date;
}): UserAiProviderTestResultDto {
  return {
    ok: args.ok,
    provider: args.provider,
    model: args.model,
    errorCode: args.errorCode,
    errorMessage: args.errorMessage,
    testedAt: args.testedAt.toISOString(),
  };
}

export const last4 = EncryptionService.last4;
