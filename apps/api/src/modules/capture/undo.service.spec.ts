import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { UndoService } from './undo.service';
import type { PrismaService } from '../../prisma/prisma.service';
import type { EventLogService } from '../intelligence/event-log.service';
import type { UserContextService } from '../intelligence/user-context.service';

interface QcRow {
  id: string;
  userId: string;
  appliedEntityType: string | null;
  appliedEntityId: string | null;
  undoneAt: Date | null;
  status: string;
}

interface ExpRow {
  id: string;
  userId: string;
  walletId: string;
  amount: number;
  deletedAt: Date | null;
}

interface WalletRow {
  id: string;
  balance: number;
}

function makeFakes(opts: {
  qc?: QcRow | null;
  expense?: ExpRow | null;
  wallet?: WalletRow;
}) {
  const qc = opts.qc ?? null;
  const expense = opts.expense ?? null;
  const wallet = opts.wallet ?? { id: 'w1', balance: 0 };

  // Build a tx-shaped object that updates these in place.
  const txOps = {
    expense: {
      findFirst: jest.fn(async () => expense),
      update: jest.fn(async ({ data }: { data: { deletedAt: Date } }) => {
        if (expense) expense.deletedAt = data.deletedAt;
        return expense;
      }),
    },
    income: {
      findFirst: jest.fn(async () => null),
      update: jest.fn(async () => null),
    },
    task: { updateMany: jest.fn(async () => ({ count: 1 })) },
    mealLog: { deleteMany: jest.fn(async () => ({ count: 1 })) },
    sleepLog: { deleteMany: jest.fn(async () => ({ count: 1 })) },
    moodLog: { deleteMany: jest.fn(async () => ({ count: 1 })) },
    wallet: {
      update: jest.fn(async ({ data }: { data: { balance: { increment?: number; decrement?: number } } }) => {
        if (data.balance.increment !== undefined) wallet.balance += data.balance.increment;
        if (data.balance.decrement !== undefined) wallet.balance -= data.balance.decrement;
        return wallet;
      }),
    },
    quickCapture: {
      update: jest.fn(async ({ data }: { data: { undoneAt: Date | null; status: string } }) => {
        if (qc) {
          qc.undoneAt = data.undoneAt;
          qc.status = data.status;
        }
        return qc;
      }),
    },
  };

  const prisma = {
    quickCapture: {
      findUnique: jest.fn(async () => qc),
    },
    $transaction: jest.fn(async (fn: (tx: typeof txOps) => Promise<void>) => {
      return fn(txOps);
    }),
  } as unknown as PrismaService;

  const events = { log: jest.fn(async () => undefined) } as unknown as EventLogService;
  const userCtx = { invalidate: jest.fn(async () => undefined) } as unknown as UserContextService;

  return { svc: new UndoService(prisma, events, userCtx), txOps, qc, wallet, expense };
}

describe('UndoService', () => {
  it('reverses an EXPENSE: soft-deletes the row and credits the wallet', async () => {
    const expense: ExpRow = { id: 'e1', userId: 'u1', walletId: 'w1', amount: 60_000, deletedAt: null };
    const wallet: WalletRow = { id: 'w1', balance: 100_000 };
    const qc: QcRow = {
      id: 'qc1',
      userId: 'u1',
      appliedEntityType: 'EXPENSE',
      appliedEntityId: 'e1',
      undoneAt: null,
      status: 'CONFIRMED',
    };
    const { svc, txOps } = makeFakes({ qc, expense, wallet });
    const r = await svc.undo('u1', 'qc1');
    expect(r.reversedEntityType).toBe('EXPENSE');
    expect(expense.deletedAt).toBeInstanceOf(Date);
    expect(wallet.balance).toBe(100_000 + 60_000);
    expect(txOps.quickCapture.update).toHaveBeenCalled();
  });

  it('rejects when the QuickCapture id is unknown', async () => {
    const { svc } = makeFakes({ qc: null });
    await expect(svc.undo('u1', 'missing')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rejects when the QuickCapture belongs to a different user', async () => {
    const qc: QcRow = {
      id: 'qc1',
      userId: 'u2',
      appliedEntityType: 'EXPENSE',
      appliedEntityId: 'e1',
      undoneAt: null,
      status: 'CONFIRMED',
    };
    const { svc } = makeFakes({ qc });
    await expect(svc.undo('u1', 'qc1')).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects a second undo on the same row', async () => {
    const qc: QcRow = {
      id: 'qc1',
      userId: 'u1',
      appliedEntityType: 'EXPENSE',
      appliedEntityId: 'e1',
      undoneAt: new Date(),
      status: 'CANCELLED',
    };
    const { svc } = makeFakes({ qc });
    await expect(svc.undo('u1', 'qc1')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects an unsupported entity type cleanly', async () => {
    const qc: QcRow = {
      id: 'qc1',
      userId: 'u1',
      appliedEntityType: 'PAYMENT',
      appliedEntityId: 'p1',
      undoneAt: null,
      status: 'CONFIRMED',
    };
    const { svc } = makeFakes({ qc });
    await expect(svc.undo('u1', 'qc1')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('soft-deletes a TASK without touching wallet', async () => {
    const qc: QcRow = {
      id: 'qc1',
      userId: 'u1',
      appliedEntityType: 'TASK',
      appliedEntityId: 't1',
      undoneAt: null,
      status: 'CONFIRMED',
    };
    const { svc, txOps } = makeFakes({ qc });
    await svc.undo('u1', 'qc1');
    expect(txOps.task.updateMany).toHaveBeenCalled();
    expect(txOps.wallet.update).not.toHaveBeenCalled();
  });
});
