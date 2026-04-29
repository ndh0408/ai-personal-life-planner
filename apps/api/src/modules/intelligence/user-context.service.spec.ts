import { UserContextService, SNAPSHOT_VERSION, type SnapshotPrivacy } from './user-context.service';
import type { BehaviorSummary, BehaviorService } from './behavior.service';
import type { EventLogService } from './event-log.service';
import type { AssistantMemoryService } from './assistant-memory.service';
import type { PrismaService } from '../../prisma/prisma.service';
import type { RedisService } from '../../redis/redis.service';

const FULL_PRIVACY: SnapshotPrivacy = {
  personalizationEnabled: true,
  useFinanceForAI: true,
  useHealthForAI: true,
  useMealsForAI: true,
  useTasksForAI: true,
  aiMemoryEnabled: true,
};

const SAMPLE_BEHAVIOR: BehaviorSummary = {
  wakeHistogram: new Array(24).fill(1),
  sleepHistogram: new Array(24).fill(1),
  avgSleepByWeekday: [400, 410, 420, 430, 440, 450, 460],
  peakFocus: { start: 9, end: 12 },
  topExpenseCategories: [{ category: 'Ăn uống', weeklyAmount: 100, share: 0.5 }],
  recentMealTitles: ['phở', 'cơm gà'],
  moodSleepCorrelation: 0.4,
  taskCompletionByPrio: { LOW: 1, MEDIUM: 2, HIGH: 3 },
};

interface FakeStore {
  privacy: SnapshotPrivacy | null;
  profile: Partial<{
    preferredName: string | null;
    locale: string;
    mainGoals: unknown;
    usualWakeTime: string | null;
    usualSleepTime: string | null;
    dislikes: unknown;
    allergies: unknown;
    monthlyGoal: string | null;
    workPattern: string | null;
    budgetMonthly: number | null;
    timezone: string;
  }> | null;
  expensesToday: number;
  expensesMonth: number;
  highTaskCount: number;
  lastSleep: { durationMinutes: number } | null;
  lastMood: { mood: string } | null;
  wallets: Array<{ id: string; name: string; balance: number; isDefault: boolean; currency: string }>;
}

function fakePrisma(store: FakeStore): PrismaService {
  return {
    privacySetting: {
      findUnique: jest.fn(async () =>
        store.privacy
          ? {
              ...store.privacy,
              id: 'p1',
              userId: 'u1',
              proactiveRecommendations: true,
              createdAt: new Date(),
              updatedAt: new Date(),
            }
          : null,
      ),
    },
    userProfile: {
      findUnique: jest.fn(async () => store.profile ?? null),
    },
    sleepLog: { findFirst: jest.fn(async () => store.lastSleep) },
    moodLog: { findFirst: jest.fn(async () => store.lastMood) },
    expense: {
      findMany: jest
        .fn()
        // First call = today, second = month
        .mockResolvedValueOnce(
          store.expensesToday > 0 ? [{ amount: store.expensesToday }] : [],
        )
        .mockResolvedValueOnce(
          store.expensesMonth > 0 ? [{ amount: store.expensesMonth }] : [],
        ),
    },
    task: { count: jest.fn(async () => store.highTaskCount) },
    wallet: { findMany: jest.fn(async () => store.wallets) },
    // Round 30: snapshot now reads recent capture corrections.
    captureCorrection: { findMany: jest.fn(async () => []) },
  } as unknown as PrismaService;
}

function fakeRedis(): RedisService {
  const store = new Map<string, string>();
  return {
    client: {
      get: jest.fn(async (k: string) => store.get(k) ?? null),
      set: jest.fn(async (k: string, v: string) => {
        store.set(k, v);
        return 'OK';
      }),
      del: jest.fn(async (k: string) => {
        store.delete(k);
        return 1;
      }),
    },
  } as unknown as RedisService;
}

function fakeBehavior(): BehaviorService {
  return { get: jest.fn(async () => SAMPLE_BEHAVIOR) } as unknown as BehaviorService;
}

function fakeEvents(items: Array<{ kind: string; summary: string; payload: unknown; createdAt: Date }> = []): EventLogService {
  return {
    recent: jest.fn(async () => items),
  } as unknown as EventLogService;
}

function fakeMemory(items: Array<{ fact: string; kind: string; weight: number }> = []): AssistantMemoryService {
  return { top: jest.fn(async () => items) } as unknown as AssistantMemoryService;
}

describe('UserContextService — snapshot', () => {
  const baseStore: FakeStore = {
    privacy: FULL_PRIVACY,
    profile: {
      preferredName: 'Nam',
      locale: 'vi',
      mainGoals: ['focus'],
      usualWakeTime: '07:00',
      usualSleepTime: '23:30',
      dislikes: [],
      allergies: [],
      monthlyGoal: null,
      workPattern: 'office',
      budgetMonthly: 8_000_000,
      timezone: 'Asia/Ho_Chi_Minh',
    },
    expensesToday: 320_000,
    expensesMonth: 6_240_000,
    highTaskCount: 2,
    lastSleep: { durationMinutes: 360 },
    lastMood: { mood: 'OK' },
    wallets: [
      { id: 'w1', name: 'Ví chính', balance: 5_300_000, isDefault: true, currency: 'VND' },
    ],
  };

  it('returns version + generatedAt + privacy snapshot when fully enabled', async () => {
    const svc = new UserContextService(
      fakePrisma(baseStore),
      fakeRedis(),
      fakeBehavior(),
      fakeEvents(),
      fakeMemory(),
    );
    const out = await svc.build('u1');
    expect(out.snapshotVersion).toBe(SNAPSHOT_VERSION);
    expect(out.generatedAt).toMatch(/T/);
    expect(out.privacy).toEqual(FULL_PRIVACY);
    expect(out.todaySpendVnd).toBe(320_000);
    expect(out.monthSpendVnd).toBe(6_240_000);
    expect(out.lastSleepMinutes).toBe(360);
    expect(out.openHighPriorityTaskCount).toBe(2);
    expect(out.wallets).toHaveLength(1);
  });

  it('hides finance fields when useFinanceForAI=false', async () => {
    const store: FakeStore = {
      ...baseStore,
      privacy: { ...FULL_PRIVACY, useFinanceForAI: false },
    };
    const svc = new UserContextService(
      fakePrisma(store),
      fakeRedis(),
      fakeBehavior(),
      fakeEvents(),
      fakeMemory(),
    );
    const out = await svc.build('u1');
    expect(out.todaySpendVnd).toBeNull();
    expect(out.monthSpendVnd).toBeNull();
    expect(out.wallets).toEqual([]);
    expect(out.behavior.topExpenseCategories).toEqual([]);
  });

  it('hides health fields when useHealthForAI=false', async () => {
    const store: FakeStore = {
      ...baseStore,
      privacy: { ...FULL_PRIVACY, useHealthForAI: false },
    };
    const svc = new UserContextService(
      fakePrisma(store),
      fakeRedis(),
      fakeBehavior(),
      fakeEvents(),
      fakeMemory(),
    );
    const out = await svc.build('u1');
    expect(out.lastSleepMinutes).toBeNull();
    expect(out.lastMood).toBeNull();
    expect(out.behavior.peakFocus).toEqual({ start: 9, end: 12 }); // task domain
    expect(out.behavior.moodSleepCorrelation).toBeNull();
  });

  it('drops memories when aiMemoryEnabled=false', async () => {
    const store: FakeStore = {
      ...baseStore,
      privacy: { ...FULL_PRIVACY, aiMemoryEnabled: false },
    };
    const svc = new UserContextService(
      fakePrisma(store),
      fakeRedis(),
      fakeBehavior(),
      fakeEvents(),
      fakeMemory([{ fact: 'likes phở', kind: 'food', weight: 5 }]),
    );
    const out = await svc.build('u1');
    expect(out.memories).toEqual([]);
  });

  it('returns minimal snapshot when personalizationEnabled=false', async () => {
    const store: FakeStore = {
      ...baseStore,
      privacy: { ...FULL_PRIVACY, personalizationEnabled: false },
    };
    const svc = new UserContextService(
      fakePrisma(store),
      fakeRedis(),
      fakeBehavior(),
      fakeEvents(),
      fakeMemory([{ fact: 'x', kind: 'y', weight: 1 }]),
    );
    const out = await svc.build('u1');
    expect(out.todaySpendVnd).toBeNull();
    expect(out.openHighPriorityTaskCount).toBeNull();
    expect(out.lastSleepMinutes).toBeNull();
    expect(out.memories).toEqual([]);
    expect(out.wallets).toEqual([]);
    expect(out.profile?.preferredName).toBe('Nam');
  });

  it('filters recentEvents by privacy domain', async () => {
    const events = [
      { kind: 'EXPENSE_CREATED', summary: 'phở', payload: {}, createdAt: new Date() },
      { kind: 'SLEEP_LOGGED', summary: '6h', payload: {}, createdAt: new Date() },
      { kind: 'CAPTURE_CONFIRMED', summary: 'x', payload: {}, createdAt: new Date() },
    ];
    const store: FakeStore = {
      ...baseStore,
      privacy: { ...FULL_PRIVACY, useFinanceForAI: false, useHealthForAI: false },
    };
    const svc = new UserContextService(
      fakePrisma(store),
      fakeRedis(),
      fakeBehavior(),
      fakeEvents(events),
      fakeMemory(),
    );
    const out = await svc.build('u1');
    const kinds = out.recentEvents.map((e) => e.kind);
    expect(kinds).not.toContain('EXPENSE_CREATED');
    expect(kinds).not.toContain('SLEEP_LOGGED');
    expect(kinds).toContain('CAPTURE_CONFIRMED');
  });

  it('caches the snapshot — second call doesn\'t hit Prisma', async () => {
    const prisma = fakePrisma(baseStore);
    const redis = fakeRedis();
    const svc = new UserContextService(prisma, redis, fakeBehavior(), fakeEvents(), fakeMemory());
    const out1 = await svc.build('u1');
    const out2 = await svc.build('u1');
    expect(out1.snapshotVersion).toBe(out2.snapshotVersion);
    // privacySetting.findUnique was called once on miss; the second call should
    // be a cache hit.
    expect(prisma.privacySetting.findUnique).toHaveBeenCalledTimes(1);
  });

  it('invalidate() drops the cache so next call recomputes', async () => {
    const prisma = fakePrisma(baseStore);
    const redis = fakeRedis();
    const svc = new UserContextService(prisma, redis, fakeBehavior(), fakeEvents(), fakeMemory());
    await svc.build('u1');
    await svc.invalidate('u1');
    // Re-prepare the prisma mock so findMany has its dual return queued again.
    (prisma.expense.findMany as jest.Mock)
      .mockResolvedValueOnce([{ amount: 320_000 }])
      .mockResolvedValueOnce([{ amount: 6_240_000 }]);
    await svc.build('u1');
    expect(prisma.privacySetting.findUnique).toHaveBeenCalledTimes(2);
  });

  it('survives a Redis outage by recomputing every time', async () => {
    const downRedis = {
      client: {
        get: jest.fn(async () => {
          throw new Error('redis down');
        }),
        set: jest.fn(async () => {
          throw new Error('redis down');
        }),
        del: jest.fn(async () => {
          throw new Error('redis down');
        }),
      },
    } as unknown as RedisService;
    const svc = new UserContextService(fakePrisma(baseStore), downRedis, fakeBehavior(), fakeEvents(), fakeMemory());
    const out = await svc.build('u1');
    expect(out.snapshotVersion).toBe(SNAPSHOT_VERSION);
    await expect(svc.invalidate('u1')).resolves.toBeUndefined();
  });
});
