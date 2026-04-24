import { SavingGoalsService } from './saving-goals.service';
import { Prisma, Priority, SavingGoalStatus } from '@prisma/client';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';

function makePrisma() {
  const rows = new Map<string, Record<string, unknown>>();
  const api = {
    savingGoal: {
      findMany: jest.fn(() => Promise.resolve(Array.from(rows.values()))),
      findUnique: jest.fn(({ where }: { where: { id: string } }) =>
        Promise.resolve(rows.get(where.id) ?? null),
      ),
      create: jest.fn(({ data }: { data: Prisma.SavingGoalUncheckedCreateInput }) => {
        const row = {
          id: `sg-${rows.size + 1}`,
          ...data,
          currentAmount: data.currentAmount ?? 0,
          priority: data.priority ?? Priority.MEDIUM,
          status: data.status ?? SavingGoalStatus.ACTIVE,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        rows.set(row.id, row);
        return Promise.resolve(row);
      }),
      update: jest.fn(
        ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
          const row = rows.get(where.id)!;
          Object.assign(row, data);
          return Promise.resolve(row);
        },
      ),
      delete: jest.fn(({ where }: { where: { id: string } }) => {
        rows.delete(where.id);
        return Promise.resolve({ id: where.id });
      }),
    },
  };
  return { prisma: api, rows };
}

describe('SavingGoalsService', () => {
  let svc: SavingGoalsService;
  let ctx: ReturnType<typeof makePrisma>;

  beforeEach(() => {
    ctx = makePrisma();
    svc = new SavingGoalsService(ctx.prisma as never);
  });

  it('contribute: adds to currentAmount; status stays ACTIVE below target', async () => {
    const g = await svc.create('u1', {
      title: 'Japan trip',
      targetAmount: 40_000_000,
      currentAmount: 4_500_000,
    });
    const after = await svc.contribute('u1', g.id, 1_500_000);
    expect(Number(after.currentAmount)).toBe(6_000_000);
    expect(after.status).toBe(SavingGoalStatus.ACTIVE);
  });

  it('contribute: flips to COMPLETED when target is reached', async () => {
    const g = await svc.create('u1', {
      title: 'New laptop',
      targetAmount: 50_000_000,
      currentAmount: 48_000_000,
    });
    const after = await svc.contribute('u1', g.id, 2_000_000);
    expect(after.status).toBe(SavingGoalStatus.COMPLETED);
  });

  it('contribute: rejects non-positive amount', async () => {
    const g = await svc.create('u1', { title: 'x', targetAmount: 100 });
    await expect(svc.contribute('u1', g.id, 0)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('contribute: rejects cancelled goal', async () => {
    const g = await svc.create('u1', { title: 'x', targetAmount: 100 });
    await svc.update('u1', g.id, { status: SavingGoalStatus.CANCELLED });
    await expect(svc.contribute('u1', g.id, 10)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('create: starts COMPLETED if currentAmount already >= target', async () => {
    const g = await svc.create('u1', {
      title: 'Already done',
      targetAmount: 100,
      currentAmount: 100,
    });
    expect(g.status).toBe(SavingGoalStatus.COMPLETED);
  });

  it('enforces ownership', async () => {
    const g = await svc.create('u1', { title: 'x', targetAmount: 100 });
    await expect(svc.getById('u2', g.id)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('getById: 404 for unknown', async () => {
    await expect(svc.getById('u1', 'missing')).rejects.toBeInstanceOf(NotFoundException);
  });
});
