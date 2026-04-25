import { ExpensesService } from './expenses.service';
import { Prisma } from '@prisma/client';
import { ForbiddenException, NotFoundException, BadRequestException } from '@nestjs/common';
import type { FinanceAuditService } from '../finance-core/finance-audit.service';
import type { FinanceIdempotencyService } from '../finance-core/finance-idempotency.service';

function makePrisma() {
  const wallets = new Map<string, any>();
  const expenses = new Map<string, any>();

  const api: any = {
    wallet: {
      findUnique: jest.fn(({ where }: any) => Promise.resolve(wallets.get(where.id) ?? null)),
      update: jest.fn(({ where, data }: any) => {
        const w = wallets.get(where.id);
        if (!w) throw new Error('wallet not found');
        if (data.balance && typeof data.balance === 'object') {
          if ('increment' in data.balance) {
            w.balance = new Prisma.Decimal(w.balance).plus(data.balance.increment);
          }
          if ('decrement' in data.balance) {
            w.balance = new Prisma.Decimal(w.balance).minus(data.balance.decrement);
          }
        }
        return Promise.resolve(w);
      }),
    },
    userProfile: {
      findUnique: jest.fn(async () => ({ currency: 'VND' })),
    },
    expense: {
      findUnique: jest.fn(({ where }: any) => Promise.resolve(expenses.get(where.id) ?? null)),
      create: jest.fn(({ data }: any) => {
        const row: any = {
          id: `e-${expenses.size + 1}`,
          ...data,
          amount: new Prisma.Decimal(data.amount),
          currency: data.currency ?? 'VND',
          walletId: data.walletId ?? null,
          paymentMethod: data.paymentMethod ?? null,
          needLevel: data.needLevel ?? null,
          note: data.note ?? null,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        expenses.set(row.id, row);
        return Promise.resolve(row);
      }),
      update: jest.fn(({ where, data }: any) => {
        const row = expenses.get(where.id);
        if (!row) throw new Error('not found');
        for (const [k, v] of Object.entries(data)) {
          if (k === 'wallet') {
            const w = v as { connect?: { id: string }; disconnect?: boolean };
            if (w.connect) row.walletId = w.connect.id;
            if (w.disconnect) row.walletId = null;
          } else {
            row[k] = v;
          }
        }
        if (data.amount !== undefined) row.amount = new Prisma.Decimal(data.amount);
        return Promise.resolve(row);
      }),
      delete: jest.fn(({ where }: any) => {
        expenses.delete(where.id);
        return Promise.resolve({ id: where.id });
      }),
    },
    $transaction: jest.fn((fn: any) => Promise.resolve(fn(api))),
  };

  const seedWallet = (id: string, userId: string, balance: number, currency = 'VND') =>
    wallets.set(id, { id, userId, balance: new Prisma.Decimal(balance), currency });

  return { prisma: api, wallets, expenses, seedWallet };
}

const stubAudit = { record: jest.fn(async () => undefined) } as unknown as FinanceAuditService;
const stubIdem = {
  lookup: jest.fn(async () => null),
  record: jest.fn(async () => undefined),
} as unknown as FinanceIdempotencyService;

describe('ExpensesService', () => {
  let svc: ExpensesService;
  let ctx: ReturnType<typeof makePrisma>;

  beforeEach(() => {
    ctx = makePrisma();
    svc = new ExpensesService(ctx.prisma as never, stubAudit, stubIdem);
  });

  it('create: decrements wallet balance by amount', async () => {
    ctx.seedWallet('w1', 'u1', 1_000_000);
    const e = await svc.create('u1', {
      walletId: 'w1',
      title: 'Coffee',
      amount: 65_000,
      category: 'food',
      expenseDate: '2026-04-24',
    });
    expect(Number(ctx.wallets.get('w1')!.balance.toString())).toBe(935_000);
    expect(e.userId).toBe('u1');
    expect(e.currency).toBe('VND');
  });

  it('create with no walletId: does not touch any wallet', async () => {
    const e = await svc.create('u1', {
      title: 'Cash expense',
      amount: 20_000,
      category: 'misc',
      expenseDate: '2026-04-24',
    });
    expect(ctx.prisma.wallet.update).not.toHaveBeenCalled();
    expect(e.walletId).toBeNull();
    // Currency falls back to user profile.
    expect(e.currency).toBe('VND');
  });

  it('create snapshots wallet currency on the expense row', async () => {
    ctx.seedWallet('w-usd', 'u1', 500, 'USD');
    const e = await svc.create('u1', {
      walletId: 'w-usd',
      title: 'Coffee abroad',
      amount: 5,
      category: 'food',
      expenseDate: '2026-04-24',
    });
    expect(e.currency).toBe('USD');
  });

  it('update amount: reverts old deduction, applies new', async () => {
    ctx.seedWallet('w1', 'u1', 1_000_000);
    const created = await svc.create('u1', {
      walletId: 'w1',
      title: 'Lunch',
      amount: 100_000,
      category: 'food',
      expenseDate: '2026-04-24',
    });
    await svc.update('u1', created.id, { amount: 150_000 });
    expect(Number(ctx.wallets.get('w1')!.balance.toString())).toBe(850_000);
  });

  it('delete: refunds the amount to the wallet', async () => {
    ctx.seedWallet('w1', 'u1', 1_000_000);
    const created = await svc.create('u1', {
      walletId: 'w1',
      title: 'Gadget',
      amount: 500_000,
      category: 'shopping',
      expenseDate: '2026-04-24',
    });
    await svc.delete('u1', created.id);
    expect(Number(ctx.wallets.get('w1')!.balance.toString())).toBe(1_000_000);
    expect(ctx.expenses.has(created.id)).toBe(false);
  });

  it('rejects non-positive amount', async () => {
    await expect(
      svc.create('u1', {
        title: 'nope',
        amount: 0,
        category: 'x',
        expenseDate: '2026-04-24',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('enforces ownership: 403 when another user accesses', async () => {
    ctx.seedWallet('w1', 'u1', 500_000);
    const e = await svc.create('u1', {
      walletId: 'w1',
      title: 'x',
      amount: 10_000,
      category: 'c',
      expenseDate: '2026-04-24',
    });
    await expect(svc.getById('u2', e.id)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('getById: 404 for unknown id', async () => {
    await expect(svc.getById('u1', 'missing')).rejects.toBeInstanceOf(NotFoundException);
  });

  it("rejects creating expense against someone else's wallet", async () => {
    ctx.seedWallet('w2', 'other-user', 100_000);
    await expect(
      svc.create('u1', {
        walletId: 'w2',
        title: 'hijack',
        amount: 10_000,
        category: 'c',
        expenseDate: '2026-04-24',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('idempotent create: same key returns the same expense, not a duplicate', async () => {
    ctx.seedWallet('w1', 'u1', 1_000_000);
    const a = await svc.create(
      'u1',
      {
        walletId: 'w1',
        title: 'Coffee',
        amount: 65_000,
        category: 'food',
        expenseDate: '2026-04-24',
      },
      { idempotencyKey: 'idem-1' },
    );
    // Force the second lookup to hit.
    (stubIdem.lookup as jest.Mock).mockImplementationOnce(async () => ({ entityId: a.id }));
    const b = await svc.create(
      'u1',
      {
        walletId: 'w1',
        title: 'Coffee',
        amount: 65_000,
        category: 'food',
        expenseDate: '2026-04-24',
      },
      { idempotencyKey: 'idem-1' },
    );
    expect(b.id).toBe(a.id);
    // Wallet balance reflects only the first deduction.
    expect(Number(ctx.wallets.get('w1')!.balance.toString())).toBe(935_000);
  });
});
