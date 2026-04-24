import { DebtsService } from './debts.service';
import { DebtStatus, DebtType, Prisma } from '@prisma/client';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';

function makePrisma() {
  const rows = new Map<string, Record<string, unknown>>();
  const api = {
    debt: {
      findMany: jest.fn(() => Promise.resolve(Array.from(rows.values()))),
      findUnique: jest.fn(({ where }: { where: { id: string } }) =>
        Promise.resolve(rows.get(where.id) ?? null),
      ),
      create: jest.fn(({ data }: { data: Prisma.DebtUncheckedCreateInput }) => {
        const row = {
          id: `d-${rows.size + 1}`,
          ...data,
          paidAmount: data.paidAmount ?? 0,
          status: data.status ?? DebtStatus.ACTIVE,
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

describe('DebtsService', () => {
  let svc: DebtsService;
  let ctx: ReturnType<typeof makePrisma>;

  beforeEach(() => {
    ctx = makePrisma();
    svc = new DebtsService(ctx.prisma as never);
  });

  it('addPayment: increments paidAmount; status stays ACTIVE when not fully paid', async () => {
    const d = await svc.create('u1', {
      type: DebtType.I_OWE,
      title: 'Laptop loan',
      totalAmount: 8_000_000,
      paidAmount: 3_000_000,
    });
    const after = await svc.addPayment('u1', d.id, 1_000_000);
    expect(Number(after.paidAmount)).toBe(4_000_000);
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
});
