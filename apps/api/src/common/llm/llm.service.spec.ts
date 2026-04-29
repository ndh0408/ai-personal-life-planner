import { LlmService } from './llm.service';
import { LlmError } from './llm.types';
import type { PrismaService } from '../../prisma/prisma.service';
import type { EncryptionService } from '../crypto/encryption.service';
import type { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';

jest.mock('openai');

function fakePrisma(opts: { hasKey?: boolean; defaultModel?: string | null } = {}) {
  return {
    userAiKey: {
      findUnique: jest.fn(async () =>
        opts.hasKey === false
          ? null
          : {
              encryptedApiKey: 'iv:ct:tag',
              isActive: true,
              baseUrl: 'https://api.openai.com/v1',
              defaultModel: opts.defaultModel ?? null,
            },
      ),
    },
    aiUsageLog: { create: jest.fn(async () => undefined) },
  } as unknown as PrismaService;
}

function fakeEnc(): EncryptionService {
  return { open: jest.fn(() => 'sk-test') } as unknown as EncryptionService;
}

function fakeConfig(env: Record<string, string>): ConfigService {
  return { get: jest.fn((k: string) => env[k]) } as unknown as ConfigService;
}

describe('LlmService — model routing', () => {
  it("picks OPENAI_FAST_MODEL for tier='fast' when no per-user override", async () => {
    const prisma = fakePrisma();
    const cfg = fakeConfig({ OPENAI_FAST_MODEL: 'gpt-5.4-mini', OPENAI_SMART_MODEL: 'gpt-5.5' });
    const svc = new LlmService(prisma, fakeEnc(), cfg);

    const create = jest.fn(async () => ({ output_text: '{"v":1}' }));
    (OpenAI as unknown as jest.Mock).mockImplementation(() => ({
      responses: { create },
    }));

    await svc.responsesJson({
      userId: 'u1',
      feature: 'test-fast',
      tier: 'fast',
      input: 'x',
      schema: { name: 's', schema: { type: 'object' } },
      validate: (v) => v as { v: number },
    });
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ model: 'gpt-5.4-mini' }),
      expect.anything(),
    );
  });

  it("picks OPENAI_SMART_MODEL for tier='smart'", async () => {
    const prisma = fakePrisma();
    const cfg = fakeConfig({ OPENAI_FAST_MODEL: 'gpt-5.4-mini', OPENAI_SMART_MODEL: 'gpt-5.5' });
    const svc = new LlmService(prisma, fakeEnc(), cfg);
    const create = jest.fn(async () => ({ output_text: '{"v":1}' }));
    (OpenAI as unknown as jest.Mock).mockImplementation(() => ({ responses: { create } }));

    await svc.responsesJson({
      userId: 'u1',
      feature: 'test-smart',
      tier: 'smart',
      input: 'x',
      schema: { name: 's', schema: { type: 'object' } },
    });
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ model: 'gpt-5.5' }),
      expect.anything(),
    );
  });

  it('per-user defaultModel override beats the tier default', async () => {
    const prisma = fakePrisma({ defaultModel: 'gpt-4.1' });
    const cfg = fakeConfig({ OPENAI_FAST_MODEL: 'gpt-5.4-mini' });
    const svc = new LlmService(prisma, fakeEnc(), cfg);
    const create = jest.fn(async () => ({ output_text: '{}' }));
    (OpenAI as unknown as jest.Mock).mockImplementation(() => ({ responses: { create } }));

    await svc.responsesJson({
      userId: 'u1',
      feature: 't',
      tier: 'fast',
      input: 'x',
      schema: { name: 's', schema: { type: 'object' } },
    });
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ model: 'gpt-4.1' }),
      expect.anything(),
    );
  });
});

describe('LlmService — error mapping', () => {
  it('throws AI_KEY_MISSING when the user has no key', async () => {
    const svc = new LlmService(fakePrisma({ hasKey: false }), fakeEnc(), fakeConfig({}));
    await expect(
      svc.responsesJson({
        userId: 'u1',
        feature: 't',
        tier: 'fast',
        input: 'x',
        schema: { name: 's', schema: {} },
      }),
    ).rejects.toMatchObject({ code: 'AI_KEY_MISSING' });
  });

  it('throws AI_KEY_REJECTED on OpenAI 401', async () => {
    const cfg = fakeConfig({ OPENAI_FAST_MODEL: 'gpt-5.4-mini' });
    const svc = new LlmService(fakePrisma(), fakeEnc(), cfg);
    (OpenAI as unknown as jest.Mock).mockImplementation(() => ({
      responses: {
        create: jest.fn(async () => {
          const err = new Error('unauthorized');
          (err as unknown as { status: number }).status = 401;
          throw err;
        }),
      },
    }));
    await expect(
      svc.responsesJson({
        userId: 'u1',
        feature: 't',
        tier: 'fast',
        input: 'x',
        schema: { name: 's', schema: {} },
      }),
    ).rejects.toMatchObject({ code: 'AI_KEY_REJECTED' });
  });

  it('throws AI_QUOTA_EXCEEDED on 429', async () => {
    const cfg = fakeConfig({ OPENAI_FAST_MODEL: 'gpt-5.4-mini' });
    const svc = new LlmService(fakePrisma(), fakeEnc(), cfg);
    (OpenAI as unknown as jest.Mock).mockImplementation(() => ({
      responses: {
        create: jest.fn(async () => {
          const err = new Error('rate limit');
          (err as unknown as { status: number }).status = 429;
          throw err;
        }),
      },
    }));
    await expect(
      svc.responsesJson({
        userId: 'u1',
        feature: 't',
        tier: 'fast',
        input: 'x',
        schema: { name: 's', schema: {} },
      }),
    ).rejects.toMatchObject({ code: 'AI_QUOTA_EXCEEDED' });
  });

  it('throws AI_SCHEMA_VIOLATION when output is not parseable JSON', async () => {
    const cfg = fakeConfig({ OPENAI_FAST_MODEL: 'gpt-5.4-mini' });
    const svc = new LlmService(fakePrisma(), fakeEnc(), cfg);
    (OpenAI as unknown as jest.Mock).mockImplementation(() => ({
      responses: {
        create: jest.fn(async () => ({ output_text: 'not-json-{' })),
      },
    }));
    await expect(
      svc.responsesJson({
        userId: 'u1',
        feature: 't',
        tier: 'fast',
        input: 'x',
        schema: { name: 's', schema: {} },
      }),
    ).rejects.toBeInstanceOf(LlmError);
  });
});
