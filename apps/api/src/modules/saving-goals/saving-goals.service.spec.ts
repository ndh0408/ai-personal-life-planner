import { SavingGoalsService } from './saving-goals.service';
import { Prisma, Priority, SavingGoalStatus } from '@prisma/client';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import type { FinanceAuditService } from '../finance-core/finance-audit.service';
import type { FinanceIdempotencyService } from '../finance-core/finance-idempotency.service';

function makePrisma() {
  const rows = new Map<string, any>();
  const api: any = {
    savingGoal: {
      findMany: jest.fn(() => Promise.resolve(Array.from(rows.values()))),
      findUnique: jest.fn(({ where }: { where: { id: string } }) =>
        Promise.resolve(rows.get(where.id) ?? null),
      ),
      create: jest.fn(({ data }: { data: any }) => {
        const row: any = {
          id: `sg-${rows.size + 1}`,
          ...data,
          targetAmount: new Prisma.Decimal(data.targetAmount ?? 0),
          currentAmount: new Prisma.Decimal(data.currentAmount ?? 0),
          currency: data.currency ?? 'VND',
          priority: data.priority ?? Priority.MEDIUM,
          status: data.status ?? SavingGoalStatus.ACTIVE,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        rows.set(row.id, row);
        return Promise.resolve(row);
      }),
      update: jest.fn(({ where, data }: any) => {
        const row = rows.get(where.id);
        if (!row) throw Object.assign(new Error('not found'), { code: 'P2025' });
        for (const [k, v] of Object.entries(data)) {
          if (v && typeof v === 'object' && 'increment' in (v as any)) {
            row[k] = new Prisma.Decimal(row[k]).plus((v as any).increment);
          } else if (v && typeof v === 'object' && 'decrement' in (v as any)) {
            row[k] = new Prisma.Decimal(row[k]).minus((v as any).decrement);
          } else {
            row[k] = v;
          }
        }
        return Promise.resolve(row);
      }),
      updateMany: jest.fn(({ where, data }: any) => {
        const row = rows.get(where.id);
        if (!row || row.userId !== where.userId) return Promise.resolve({ count: 0 });
        // Optimistic-concurrency check: WHERE currentAmount = previousValue.
        if (where.currentAmount && !new Prisma.Decimal(row.currentAmount).equals(where.currentAmount)) {
          return Promise.resolve({ count: 0 });
        }
        if (where.status?.not && row.status === where.status.not) return Promise.resolve({ count: 0 });
        for (const [k, v] of Object.entries(data)) {
          if (v && typeof v === 'object' && 'increment' in (v as any)) {
            row[k] = new Prisma.Decimal(row[k]).plus((v as any).increment);
          } else {
            row[k] = v;
          }
        }
        return Promise.resolve({ count: 1 });
      }),
      delete: jest.fn(({ where }: any) => {
        rows.delete(where.id);
        return Promise.resolve({ id: where.id });
      }),
    },
    $transaction: jest.fn(async (cb: any) => cb(api)),
  };
  return { prisma: api, rows };
}

const stubAudit = { record: jest.fn(async () => undefined) } as unknown as FinanceAuditService;
const stubIdem = {
  lookup: jest.fn(async () => null),
  record: jest.fn(async () => undefined),
} as unknown as FinanceIdempotencyService;

describe('SavingGoalsService', () => {
  let svc: SavingGoalsService;
  let ctx: ReturnType<typeof makePrisma>;

  beforeEach(() => {
    ctx = makePrisma();
    svc = new SavingGoalsService(ctx.prisma as never, stubAudit, stubIdem);
  });

  it('contribute: adds to currentAmount; status stays ACTIVE below target', async () => {
    const g = await svc.create('u1', {
      title: 'Japan trip',
      targetAmount: 40_000_000,
      currentAmount: 4_500_000,
    });
    const after = await svc.contribute('u1', g.id, 1_500_000);
    expect(Number(after.goal.currentAmount.toString())).toBe(6_000_000);
    expect(after.goal.status).toBe(SavingGoalStatus.ACTIVE);
    expect(after.appliedAmount).toBe('1500000.00');
  });

  it('contribute: flips to COMPLETED when target is reached', async () => {
    const g = await svc.create('u1', {
      title: 'New laptop',
      targetAmount: 50_000_000,
      currentAmount: 48_000_000,
    });
    const after = await svc.contribute('u1', g.id, 2_000_000);
    expect(after.goal.status).toBe(SavingGoalStatus.COMPLETED);
  });

  it('contribute: clamps at target — never overshoots', async () => {
    const g = await svc.create('u1', {
      title: 'capped',
      targetAmount: 100,
      currentAmount: 80,
    });
    const after = await svc.contribute('u1', g.id, 50);
    // Only 20 of the requested 50 was applied (clamped to target).
    expect(after.appliedAmount).toBe('20.00');
    expect(Number(after.goal.currentAmount.toString())).toBe(100);
    expect(after.goal.status).toBe(SavingGoalStatus.COMPLETED);
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

  it('contribute: throws CONCURRENT_WRITE when a parallel contribution beats us', async () => {
    const g = await svc.create('u1', {
      title: 'race',
      targetAmount: 1_000,
      currentAmount: 0,
    });
    // Mutate the row directly so the conditional WHERE in updateMany fails.
    const row = ctx.rows.get(g.id)!;
    const originalUpdateMany = ctx.prisma.savingGoal.updateMany;
    let firstCall = true;
    ctx.prisma.savingGoal.updateMany = jest.fn((args: any) => {
      if (firstCall) {
        firstCall = false;
        // Simulate concurrent winner: bump currentAmount before our update lands.
        row.currentAmount = new Prisma.Decimal(row.currentAmount).plus(100);
      }
      return originalUpdateMany(args);
    });
    await expect(svc.contribute('u1', g.id, 100)).rejects.toMatchObject({
      response: { errorCode: 'CONCURRENT_WRITE' },
    });
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
