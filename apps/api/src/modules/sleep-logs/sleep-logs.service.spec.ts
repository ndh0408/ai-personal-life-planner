import { BadRequestException } from '@nestjs/common';
import { SleepLogsService } from './sleep-logs.service';

type MockSleep = {
  id: string;
  userId: string;
  date: Date;
  sleepTime: Date;
  wakeTime: Date;
  durationMinutes: number;
  quality: string;
  note: string | null;
};

function makePrisma() {
  const rows = new Map<string, MockSleep>();
  let n = 0;
  return {
    sleepLog: {
      findUnique: jest.fn(({ where }: { where: { id?: string } }) =>
        Promise.resolve((where.id && rows.get(where.id)) || null),
      ),
      findMany: jest.fn(() => Promise.resolve(Array.from(rows.values()))),
      upsert: jest.fn(
        ({
          where,
          create,
          update,
        }: {
          where: { userId_date: { userId: string; date: Date } };
          create: Omit<MockSleep, 'id'>;
          update: Partial<MockSleep>;
        }) => {
          const found = Array.from(rows.values()).find(
            (r) =>
              r.userId === where.userId_date.userId &&
              r.date.toISOString() === where.userId_date.date.toISOString(),
          );
          if (found) {
            const updated = { ...found, ...update };
            rows.set(found.id, updated);
            return Promise.resolve(updated);
          }
          n += 1;
          const row: MockSleep = { id: `sl-${n}`, ...create };
          rows.set(row.id, row);
          return Promise.resolve(row);
        },
      ),
    },
  };
}

describe('SleepLogsService', () => {
  let service: SleepLogsService;

  beforeEach(() => {
    service = new SleepLogsService(makePrisma() as never);
  });

  it('computes durationMinutes and upserts per (user, date)', async () => {
    const log = await service.create('user-A', {
      date: '2026-04-23',
      sleepTime: '2026-04-23T22:30:00.000Z',
      wakeTime: '2026-04-24T06:00:00.000Z',
      quality: 'GOOD',
    });
    // 7h30m = 450
    expect(log.durationMinutes).toBe(450);

    // Same date upsert overwrites
    const updated = await service.create('user-A', {
      date: '2026-04-23',
      sleepTime: '2026-04-23T23:00:00.000Z',
      wakeTime: '2026-04-24T06:00:00.000Z',
      quality: 'NORMAL',
    });
    expect(updated.id).toBe(log.id);
    expect(updated.durationMinutes).toBe(420);
  });

  it('rejects wakeTime that is not after sleepTime', async () => {
    await expect(
      service.create('user-A', {
        date: '2026-04-23',
        sleepTime: '2026-04-23T08:00:00.000Z',
        wakeTime: '2026-04-23T07:00:00.000Z',
        quality: 'BAD',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
