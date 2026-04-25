import { DebtsService } from './debts.service';
import { DebtStatus, DebtType, Prisma } from '@prisma/client';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import type { FinanceAuditService } from '../finance-core/finance-audit.service';
import type { FinanceIdempotencyService } from '../finance-core/finance-idempotency.service';

function makePrisma() {
  const rows = new Map<string, any>();
  const api: any = {
    debt: {
      findMany: jest.fn(() => Promise.resolve(Array.from(rows.values()))),
      findUnique: jest.fn(({ where }: any) => Promise.resolve(rows.get(where.id) ?? null)),
      create: jest.fn(({ data }: any) => {
        const row: any = {
          id: `d-${rows.size + 1}`,
          ...data,
          totalAmount: new Prisma.Decimal(data.totalAmount ?? 0),
          paidAmount: new Prisma.Decimal(data.paidAmount ?? 0),
          currency: data.currency ?? 'VND',
          status: data.status ?? DebtStatus.ACTIVE,
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
          } else {
            row[k] = v;
          }
        }
        return Promise.resolve(row);
      }),
      updateMany: jest.fn(({ where, data }: any) => {
        const row = rows.get(where.id);
        if (!row || row.userId !== where.userId) return Promise.resolve({ count: 0 });
        if (where.status?.not && row.status === where.status.not) return Promise.resolve({ count: 0 });
        if (where.paidAmount && !new Prisma.Decimal(row.paidAmount).equals(where.paidAmount)) {
          return Promise.resolve({ count: 0 });
        }
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

describe('DebtsService', () => {
  let svc: DebtsService;
  let ctx: ReturnType<typeof makePrisma>;

  beforeEach(() => {
    ctx = makePrisma();
    svc = new DebtsService(ctx.prisma as never, stubAudit, stubIdem);
  });

  it('addPayment: increments paidAmount; status stays ACTIVE when not fully paid', async () => {
    const d = await svc.create('u1', {
      type: DebtType.I_OWE,
      title: 'Laptop loan',
      totalAmount: 8_000_000,
      paidAmount: 3_000_000,
    });
    const after = await svc.addPayment('u1', d.id, 1_000_000);
    expect(Number(after.paidAmount.toString())).toBe(4_000_000);
    expect(after.status).toBe(DebtStatus.ACTIVE);
  });

  it('addPayment: flips to PAID when paidAmount reaches totalAmount', async () => {
    const d = await svc.create('u1', {
      type: DebtType.I_OWE,
      title: 'Bill',
      totalAmount: 500_000,
      paidAmount: 400_000,
    });
    const after = await svc.addPayment('u1', d.id, 100_000);
    expect(after.status).toBe(DebtStatus.PAID);
  });

  it('addPayment: rejects payment exceeding remaining balance', async () => {
    const d = await svc.create('u1', {
      type: DebtType.I_OWE,
      title: 'Small loan',
      totalAmount: 100_000,
      paidAmount: 50_000,
    });
    await expect(svc.addPayment('u1', d.id, 100_000)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('addPayment: rejects non-positive amount', async () => {
    const d = await svc.create('u1', {
      type: DebtType.I_OWE,
      title: 'x',
      totalAmount: 1_000,
    });
    await expect(svc.addPayment('u1', d.id, 0)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('addPayment: rejects on cancelled debt', async () => {
    const d = await svc.create('u1', {
      type: DebtType.I_OWE,
      title: 'x',
      totalAmount: 1_000,
    });
    await svc.update('u1', d.id, { status: DebtStatus.CANCELLED });
    await expect(svc.addPayment('u1', d.id, 100)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('addPayment: throws CONCURRENT_WRITE when a parallel payment beat us', async () => {
    const d = await svc.create('u1', {
      type: DebtType.I_OWE,
      title: 'race',
      totalAmount: 1_000,
    });
    const row = ctx.rows.get(d.id)!;
    const original = ctx.prisma.debt.updateMany;
    let firstCall = true;
    ctx.prisma.debt.updateMany = jest.fn((args: any) => {
      if (firstCall) {
        firstCall = false;
        // Simulate concurrent winner: bump paidAmount before our update.
        row.paidAmount = new Prisma.Decimal(row.paidAmount).plus(100);
      }
      return original(args);
    });
    await expect(svc.addPayment('u1', d.id, 100)).rejects.toMatchObject({
      response: { errorCode: 'CONCURRENT_WRITE' },
    });
  });

  it('create: rejects paidAmount > totalAmount', async () => {
    await expect(
      svc.create('u1', {
        type: DebtType.I_OWE,
        title: 'x',
        totalAmount: 100,
        paidAmount: 200,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('enforces ownership', async () => {
    const d = await svc.create('u1', {
      type: DebtType.I_OWE,
      title: 'x',
      totalAmount: 100,
    });
    await expect(svc.getById('u2', d.id)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('getById: 404 for unknown id', async () => {
    await expect(svc.getById('u1', 'missing')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('idempotent payment: same key returns the existing row, no second increment', async () => {
    const d = await svc.create('u1', {
      type: DebtType.I_OWE,
      title: 'idem',
      totalAmount: 1_000,
    });
    let lookupHits = 0;
    (stubIdem.lookup as jest.Mock).mockImplementationOnce(async () => null).mockImplementation(async () => {
      lookupHits++;
      return { entityId: d.id };
    });
    const a = await svc.addPayment('u1', d.id, 100, { idempotencyKey: 'k1' });
    const b = await svc.addPayment('u1', d.id, 100, { idempotencyKey: 'k1' });
    expect(Number(a.paidAmount.toString())).toBe(100);
    expect(Number(b.paidAmount.toString())).toBe(100);
    expect(lookupHits).toBeGreaterThanOrEqual(1);
  });
});
