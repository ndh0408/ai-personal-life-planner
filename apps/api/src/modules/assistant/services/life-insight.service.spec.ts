import { LifeInsightService } from './life-insight.service';

function makePrisma(overrides: Partial<Record<string, unknown>> = {}) {
  const base = {
    dailySchedule: {
      findFirst: jest.fn(() => Promise.resolve(null)),
      findMany: jest.fn(() => Promise.resolve([])),
    },
    task: { findMany: jest.fn(() => Promise.resolve([])) },
    habit: { findMany: jest.fn(() => Promise.resolve([])) },
    habitLog: { findMany: jest.fn(() => Promise.resolve([])) },
    sleepLog: { findMany: jest.fn(() => Promise.resolve([])) },
    moodLog: { findMany: jest.fn(() => Promise.resolve([])) },
    mealPlan: { count: jest.fn(() => Promise.resolve(0)) },
    mealLog: { count: jest.fn(() => Promise.resolve(0)) },
    budget: { findMany: jest.fn(() => Promise.resolve([])) },
    expense: { findMany: jest.fn(() => Promise.resolve([])) },
    savingGoal: { findMany: jest.fn(() => Promise.resolve([])) },
    personalGoal: { findMany: jest.fn(() => Promise.resolve([])) },
    ...overrides,
  };
  return base;
}

describe('LifeInsightService', () => {
  const today = '2026-04-24';

  it('returns all-null when user has no data', async () => {
    const svc = new LifeInsightService(makePrisma() as never);
    const s = await svc.score('u1', today);
    expect(s.scheduleCompletionRate).toBeNull();
    expect(s.taskCompletionRate).toBeNull();
    expect(s.habitConsistencyRate).toBeNull();
    expect(s.sleepConsistencyScore).toBeNull();
    expect(s.budgetHealthScore).toBeNull();
    expect(s.energyTrend).toBe('UNKNOWN');
  });

  it('scheduleCompletionRate: 4/5 → 80', async () => {
    const prisma = makePrisma({
      dailySchedule: {
        findFirst: jest.fn(() =>
          Promise.resolve({
            id: 's1',
            items: [
              { status: 'COMPLETED' },
              { status: 'COMPLETED' },
              { status: 'COMPLETED' },
              { status: 'COMPLETED' },
              { status: 'PENDING' },
            ],
          }),
        ),
        findMany: jest.fn(() => Promise.resolve([{ items: [{ id: 'a' }] }])),
      },
    });
    const svc = new LifeInsightService(prisma as never);
    const s = await svc.score('u1', today);
    expect(s.scheduleCompletionRate).toBe(80);
  });

  it('budgetHealthScore: 1 of 2 over threshold → 50', async () => {
    const prisma = makePrisma({
      budget: {
        findMany: jest.fn(() =>
          Promise.resolve([
            { category: 'food', amount: 1_000, alertThresholdPercent: 80 },
            { category: 'shopping', amount: 500, alertThresholdPercent: 60 },
          ]),
        ),
      },
      expense: {
        findMany: jest.fn(() =>
          Promise.resolve([
            { category: 'food', amount: 400 }, // 40% — under threshold
            { category: 'shopping', amount: 450 }, // 90% — over threshold
          ]),
        ),
      },
    });
    const svc = new LifeInsightService(prisma as never);
    const s = await svc.score('u1', today);
    expect(s.budgetHealthScore).toBe(50);
  });

  it('savingProgressScore: avg of progress %s across goals', async () => {
    const prisma = makePrisma({
      savingGoal: {
        findMany: jest.fn(() =>
          Promise.resolve([
            { targetAmount: 100, currentAmount: 25 }, // 25%
            { targetAmount: 200, currentAmount: 150 }, // 75%
          ]),
        ),
      },
    });
    const svc = new LifeInsightService(prisma as never);
    const s = await svc.score('u1', today);
    expect(s.savingProgressScore).toBe(50);
  });

  it('energyTrend detects UP when second half > first half', async () => {
    const base = new Date('2026-04-10T00:00:00Z');
    const prisma = makePrisma({
      moodLog: {
        findMany: jest.fn(() =>
          Promise.resolve(
            [
              { energyLevel: 'LOW', stressLevel: 'LOW', date: base },
              { energyLevel: 'LOW', stressLevel: 'LOW', date: base },
              { energyLevel: 'LOW', stressLevel: 'LOW', date: base },
              { energyLevel: 'HIGH', stressLevel: 'LOW', date: base },
              { energyLevel: 'HIGH', stressLevel: 'LOW', date: base },
              { energyLevel: 'HIGH', stressLevel: 'LOW', date: base },
            ].map((row) => ({ ...row, date: base })),
          ),
        ),
      },
    });
    const svc = new LifeInsightService(prisma as never);
    const s = await svc.score('u1', today);
    expect(s.energyTrend).toBe('UP');
  });

  it('sleepConsistencyScore: low variance + near target → high score', async () => {
    const dates = [0, 1, 2, 3, 4, 5].map((i) => {
      const d = new Date('2026-04-18T00:00:00Z');
      d.setUTCDate(d.getUTCDate() + i);
      return d;
    });
    const prisma = makePrisma({
      sleepLog: {
        findMany: jest.fn(() =>
          Promise.resolve(
            dates.map((date) => ({ date, durationMinutes: 7 * 60 + 5 })),
          ),
        ),
      },
    });
    const svc = new LifeInsightService(prisma as never);
    const s = await svc.score('u1', today);
    // ~7h sleep with no variance → close to 100
    expect(s.sleepConsistencyScore).not.toBeNull();
    expect(s.sleepConsistencyScore as number).toBeGreaterThan(90);
  });
});
