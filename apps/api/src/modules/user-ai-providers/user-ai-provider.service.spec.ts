import { ConfigService } from '@nestjs/config';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import type { UserAiProvider } from '@prisma/client';
import { EncryptionService } from '../../common/crypto/encryption.service';
import { UserAiProviderService } from './user-ai-provider.service';
import type { AiProviderResolverService } from '../ai/services/ai-provider-resolver.service';
import type { CreateUserAiProviderInput } from '@planner/shared';

function makeEncryption(): EncryptionService {
  const config = {
    get: <T>(k: string) => (k === 'AI_PROVIDER_ENCRYPTION_KEY' ? ('a'.repeat(64) as T) : undefined),
  } as unknown as ConfigService;
  return new EncryptionService(config);
}

function makePrisma() {
  const rows = new Map<string, UserAiProvider>();
  let idCounter = 0;
  const tx = {
    userAiProvider: {
      updateMany: jest.fn(async ({ where, data }: any) => {
        let count = 0;
        for (const row of rows.values()) {
          if (row.userId === where.userId && row.isDefault === where.isDefault) {
            if (where.NOT?.id && row.id === where.NOT.id) continue;
            rows.set(row.id, { ...row, ...data, updatedAt: new Date() });
            count++;
          }
        }
        return { count };
      }),
      create: jest.fn(async ({ data }: any) => {
        const id = `p-${++idCounter}`;
        const row: UserAiProvider = {
          id,
          userId: data.user.connect.id,
          provider: data.provider,
          name: data.name,
          baseUrl: data.baseUrl ?? null,
          encryptedApiKey: data.encryptedApiKey,
          apiKeyLast4: data.apiKeyLast4,
          defaultChatModel: data.defaultChatModel ?? null,
          defaultPlannerModel: data.defaultPlannerModel ?? null,
          defaultFinanceModel: data.defaultFinanceModel ?? null,
          defaultMealModel: data.defaultMealModel ?? null,
          defaultHealthModel: data.defaultHealthModel ?? null,
          defaultReportModel: data.defaultReportModel ?? null,
          isActive: true,
          isDefault: data.isDefault ?? false,
          lastTestedAt: null,
          lastTestStatus: null,
          lastTestError: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        rows.set(id, row);
        return row;
      }),
      update: jest.fn(async ({ where, data }: any) => {
        const cur = rows.get(where.id);
        if (!cur) throw new Error('not found');
        const next = { ...cur, ...data, updatedAt: new Date() };
        rows.set(where.id, next);
        return next;
      }),
      delete: jest.fn(async ({ where }: any) => rows.delete(where.id)),
    },
    userAiPreference: {
      updateMany: jest.fn(async () => ({ count: 0 })),
    },
  };
  const api = {
    userAiProvider: {
      findUnique: jest.fn(async ({ where }: any) => rows.get(where.id) ?? null),
      findMany: jest.fn(async ({ where }: any) =>
        [...rows.values()].filter((r) => r.userId === where.userId),
      ),
      findFirst: jest.fn(async ({ where }: any) =>
        [...rows.values()].find(
          (r) =>
            r.userId === where.userId &&
            (where.id ? r.id === where.id : true) &&
            (where.isActive !== undefined ? r.isActive === where.isActive : true) &&
            (where.isDefault !== undefined ? r.isDefault === where.isDefault : true),
        ) ?? null,
      ),
      update: tx.userAiProvider.update,
      updateMany: tx.userAiProvider.updateMany,
    },
    $transaction: jest.fn(async (fn: any) => fn(tx)),
  };
  return { api, rows };
}

const stubResolver: AiProviderResolverService = {
  testProvider: jest.fn(async () => ({
    text: 'pong',
    provider: 'openai',
    model: 'mock',
    usage: {},
  })),
} as unknown as AiProviderResolverService;

function baseInput(name = 'OAI'): CreateUserAiProviderInput {
  return {
    provider: 'OPENAI',
    name,
    apiKey: 'sk-1234567890abcdef',
    defaultChatModel: 'gpt-4o-mini',
  };
}

describe('UserAiProviderService', () => {
  it('encrypts the apiKey before persisting and stores last4', async () => {
    const { api } = makePrisma();
    const enc = makeEncryption();
    const svc = new UserAiProviderService(api as never, enc, stubResolver);

    const created = await svc.create('user-A', baseInput());
    expect(created.encryptedApiKey).not.toContain('sk-1234567890abcdef');
    expect(created.encryptedApiKey.startsWith('v1:')).toBe(true);
    expect(created.apiKeyLast4).toBe('cdef');
    expect(enc.decrypt(created.encryptedApiKey)).toBe('sk-1234567890abcdef');
  });

  it('refuses cross-user reads (IDOR)', async () => {
    const { api } = makePrisma();
    const svc = new UserAiProviderService(api as never, makeEncryption(), stubResolver);

    const created = await svc.create('user-A', baseInput());
    await expect(svc.get('user-B', created.id)).rejects.toBeInstanceOf(ForbiddenException);
    await expect(svc.update('user-B', created.id, { name: 'hax' })).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    await expect(svc.delete('user-B', created.id)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('returns NotFound for unknown ids', async () => {
    const { api } = makePrisma();
    const svc = new UserAiProviderService(api as never, makeEncryption(), stubResolver);
    await expect(svc.get('user-A', 'does-not-exist')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('updating apiKey rotates last4 and clears lastTested* fields', async () => {
    const { api } = makePrisma();
    const svc = new UserAiProviderService(api as never, makeEncryption(), stubResolver);

    const created = await svc.create('user-A', baseInput());
    // Simulate a successful prior test.
    await api.userAiProvider.update({
      where: { id: created.id },
      data: { lastTestedAt: new Date(), lastTestStatus: 'SUCCESS' as const, lastTestError: null },
    });

    const updated = await svc.update('user-A', created.id, { apiKey: 'sk-newkey9999wxyz' });
    expect(updated.apiKeyLast4).toBe('wxyz');
    expect(updated.lastTestStatus).toBeNull();
    expect(updated.lastTestedAt).toBeNull();
  });

  it('records SUCCESS in lastTested* on a passing connectivity test', async () => {
    const { api } = makePrisma();
    const svc = new UserAiProviderService(api as never, makeEncryption(), stubResolver);
    const created = await svc.create('user-A', baseInput());

    const result = await svc.test('user-A', created.id);
    expect(result.ok).toBe(true);
    expect(result.errorCode).toBeNull();
    expect(result.record.lastTestStatus).toBe('SUCCESS');
  });

  it('records FAILED + clipped error message on a failing test', async () => {
    const { api } = makePrisma();
    const failingResolver: AiProviderResolverService = {
      testProvider: jest.fn(async () => {
        throw new Error('Unauthorized: invalid api key {"trace":"x".repeat(1000)}');
      }),
    } as unknown as AiProviderResolverService;
    const svc = new UserAiProviderService(api as never, makeEncryption(), failingResolver);
    const created = await svc.create('user-A', baseInput());

    const result = await svc.test('user-A', created.id);
    expect(result.ok).toBe(false);
    expect(result.errorCode).toBe('AI_PROVIDER_TEST_FAILED');
    expect(result.errorMessage).toMatch(/Unauthorized/);
    // Clipped — no leaking trace blob
    expect(result.errorMessage?.length ?? 0).toBeLessThan(260);
    expect(result.record.lastTestStatus).toBe('FAILED');
  });
});
