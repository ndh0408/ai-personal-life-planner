import { CircadianService } from './circadian.service';
import type { PrismaService } from '../../prisma/prisma.service';

interface EventRow { kind: string; createdAt: Date }
interface TaskRow { updatedAt: Date }

function fakePrisma(events: EventRow[], tasks: TaskRow[]): PrismaService {
  return {
    userProfile: {
      findUnique: jest.fn(async () => ({ timezone: 'Asia/Ho_Chi_Minh' })),
    },
    eventLog: {
      findMany: jest.fn(async () => events),
    },
    task: {
      findMany: jest.fn(async () => tasks),
    },
  } as unknown as PrismaService;
}

/** Build an event row at a given local hour (ICT = UTC+7). */
function evAt(hour: number, kind = 'CAPTURE_CONFIRMED'): EventRow {
  // 09:00 ICT = 02:00 UTC; we want createdAt → localHour() returns `hour`.
  const utcHour = (hour - 7 + 24) % 24;
  const d = new Date(Date.UTC(2026, 3, 1, utcHour, 0, 0));
  return { kind, createdAt: d };
}

describe('CircadianService', () => {
  it('detects a 9-12 best window from clustered morning activity', async () => {
    const events: EventRow[] = [];
    // 60 events spread across 09-11 ICT, sparse elsewhere.
    for (let day = 0; day < 14; day++) {
      for (const h of [9, 10, 11]) {
        events.push(evAt(h));
        events.push(evAt(h));
      }
      events.push(evAt(15)); // light afternoon noise
    }
    const svc = new CircadianService(fakePrisma(events, []));
    const r = await svc.getForUser('u1');
    expect(r.bestStartHour).toBeGreaterThanOrEqual(9);
    expect(r.bestEndHour).toBeLessThanOrEqual(12);
    expect(r.score).toBeGreaterThan(0);
    expect(r.hourlyProductivity).toHaveLength(24);
  });

  it('falls back to 09-12 when there is no signal', async () => {
    const svc = new CircadianService(fakePrisma([], []));
    const r = await svc.getForUser('u1');
    expect(r.bestStartHour).toBe(9);
    expect(r.bestEndHour).toBe(12);
  });

  it('caches per-user for 30 minutes', async () => {
    const prisma = fakePrisma([], []);
    const svc = new CircadianService(prisma);
    await svc.getForUser('u1');
    await svc.getForUser('u1');
    expect(prisma.eventLog.findMany).toHaveBeenCalledTimes(1);
  });
});
