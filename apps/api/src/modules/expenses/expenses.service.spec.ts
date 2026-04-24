import { ExpensesService } from './expenses.service';
import { NeedLevel, Prisma } from '@prisma/client';
import { ForbiddenException, NotFoundException, BadRequestException } from '@nestjs/common';

type WalletRow = { id: string; userId: string; balance: number };
type ExpenseRow = {
  id: string;
  userId: string;
  walletId: string | null;
  title: string;
  amount: number;
  category: string;
  expenseDate: Date;
  paymentMethod: string | null;
  needLevel: NeedLevel | null;
  note: string | null;
  createdAt: Date;
  updatedAt: Date;
};

type PrismaMock = {
  wallet: {
    findUnique: jest.Mock;
    update: jest.Mock;
  };
  expense: {
    findUnique: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
    delete: jest.Mock;
  };
  $transaction: jest.Mock;
};

function makePrisma(): { prisma: PrismaMock; wallets: Map<string, WalletRow>; expenses: Map<string, ExpenseRow>; seedWallet: (id: string, userId: string, balance: number) => void } {
  const wallets = new Map<string, WalletRow>();
  const expenses = new Map<string, ExpenseRow>();

  // Minimal mock that captures the balance-math we care about.
  const api: PrismaMock = {
    wallet: {
      findUnique: jest.fn(({ where }: { where: { id: string } }) =>
        Promise.resolve(wallets.get(where.id) ?? null),
      ),
      update: jest.fn(
        ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
          const w = wallets.get(where.id);
          if (!w) throw new Error('wallet not found');
          if (data.balance && typeof data.balance === 'object') {
            const op = data.balance as { increment?: number; decrement?: number };
            if (op.increment !== undefined) w.balance += Number(op.increment);
            if (op.decrement !== undefined) w.balance -= Number(op.decrement);
          } else if (typeof data.balance === 'number') {
            w.balance = data.balance;
          }
          return Promise.resolve(w);
        },
      ),
    },
    expense: {
      findUnique: jest.fn(({ where }: { where: { id: string } }) =>
        Promise.resolve(expenses.get(where.id) ?? null),
      ),
      create: jest.fn(({ data }: { data: Prisma.ExpenseUncheckedCreateInput }) => {
        const row: ExpenseRow = {
          id: `e-${expenses.size + 1}`,
          userId: data.userId,
          walletId: (data.walletId as string | null) ?? null,
          title: data.title,
          amount: Number(data.amount),
          category: data.category,
          expenseDate: data.expenseDate as Date,
          paymentMethod: (data.paymentMethod as string | null) ?? null,
          needLevel: (data.needLevel as NeedLevel | null) ?? null,
          note: (data.note as string | null) ?? null,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        expenses.set(row.id, row);
        return Promise.resolve(row);
      }),
      update: jest.fn(
        ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
          const row = expenses.get(where.id)!;
          Object.assign(row, {
            title: (data.title as string) ?? row.title,
            amount: (data.amount as number) ?? row.amount,
            category: (data.category as string) ?? row.category,
            expenseDate: (data.expenseDate as Date) ?? row.expenseDate,
            paymentMethod: data.paymentMethod !== undefined ? data.paymentMethod : row.paymentMethod,
            needLevel: data.needLevel !== undefined ? data.needLevel : row.needLevel,
            note: data.note !== undefined ? data.note : row.note,
          });
          if (data.wallet) {
            const w = data.wallet as { connect?: { id: string }; disconnect?: boolean };
            if (w.connect) row.walletId = w.connect.id;
            if (w.disconnect) row.walletId = null;
          }
          return Promise.resolve(row);
        },
      ),
      delete: jest.fn(({ where }: { where: { id: string } }) => {
        expenses.delete(where.id);
        return Promise.resolve({ id: where.id });
      }),
    },
    $transaction: jest.fn((fn: (tx: PrismaMock) => unknown) => Promise.resolve(fn(api))),
  };

  const seedWallet = (id: string, userId: string, balance: number) =>
    wallets.set(id, { id, userId, balance });

  return { prisma: api, wallets, expenses, seedWallet };
}

describe('ExpensesService', () => {
  let svc: ExpensesService;
  let ctx: ReturnType<typeof makePrisma>;

  beforeEach(() => {
    ctx = makePrisma();
    svc = new ExpensesService(ctx.prisma as never);
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
    expect(ctx.wallets.get('w1')!.balance).toBe(935_000);
    expect(e.userId).toBe('u1');
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
    // wallet now 900k
    await svc.update('u1', created.id, { amount: 150_000 });
    // Revert +100k back → 1,000,000; then -150k → 850,000
    expect(ctx.wallets.get('w1')!.balance).toBe(850_000);
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
    expect(ctx.wallets.get('w1')!.balance).toBe(1_000_000);
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

  it('rejects creating expense against someone else\'s wallet', async () => {
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
});
