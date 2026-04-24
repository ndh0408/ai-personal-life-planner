import { ForbiddenException } from '@nestjs/common';
import { SchedulesService } from './schedules.service';

type MockSchedule = {
  id: string;
  userId: string;
  date: Date;
  status: string;
  summary: string | null;
};

function makePrisma() {
  const schedules = new Map<string, MockSchedule>();
  let counter = 0;
  return {
    dailySchedule: {
      findUnique: jest.fn(({ where }: { where: { id?: string; userId_date?: { userId: string; date: Date } } }) => {
        if (where.id) return Promise.resolve(schedules.get(where.id) ?? null);
        if (where.userId_date) {
          const { userId, date } = where.userId_date;
          const found = Array.from(schedules.values()).find(
            (s) => s.userId === userId && s.date.toISOString() === date.toISOString(),
          );
          return Promise.resolve(found ?? null);
        }
        return Promise.resolve(null);
      }),
      create: jest.fn(({ data }: { data: { userId: string; date: Date; status?: string; summary?: string | null } }) => {
        counter += 1;
        const s: MockSchedule = {
          id: `s-${counter}`,
          userId: data.userId,
          date: data.date,
          status: data.status ?? 'DRAFT',
          summary: data.summary ?? null,
        };
        schedules.set(s.id, s);
        return Promise.resolve(s);
      }),
      update: jest.fn(({ where, data }: { where: { id: string }; data: Partial<MockSchedule> }) => {
        const existing = schedules.get(where.id);
        if (!existing) throw new Error('not found');
        const updated = { ...existing, ...data };
        schedules.set(where.id, updated);
        return Promise.resolve(updated);
      }),
      delete: jest.fn(({ where }: { where: { id: string } }) => {
        schedules.delete(where.id);
        return Promise.resolve(null);
      }),
    },
  };
}

describe('SchedulesService', () => {
  let prisma: ReturnType<typeof makePrisma>;
  let service: SchedulesService;

  beforeEach(() => {
    prisma = makePrisma();
    service = new SchedulesService(prisma as never);
  });

  it('returns the schedule for a given date and user, or null', async () => {
    await service.create('user-A', { date: '2026-04-24', status: 'ACTIVE' });
    const hit = await service.getByDate('user-A', '2026-04-24');
    expect(hit?.userId).toBe('user-A');
    const miss = await service.getByDate('user-A', '2026-04-25');
    expect(miss).toBeNull();
  });

  it('blocks updating another user\'s schedule (IDOR guard)', async () => {
    const own = await service.create('user-A', { date: '2026-04-24' });
    await expect(
      service.update('user-B', own.id, { summary: 'oops' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
