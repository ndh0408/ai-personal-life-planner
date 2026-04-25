import { AiUsageService, todayBoundsIn } from './ai-usage.service';
import type { PrismaService } from '../../prisma/prisma.service';

function makePrisma(state: {
  quota: any;
  count: number;
  profile?: { timezone: string } | null;
  rows?: any[];
}): { svc: PrismaService; created: any[] } {
  const created: any[] = [];
  const api = {
    aiUsageQuota: {
      upsert: jest.fn(async () => state.quota),
    },
    userProfile: {
      findUnique: jest.fn(async () => state.profile ?? null),
    },
    aiUsageLog: {
      count: jest.fn(async () => state.count),
      create: jest.fn(async ({ data }: any) => {
        created.push(data);
        return data;
      }),
      findMany: jest.fn(async () => state.rows ?? []),
      groupBy: jest.fn(async () => []),
    },
  };
  return { svc: api as unknown as PrismaService, created };
}

describe('AiUsageService.assertWithinQuota', () => {
  it('passes under limit', async () => {
    const { svc } = makePrisma({
      quota: { plan: 'FREE', dailyChatLimit: 40 } as any,
      count: 5,
    });
    const sut = new AiUsageService(svc);
    await expect(sut.assertWithinQuota('u', 'CHAT')).resolves.toBeUndefined();
  });

  it('throws AI_DAILY_LIMIT_REACHED when at the cap', async () => {
    const { svc } = makePrisma({
      quota: { plan: 'FREE', dailyChatLimit: 40 } as any,
      count: 40,
    });
    const sut = new AiUsageService(svc);
    await expect(sut.assertWithinQuota('u', 'CHAT')).rejects.toMatchObject({
      response: { errorCode: 'AI_DAILY_LIMIT_REACHED' },
    });
  });

  it('admin bypass — never throws', async () => {
    const { svc } = makePrisma({
      quota: { plan: 'ADMIN', dailyChatLimit: 0 } as any,
      count: 10_000,
    });
    const sut = new AiUsageService(svc);
    await expect(sut.assertWithinQuota('u', 'CHAT')).resolves.toBeUndefined();
  });
});

describe('AiUsageService.log', () => {
  it('persists a log row and never includes prompt/response payload', async () => {
    const { svc, created } = makePrisma({ quota: {} as any, count: 0 });
    const sut = new AiUsageService(svc);
    await sut.log({
      userId: 'u',
      feature: 'CHAT',
      provider: 'mock',
      model: 'mock-1',
      success: true,
      inputTokens: 12,
      outputTokens: 20,
      totalTokens: 32,
      latencyMs: 80,
    });
    expect(created).toHaveLength(1);
    const row = created[0];
    expect(row).not.toHaveProperty('prompt');
    expect(row).not.toHaveProperty('text');
    expect(row).not.toHaveProperty('content');
    expect(row.provider).toBe('mock');
  });
});

describe('todayBoundsIn', () => {
  it('produces a 24h window', () => {
    const { from, to } = todayBoundsIn('UTC', new Date('2026-04-25T15:30:00Z'));
    expect(to.getTime() - from.getTime()).toBe(24 * 60 * 60_000);
  });
});
