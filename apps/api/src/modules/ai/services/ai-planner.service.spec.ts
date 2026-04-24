import { AiPlannerService } from './ai-planner.service';
import { AiProviderService } from './ai-provider.service';
import { AiPromptTemplateService } from './ai-prompt-template.service';
import { AiJsonValidationService } from './ai-json-validation.service';
import { PreviewCacheService } from './preview-cache.service';
import { MockAiProvider } from '../providers/mock.provider';
import type { LocaleService } from '../../../common/i18n/locale.service';

function mockLocaleService(locale: 'vi' | 'en' = 'vi'): LocaleService {
  return {
    forUser: jest.fn(() => Promise.resolve(locale)),
    fromRequest: jest.fn(() => locale),
    get default() {
      return locale;
    },
  } as unknown as LocaleService;
}

function makePrisma() {
  let scheduleId: string | null = null;
  const items: Array<Record<string, unknown>> = [];

  const itemCreate = jest.fn(({ data }: { data: Record<string, unknown> }) => {
    items.push(data);
    return Promise.resolve(data);
  });
  const itemDeleteMany = jest.fn(() => {
    items.length = 0;
    return Promise.resolve({ count: 0 });
  });
  const scheduleUpsert = jest.fn(({ create }: { create: { userId: string; date: Date } }) => {
    scheduleId = 's-1';
    return Promise.resolve({ id: scheduleId, ...create });
  });
  const scheduleFindUnique = jest.fn(() =>
    Promise.resolve(scheduleId ? { id: scheduleId, items } : null),
  );

  const profile = {
    fullName: 'Demo',
    age: 28,
    occupation: 'Engineer',
    workStartTime: new Date(Date.UTC(1970, 0, 1, 9, 0)),
    workEndTime: new Date(Date.UTC(1970, 0, 1, 18, 0)),
    usualWakeTime: new Date(Date.UTC(1970, 0, 1, 6, 30)),
    usualSleepTime: new Date(Date.UTC(1970, 0, 1, 23, 0)),
    mainGoal: 'PRODUCTIVE',
    activityLevel: 'MEDIUM',
    dietaryPreference: 'high-protein',
    timezone: 'Asia/Ho_Chi_Minh',
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const prisma: any = {
    userProfile: { findUnique: jest.fn(() => Promise.resolve(profile)) },
    task: { findMany: jest.fn(() => Promise.resolve([])) },
    habit: { findMany: jest.fn(() => Promise.resolve([])) },
    sleepLog: { findFirst: jest.fn(() => Promise.resolve(null)) },
    moodLog: { findFirst: jest.fn(() => Promise.resolve(null)) },
    dailySchedule: {
      upsert: scheduleUpsert,
      findUnique: scheduleFindUnique,
    },
    scheduleItem: {
      create: itemCreate,
      deleteMany: itemDeleteMany,
    },
  };
  prisma.$transaction = jest.fn((arg: unknown) => {
    if (typeof arg === 'function') {
      return (arg as (tx: unknown) => unknown)(prisma);
    }
    return Promise.all(arg as Promise<unknown>[]);
  });
  return prisma;
}

describe('AiPlannerService.generate', () => {
  it('uses the mock provider, validates output, and persists items', async () => {
    const prisma = makePrisma();
    const provider = new AiProviderService(new MockAiProvider());
    const service = new AiPlannerService(
      prisma as never,
      provider,
      new AiPromptTemplateService(),
      new AiJsonValidationService(provider),
      new PreviewCacheService(),
      mockLocaleService(),
    );

    const result = await service.generate('user-A', { date: '2026-04-24' });
    expect(result.usedFallback).toBe(false);
    expect(result.plan.schedule.length).toBeGreaterThanOrEqual(5);
    expect(prisma.scheduleItem.create).toHaveBeenCalled();
    expect(prisma.dailySchedule.upsert).toHaveBeenCalled();
  });

  it('falls back to FALLBACK_PLAN when AI emits invalid JSON twice', async () => {
    const prisma = makePrisma();
    const mock = new MockAiProvider();
    mock.setBroken(true);
    mock.setNextResponse('still garbage'); // repair attempt
    const provider = new AiProviderService(mock);
    const service = new AiPlannerService(
      prisma as never,
      provider,
      new AiPromptTemplateService(),
      new AiJsonValidationService(provider),
      new PreviewCacheService(),
      mockLocaleService(),
    );

    const result = await service.generate('user-A', { date: '2026-04-24' });
    expect(result.usedFallback).toBe(true);
    expect(result.plan.warnings).toContain('AI fallback used — schedule is generic.');
  });

  it('falls back when AI hangs past timeout', async () => {
    const prisma = makePrisma();
    const mock = new MockAiProvider();
    mock.setHang(500);
    const provider = new AiProviderService(mock);
    const service = new AiPlannerService(
      prisma as never,
      provider,
      new AiPromptTemplateService(),
      new AiJsonValidationService(provider),
      new PreviewCacheService(),
      mockLocaleService(),
    );

    const origComplete = provider.complete.bind(provider);
    provider.complete = ((req: Parameters<typeof origComplete>[0]) =>
      origComplete(req, { timeoutMs: 30, maxAttempts: 1, retryDelayMs: 0 })) as typeof provider.complete;

    const result = await service.generate('user-A', { date: '2026-04-24' });
    expect(result.usedFallback).toBe(true);
  });
});
