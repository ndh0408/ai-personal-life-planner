import { ConfigService } from '@nestjs/config';
import { ServiceUnavailableException } from '@nestjs/common';
import { EncryptionService } from '../../../common/crypto/encryption.service';
import { AiProviderResolverService } from './ai-provider-resolver.service';
import { AiProviderService } from './ai-provider.service';
import { MockAiProvider } from '../providers/mock.provider';
import type { UserAiProvider, UserAiPreference } from '@prisma/client';
import type { AiProvider } from '../providers/ai-provider.interface';
import { makeStubUsage } from './test-helpers';

function makeConfig(env: Record<string, string | undefined> = {}): ConfigService {
  return {
    get: <T>(k: string) => env[k] as T | undefined,
  } as unknown as ConfigService;
}

function makeEncryption(): EncryptionService {
  return new EncryptionService(makeConfig({ AI_PROVIDER_ENCRYPTION_KEY: 'a'.repeat(64) }));
}

function makePrisma(args: {
  pref: Partial<UserAiPreference> | null;
  providers: UserAiProvider[];
}) {
  return {
    userAiPreference: { findUnique: jest.fn(async () => args.pref) },
    userAiProvider: {
      findFirst: jest.fn(async ({ where, orderBy }: any) => {
        let list = args.providers.filter((p) => p.userId === where.userId);
        if (where.id) list = list.filter((p) => p.id === where.id);
        if (where.isActive !== undefined) list = list.filter((p) => p.isActive === where.isActive);
        if (where.isDefault !== undefined) list = list.filter((p) => p.isDefault === where.isDefault);
        if (orderBy?.createdAt === 'asc') {
          list.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
        }
        return list[0] ?? null;
      }),
    },
  };
}

const baseRow = (overrides: Partial<UserAiProvider> = {}): UserAiProvider => ({
  id: 'u-default',
  userId: 'user-A',
  provider: 'OPENAI' as const,
  name: 'OAI',
  baseUrl: null,
  encryptedApiKey: '',
  apiKeyLast4: 'cdef',
  defaultChatModel: 'gpt-4o-mini',
  defaultPlannerModel: null,
  defaultFinanceModel: null,
  defaultMealModel: null,
  defaultHealthModel: null,
  defaultReportModel: null,
  isActive: true,
  isDefault: true,
  lastTestedAt: null,
  lastTestStatus: null,
  lastTestError: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

describe('AiProviderResolverService.completeForUser', () => {
  it('uses global provider when useOwnApiKey=false', async () => {
    const prisma = makePrisma({ pref: null, providers: [] });
    const orchestrator = new AiProviderService(new MockAiProvider(), makeStubUsage());
    const globalSpy: AiProvider = { name: 'mock', complete: jest.fn(async () => ({ text: '{}', provider: 'mock', model: 'mock' })) };
    const svc = new AiProviderResolverService(
      prisma as never,
      makeEncryption(),
      makeConfig({ NODE_ENV: 'test' }),
      orchestrator,
      globalSpy,
    );

    // The resolver only consults globalProvider for the gate — actual call goes
    // through the orchestrator's wrapped global provider.
    const r = await svc.completeForUser('user-A', 'chat', { system: '', prompt: '' });
    expect(r.userScope).toBe('global');
    expect(r.usedFallback).toBe(false);
  });

  it('uses user provider when useOwnApiKey=true and a config exists', async () => {
    const enc = makeEncryption();
    const row = baseRow({ encryptedApiKey: enc.encrypt('sk-xyz'), defaultChatModel: 'm' });
    const prisma = makePrisma({
      pref: { userId: 'user-A', useOwnApiKey: true, fallbackToGlobalProvider: true, defaultProviderId: null } as any,
      providers: [row],
    });
    const orchestrator = new AiProviderService(new MockAiProvider(), makeStubUsage());
    // Spy on orchestrator.complete to verify the override (ephemeral) is passed.
    const spy = jest
      .spyOn(orchestrator, 'complete')
      .mockResolvedValue({ text: '{}', provider: 'openai', model: 'm' });

    const svc = new AiProviderResolverService(
      prisma as never,
      enc,
      makeConfig({ NODE_ENV: 'test' }),
      orchestrator,
      { name: 'mock', complete: async () => ({ text: '{}', provider: 'mock', model: 'mock' }) },
    );

    const r = await svc.completeForUser('user-A', 'chat', { system: '', prompt: '' });
    expect(r.userScope).toBe('user');
    expect(spy).toHaveBeenCalled();
    // The 3rd arg is the ephemeral provider — must be present.
    expect(spy.mock.calls[0][2]).toBeDefined();
  });

  it('falls back to global on user-provider error when fallbackToGlobalProvider=true', async () => {
    const enc = makeEncryption();
    const row = baseRow({ encryptedApiKey: enc.encrypt('sk-broken'), defaultChatModel: 'm' });
    const prisma = makePrisma({
      pref: { userId: 'user-A', useOwnApiKey: true, fallbackToGlobalProvider: true, defaultProviderId: null } as any,
      providers: [row],
    });
    const orchestrator = new AiProviderService(new MockAiProvider(), makeStubUsage());
    const spy = jest.spyOn(orchestrator, 'complete')
      // First call (user-scope) blows up
      .mockRejectedValueOnce(new Error('upstream 500'))
      // Second call (global-scope) succeeds
      .mockResolvedValueOnce({ text: '{}', provider: 'mock', model: 'mock' });

    const svc = new AiProviderResolverService(
      prisma as never,
      enc,
      makeConfig({ NODE_ENV: 'test' }),
      orchestrator,
      { name: 'mock', complete: async () => ({ text: '{}', provider: 'mock', model: 'mock' }) },
    );

    const r = await svc.completeForUser('user-A', 'chat', { system: '', prompt: '' });
    expect(spy).toHaveBeenCalledTimes(2);
    expect(r.userScope).toBe('global');
    expect(r.usedFallback).toBe(true);
  });

  it('throws USER_AI_PROVIDER_FAILED when fallback disabled', async () => {
    const enc = makeEncryption();
    const row = baseRow({ encryptedApiKey: enc.encrypt('sk-broken'), defaultChatModel: 'm' });
    const prisma = makePrisma({
      pref: { userId: 'user-A', useOwnApiKey: true, fallbackToGlobalProvider: false, defaultProviderId: null } as any,
      providers: [row],
    });
    const orchestrator = new AiProviderService(new MockAiProvider(), makeStubUsage());
    jest.spyOn(orchestrator, 'complete').mockRejectedValue(new Error('upstream 500'));

    const svc = new AiProviderResolverService(
      prisma as never,
      enc,
      makeConfig({ NODE_ENV: 'test' }),
      orchestrator,
      { name: 'mock', complete: async () => ({ text: '{}', provider: 'mock', model: 'mock' }) },
    );

    await expect(svc.completeForUser('user-A', 'chat', { system: '', prompt: '' })).rejects
      .toBeInstanceOf(ServiceUnavailableException);
  });

  it('throws AI_PROVIDER_NOT_CONFIGURED in production when global is mock', async () => {
    const prisma = makePrisma({ pref: null, providers: [] });
    const orchestrator = new AiProviderService(new MockAiProvider(), makeStubUsage());
    const svc = new AiProviderResolverService(
      prisma as never,
      makeEncryption(),
      makeConfig({ NODE_ENV: 'production' }),
      orchestrator,
      { name: 'mock', complete: async () => ({ text: '{}', provider: 'mock', model: 'mock' }) },
    );

    await expect(svc.completeForUser('user-A', 'chat', { system: '', prompt: '' })).rejects
      .toBeInstanceOf(ServiceUnavailableException);
  });
});
