import { BudgetsService } from './budgets.service';
import { BudgetPeriod, Prisma } from '@prisma/client';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import type { FinanceAuditService } from '../finance-core/finance-audit.service';

function makePrisma() {
  const budgets = new Map<string, any>();
  const aggregateFn = jest.fn();

  const api: any = {
    userProfile: { findUnique: jest.fn(async () => ({ currency: 'VND' })) },
    budget: {
      findMany: jest.fn(({ where }: any) =>
        Promise.resolve(
          Array.from(budgets.values()).filter((b: any) => b.userId === where.userId),
        ),
      ),
      findUnique: jest.fn(({ where }: any) => Promise.resolve(budgets.get(where.id) ?? null)),
      create: jest.fn(({ data }: any) => {
        const row: any = {
          id: `b-${budgets.size + 1}`,
          ...data,
          amount: new Prisma.Decimal(data.amount),
          currency: data.currency ?? 'VND',
          alertThresholdPercent: data.alertThresholdPercent ?? 80,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        budgets.set(row.id, row);
        return Promise.resolve(row);
      }),
      update: jest.fn(({ where, data }: any) => {
        const row = budgets.get(where.id);
        Object.assign(row, data);
        if (data.amount !== undefined) row.amount = new Prisma.Decimal(data.amount);
        return Promise.resolve(row);
      }),
      delete: jest.fn(({ where }: any) => {
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

const stubAudit = { record: jest.fn(async () => undefined) } as unknown as FinanceAuditService;

describe('BudgetsService', () => {
  let svc: BudgetsService;
  let ctx: ReturnType<typeof makePrisma>;

  beforeEach(() => {
    ctx = makePrisma();
    svc = new BudgetsService(ctx.prisma as never, stubAudit);
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
    expect(b.usage.spent).toBe('0.00');
    expect(b.usage.remaining).toBe('3000000.00');
    expect(b.usage.usedPercent).toBe(0);
    expect(b.usage.overThreshold).toBe(false);
    expect(b.usage.currency).toBe('VND');
  });

  it('usage: computes spent / remaining / percent from aggregated expenses', async () => {
    ctx.aggregateFn.mockResolvedValue({ _sum: { amount: new Prisma.Decimal(1_200_000) } });
    const b = await svc.create('u1', {
      category: 'shopping',
      amount: 500_000,
      period: BudgetPeriod.MONTHLY,
      startDate: '2026-04-01',
      endDate: '2026-04-30',
      alertThresholdPercent: 60,
    });
    expect(b.usage.spent).toBe('1200000.00');
    expect(b.usage.remaining).toBe('-700000.00');
    expect(b.usage.usedPercent).toBe(240);
    expect(b.usage.overThreshold).toBe(true);
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

  it('usage filters by currency — USD budget ignores VND expenses', async () => {
    // The aggregate mock must observe that budgets.service includes
    // currency in the where clause. Capture the call.
    let observedCurrency: string | undefined;
    ctx.aggregateFn.mockImplementation(async (args: any) => {
      observedCurrency = args.where.currency;
      return { _sum: { amount: null } };
    });
    await svc.create('u1', {
      category: 'travel',
      amount: 100,
      currency: 'USD',
      period: BudgetPeriod.MONTHLY,
      startDate: '2026-04-01',
      endDate: '2026-04-30',
    });
    expect(observedCurrency).toBe('USD');
  });
});
