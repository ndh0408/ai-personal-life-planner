import { StressService } from './stress.service';
import type { PrismaService } from '../../prisma/prisma.service';

interface Stub {
  sleep: Array<{ durationMinutes: number }>;
  tasks: Array<{ status: string; dueAt: Date | null }>;
  hrRecent: { avg: number | null; count: number };
  hrBaseline: { avg: number | null; count: number };
}

function fakePrisma(s: Stub): PrismaService {
  return {
    sleepLog: {
      findMany: jest.fn(async () => s.sleep),
    },
    task: {
      findMany: jest.fn(async () => s.tasks),
    },
    heartRateSample: {
      aggregate: jest
        .fn()
        .mockResolvedValueOnce({ _avg: { avgBpm: s.hrRecent.avg }, _count: s.hrRecent.count })
        .mockResolvedValueOnce({ _avg: { avgBpm: s.hrBaseline.avg }, _count: s.hrBaseline.count }),
    },
  } as unknown as PrismaService;
}

describe('StressService', () => {
  it('returns score 0 with empty signals', async () => {
    const svc = new StressService(
      fakePrisma({
        sleep: [],
        tasks: [],
        hrRecent: { avg: null, count: 0 },
        hrBaseline: { avg: null, count: 0 },
      }),
    );
    const r = await svc.assess('u1');
    expect(r.score).toBe(0);
    expect(r.reasons).toEqual([]);
  });

  it('flags sleep deficit when 3-night avg < 6h', async () => {
    const svc = new StressService(
      fakePrisma({
        sleep: [
          { durationMinutes: 5 * 60 },
          { durationMinutes: 5 * 60 + 30 },
          { durationMinutes: 4 * 60 + 30 },
        ],
        tasks: [],
        hrRecent: { avg: null, count: 0 },
        hrBaseline: { avg: null, count: 0 },
      }),
    );
    const r = await svc.assess('u1');
    expect(r.components.sleepDeficit).toBe(true);
    expect(r.score).toBeGreaterThanOrEqual(0.4);
  });

  it('flags task backlog when ≥30% are skipped/overdue', async () => {
    const due = new Date('2026-01-01');
    const tasks = [
      { status: 'TODO', dueAt: due },
      { status: 'CANCELLED', dueAt: null },
      { status: 'CANCELLED', dueAt: null },
      { status: 'COMPLETED', dueAt: null },
      { status: 'COMPLETED', dueAt: null },
      { status: 'COMPLETED', dueAt: null },
    ];
    const svc = new StressService(
      fakePrisma({
        sleep: [],
        tasks,
        hrRecent: { avg: null, count: 0 },
        hrBaseline: { avg: null, count: 0 },
      }),
    );
    const r = await svc.assess('u1');
    expect(r.components.taskBacklog).toBe(true);
  });

  it('flags elevated HR when recent avg ≥ 4 bpm above baseline', async () => {
    const svc = new StressService(
      fakePrisma({
        sleep: [],
        tasks: [],
        hrRecent: { avg: 78, count: 50 },
        hrBaseline: { avg: 72, count: 100 },
      }),
    );
    const r = await svc.assess('u1');
    expect(r.components.elevatedHr).toBe(true);
  });
});
