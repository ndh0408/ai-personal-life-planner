import { MoodLogsService } from './mood-logs.service';

type MockMood = {
  id: string;
  userId: string;
  date: Date;
  mood: string;
  energyLevel: string;
  stressLevel: string;
  note: string | null;
};

function makePrisma() {
  const rows = new Map<string, MockMood>();
  let n = 0;
  return {
    moodLog: {
      findMany: jest.fn(() => Promise.resolve(Array.from(rows.values()))),
      upsert: jest.fn(
        ({
          where,
          create,
          update,
        }: {
          where: { userId_date: { userId: string; date: Date } };
          create: Omit<MockMood, 'id'>;
          update: Partial<MockMood>;
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
          const row: MockMood = { id: `m-${n}`, ...create };
          rows.set(row.id, row);
          return Promise.resolve(row);
        },
      ),
    },
  };
}

describe('MoodLogsService', () => {
  let service: MoodLogsService;
  let prisma: ReturnType<typeof makePrisma>;

  beforeEach(() => {
    prisma = makePrisma();
    service = new MoodLogsService(prisma as never);
  });

  it('upserts the mood log for a (user, date) pair', async () => {
    const a = await service.create('user-A', {
      date: '2026-04-23',
      mood: 'NORMAL',
      energyLevel: 'MEDIUM',
      stressLevel: 'LOW',
    });
    const b = await service.create('user-A', {
      date: '2026-04-23',
      mood: 'HAPPY',
      energyLevel: 'HIGH',
      stressLevel: 'LOW',
    });
    expect(a.id).toBe(b.id);
    expect(b.mood).toBe('HAPPY');
    expect(prisma.moodLog.upsert).toHaveBeenCalledTimes(2);
  });
});
