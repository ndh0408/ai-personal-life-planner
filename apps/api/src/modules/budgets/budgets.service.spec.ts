import { BudgetsService } from './budgets.service';
import { BudgetPeriod, Prisma } from '@prisma/client';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';

function makePrisma() {
  const budgets = new Map<string, Record<string, unknown>>();
  // The expense.aggregate mock returns a fixed sum so we can assert the math.
  const aggregateFn = jest.fn();

  const api = {
    budget: {
      findMany: jest.fn(({ where }: { where: { userId: string } }) =>
        Promise.resolve(
          Array.from(budgets.values()).filter((b) => (b as { userId: string }).userId === where.userId),
        ),
      ),
      findUnique: jest.fn(({ where }: { where: { id: string } }) =>
        Promise.resolve(budgets.get(where.id) ?? null),
      ),
      create: jest.fn(({ data }: { data: Prisma.BudgetUncheckedCreateInput }) => {
        const row = {
          id: `b-${budgets.size + 1}`,
          ...data,
          alertThresholdPercent: data.alertThresholdPercent ?? 80,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        budgets.set(row.id, row);
        return Promise.resolve(row);
      }),
      update: jest.fn(
        ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
          const row = budgets.get(where.id)!;
          Object.assign(row, data);
          return Promise.resolve(row);
        },
      ),
      delete: jest.fn(({ where }: { where: { id: string } }) => {
        budgets.delete(where.id);
        return Promise.resolve({ id: where.id });
      }),
    },
    expense: {
      aggregate: aggregateFn,
    },
  };

  return { prisma: api, budgets, aggregateFn };
}

describe('BudgetsService', () => {
  let svc: BudgetsService;
  let ctx: ReturnType<typeof makePrisma>;

  beforeEach(() => {
    ctx = makePrisma();
    svc = new BudgetsService(ctx.prisma as never);
  });

  it('create: returns budget with zero usage when no expenses exist', async () => {
    ctx.aggregateFn.mockResolvedValue({ _sum: { amount: null } });
    const b = await svc.create('u1', {
      category: 'food',
      amount: 3_000_000,
      period: BudgetPeriod.MONTHLY,
      startDate: '2026-04-01',
      endDate: '2026-04-30',
    });
    expect(b.usage.spent).toBe(0);
    expect(b.usage.remaining).toBe(3_000_000);
    expect(b.usage.usedPercent).toBe(0);
    expect(b.usage.overThreshold).toBe(false);
  });

  it('usage: computes spent / remaining / percent from aggregated expenses', async () => {
    ctx.aggregateFn.mockResolvedValue({ _sum: { amount: 1_200_000 } });
    const b = await svc.create('u1', {
      category: 'shopping',
      amount: 500_000,
      period: BudgetPeriod.MONTHLY,
      startDate: '2026-04-01',
      endDate: '2026-04-30',
      alertThresholdPercent: 60,
    });
    expect(b.usage.spent).toBe(1_200_000);
    expect(b.usage.remaining).toBe(-700_000);
    expect(b.usage.usedPercent).toBe(240);
    expect(b.usage.overThreshold).toBe(true); // 240% > 60% threshold
  });

  it('rejects non-positive amount', async () => {
    await expect(
      svc.create('u1', {
        category: 'x',
        amount: 0,
        period: BudgetPeriod.MONTHLY,
        startDate: '2026-04-01',
        endDate: '2026-04-30',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects endDate before startDate', async () => {
    await expect(
      svc.create('u1', {
        category: 'x',
        amount: 100,
        period: BudgetPeriod.MONTHLY,
        startDate: '2026-04-30',
        endDate: '2026-04-01',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('enforces ownership on getById', async () => {
    ctx.aggregateFn.mockResolvedValue({ _sum: { amount: null } });
    const b = await svc.create('u1', {
      category: 'food',
      amount: 100_000,
      period: BudgetPeriod.MONTHLY,
      startDate: '2026-04-01',
      endDate: '2026-04-30',
    });
    await expect(svc.getById('u2', b.id!)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('getById: 404 for missing id', async () => {
    await expect(svc.getById('u1', 'missing')).rejects.toBeInstanceOf(NotFoundException);
  });
});
