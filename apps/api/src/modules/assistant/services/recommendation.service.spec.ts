import { RecommendationService } from './recommendation.service';
import {
  AIRecommendationStatus,
  AIRecommendationType,
  Priority,
} from '@prisma/client';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import type { Signal } from './types';

function makePrisma() {
  const rows = new Map<string, Record<string, unknown>>();
  let seq = 0;
  const api = {
    aIRecommendation: {
      findFirst: jest.fn(
        ({ where }: { where: { userId: string; AND: Array<{ sourceData: { equals: string } }> } }) => {
          const code = where.AND[0]?.sourceData?.equals;
          const found = Array.from(rows.values()).find(
            (r) =>
              (r as { userId: string }).userId === where.userId &&
              (r as { sourceData?: { signalCode: string } }).sourceData?.signalCode === code &&
              ((r as { status: string }).status === 'NEW' ||
                (r as { status: string }).status === 'VIEWED'),
          );
          return Promise.resolve(found ?? null);
        },
      ),
      findUnique: jest.fn(({ where }: { where: { id: string } }) =>
        Promise.resolve(rows.get(where.id) ?? null),
      ),
      create: jest.fn(({ data, select }: { data: Record<string, unknown>; select?: Record<string, boolean> }) => {
        const id = `r-${++seq}`;
        const row = {
          id,
          ...data,
          status: data.status ?? 'NEW',
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        rows.set(id, row);
        // mimic Prisma select behavior by returning only requested fields if specified
        if (!select) return Promise.resolve(row);
        const out: Record<string, unknown> = {};
        for (const key of Object.keys(select)) out[key] = (row as Record<string, unknown>)[key];
        return Promise.resolve(out);
      }),
      update: jest.fn(
        ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
          const row = rows.get(where.id)!;
          Object.assign(row, data);
          return Promise.resolve(row);
        },
      ),
    },
  };
  return { prisma: api, rows };
}

const sampleSignal: Signal = {
  code: 'UNDER_SLEPT_3D',
  severity: 'HIGH',
  payload: { avgMinutes: 330, samples: 4 },
};

describe('RecommendationService', () => {
  let svc: RecommendationService;
  let ctx: ReturnType<typeof makePrisma>;

  beforeEach(() => {
    ctx = makePrisma();
    svc = new RecommendationService(ctx.prisma as never);
  });

  it('creates a VI recommendation with mapped type + priority', async () => {
    const r = await svc.createFromSignal('u1', sampleSignal, 'vi');
    expect(r.created).toBe(true);
    expect(r.type).toBe(AIRecommendationType.SLEEP);
    expect(r.priority).toBe(Priority.HIGH);
    expect(r.title).toMatch(/thiếu ngủ/);
    expect(r.content).toMatch(/giờ\/đêm/);
  });

  it('creates an EN recommendation when locale=en', async () => {
    const r = await svc.createFromSignal('u1', sampleSignal, 'en');
    expect(r.title).toMatch(/Sleep has been short/);
    expect(r.content).toMatch(/Averaging/);
  });

  it('dedupes same signal within 24h window (returns existing)', async () => {
    const first = await svc.createFromSignal('u1', sampleSignal, 'vi');
    const second = await svc.createFromSignal('u1', sampleSignal, 'vi');
    expect(first.created).toBe(true);
    expect(second.created).toBe(false);
    expect(second.id).toBe(first.id);
    expect(ctx.prisma.aIRecommendation.create).toHaveBeenCalledTimes(1);
  });

  it('creates distinct recommendations for different signal codes', async () => {
    await svc.createFromSignal('u1', sampleSignal, 'vi');
    const other = await svc.createFromSignal(
      'u1',
      { code: 'TASK_OVERDUE', severity: 'HIGH', payload: { count: 3, sample: [] } },
      'vi',
    );
    expect(other.created).toBe(true);
    expect(other.type).toBe(AIRecommendationType.TASK);
  });

  it('patchStatus: owner-only + blocks reopening closed rows', async () => {
    const r = await svc.createFromSignal('u1', sampleSignal, 'vi');
    await expect(
      svc.patchStatus('u2', r.id, AIRecommendationStatus.VIEWED),
    ).rejects.toBeInstanceOf(ForbiddenException);

    await svc.patchStatus('u1', r.id, AIRecommendationStatus.APPLIED);
    await expect(
      svc.patchStatus('u1', r.id, AIRecommendationStatus.NEW),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('patchStatus: 404 for unknown id', async () => {
    await expect(
      svc.patchStatus('u1', 'missing', AIRecommendationStatus.VIEWED),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
