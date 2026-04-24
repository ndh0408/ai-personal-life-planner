import { ForbiddenException } from '@nestjs/common';
import { HabitsService } from './habits.service';

type MockHabit = { id: string; userId: string; name: string };
type MockLog = {
  id: string;
  habitId: string;
  userId: string;
  date: Date;
  completed: boolean;
  count: number;
  note: string | null;
};

function makePrisma() {
  const habits = new Map<string, MockHabit>();
  const logs = new Map<string, MockLog>();
  let h = 0;
  let l = 0;

  return {
    habit: {
      findUnique: jest.fn(({ where }: { where: { id: string } }) =>
        Promise.resolve(habits.get(where.id) ?? null),
      ),
      findMany: jest.fn(() => Promise.resolve(Array.from(habits.values()))),
      create: jest.fn(({ data }: { data: { userId: string; name: string } }) => {
        h += 1;
        const habit: MockHabit = { id: `h-${h}`, userId: data.userId, name: data.name };
        habits.set(habit.id, habit);
        return Promise.resolve(habit);
      }),
      update: jest.fn(({ where, data }: { where: { id: string }; data: Partial<MockHabit> }) => {
        const existing = habits.get(where.id);
        if (!existing) throw new Error('not found');
        const updated = { ...existing, ...data };
        habits.set(where.id, updated);
        return Promise.resolve(updated);
      }),
      delete: jest.fn(({ where }: { where: { id: string } }) => {
        habits.delete(where.id);
        return Promise.resolve(null);
      }),
    },
    habitLog: {
      findMany: jest.fn(() => Promise.resolve(Array.from(logs.values()))),
      upsert: jest.fn(
        ({
          where,
          create,
          update,
        }: {
          where: { habitId_date: { habitId: string; date: Date } };
          create: Omit<MockLog, 'id'>;
          update: Partial<MockLog>;
        }) => {
          const key = `${where.habitId_date.habitId}|${where.habitId_date.date.toISOString()}`;
          const existing = Array.from(logs.values()).find(
            (x) =>
              x.habitId === where.habitId_date.habitId &&
              x.date.toISOString() === where.habitId_date.date.toISOString(),
          );
          if (existing) {
            const updated = { ...existing, ...update };
            logs.set(existing.id, updated);
            return Promise.resolve(updated);
          }
          l += 1;
          const log: MockLog = { id: `l-${l}`, ...create };
          logs.set(key, log);
          return Promise.resolve(log);
        },
      ),
    },
  };
}

describe('HabitsService', () => {
  let prisma: ReturnType<typeof makePrisma>;
  let service: HabitsService;

  beforeEach(() => {
    prisma = makePrisma();
    service = new HabitsService(prisma as never);
  });

  it('logs a habit and is idempotent for the same date (upsert)', async () => {
    const habit = await service.create('user-A', {
      name: 'Drink water',
      frequency: 'DAILY',
      targetCount: 8,
    });

    const first = await service.log('user-A', habit.id, {
      date: '2026-04-24',
      completed: true,
      count: 5,
    });
    const second = await service.log('user-A', habit.id, {
      date: '2026-04-24',
      completed: true,
      count: 8,
    });

    expect(first.id).toBe(second.id);
    expect(second.count).toBe(8);
    expect(prisma.habitLog.upsert).toHaveBeenCalledTimes(2);
  });

  it('refuses to log a habit owned by another user', async () => {
    const habit = await service.create('user-A', {
      name: 'Meditate',
      frequency: 'DAILY',
      targetCount: 1,
    });
    await expect(
      service.log('user-B', habit.id, { date: '2026-04-24', completed: true, count: 1 }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
