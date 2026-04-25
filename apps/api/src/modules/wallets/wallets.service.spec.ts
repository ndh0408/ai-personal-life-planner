import { WalletsService } from './wallets.service';
import { Prisma, WalletType } from '@prisma/client';
import { ForbiddenException, NotFoundException } from '@nestjs/common';

function makePrisma() {
  const rows = new Map<string, Record<string, unknown>>();
  const api = {
    wallet: {
      findMany: jest.fn(({ where }: { where: { userId: string } }) =>
        Promise.resolve(
          Array.from(rows.values()).filter((w) => (w as { userId: string }).userId === where.userId),
        ),
      ),
      findUnique: jest.fn(({ where }: { where: { id: string } }) =>
        Promise.resolve(rows.get(where.id) ?? null),
      ),
      create: jest.fn(({ data }: { data: Prisma.WalletUncheckedCreateInput }) => {
        const row = {
          id: `w-${rows.size + 1}`,
          ...data,
          balance: data.balance ?? 0,
          currency: data.currency ?? 'VND',
          isActive: data.isActive ?? true,
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

describe('WalletsService', () => {
  let svc: WalletsService;
  let ctx: ReturnType<typeof makePrisma>;

  beforeEach(() => {
    ctx = makePrisma();
    svc = new WalletsService(ctx.prisma as never);
  });

  it('create: defaults currency=VND and balance=0', async () => {
    const w = await svc.create('u1', { name: 'Cash', type: WalletType.CASH });
    expect(w.currency).toBe('VND');
    expect(Number(w.balance)).toBe(0);
  });

  it('list: scopes to caller', async () => {
    await svc.create('u1', { name: 'Cash', type: WalletType.CASH });
    await svc.create('u1', { name: 'Bank', type: WalletType.BANK });
    await svc.create('u2', { name: 'Other', type: WalletType.CASH });
    const mine = await svc.list('u1');
    expect(mine).toHaveLength(2);
  });

  it('enforces ownership on getById', async () => {
    const w = await svc.create('u1', { name: 'Cash', type: WalletType.CASH });
    await expect(svc.getById('u2', w.id)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('getById: 404 for unknown id', async () => {
    await expect(svc.getById('u1', 'missing')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('update: refuses to change balance — race-prone direct write blocked', async () => {
    // Wallet balance is no longer mutable via PUT /wallets/:id — see comment
    // in wallets.controller. The update path silently ignores balance even if
    // the (now-removed) field is passed by an old client.
    const w = await svc.create('u1', {
      name: 'Cash',
      type: WalletType.CASH,
      balance: 100_000,
    });
    // Cast through `unknown` so we can intentionally pass a `balance` field
    // that isn't part of the new UpdateWalletInput shape. The service must
    // ignore it.
    const after = await svc.update(
      'u1',
      w.id,
      { balance: 500_000, isActive: false } as unknown as Parameters<typeof svc.update>[2],
    );
    expect(Number(after.balance)).toBe(100_000);
    expect(after.isActive).toBe(false);
  });
});
