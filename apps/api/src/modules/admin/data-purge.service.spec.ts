import { DataPurgeService } from './data-purge.service';
import type { PrismaService } from '../../prisma/prisma.service';
import type { SecurityAuditService } from '../auth-security/security-audit.service';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';

const CONFIRM = DataPurgeService.REQUIRED_CONFIRMATION;

function makePrisma(target: { id: string; email: string; role: 'USER' | 'ADMIN' } | null) {
  const txCalls: any[] = [];
  const counter = jest.fn(async () => 0);
  const tx = {
    securityAuditLog: { updateMany: jest.fn(async () => ({ count: 0 })) },
    user: { delete: jest.fn(async () => ({ id: target?.id })) },
  };
  const api: any = {
    user: {
      findUnique: jest.fn(async ({ where }: any) =>
        where.id === target?.id ? target : null,
      ),
    },
    dailySchedule: { count: counter },
    task: { count: counter },
    habit: { count: counter },
    wallet: { count: counter },
    income: { count: counter },
    expense: { count: counter },
    budget: { count: counter },
    debt: { count: counter },
    savingGoal: { count: counter },
    personalGoal: { count: counter },
    aIMessage: { count: counter },
    aIRecommendation: { count: counter },
    notificationLog: { count: counter },
    connectedAccount: { count: counter },
    userAiProvider: { count: counter },
    financeAuditLog: { count: counter },
    securityAuditLog: { count: counter },
    $transaction: jest.fn(async (cb: any) => {
      txCalls.push('begin');
      const r = await cb(tx);
      txCalls.push('commit');
      return r;
    }),
  };
  return { prisma: api as PrismaService, tx, txCalls, counter };
}

const stubSec = { record: jest.fn(async () => undefined) } as unknown as SecurityAuditService;

describe('DataPurgeService', () => {
  beforeEach(() => jest.clearAllMocks());

  it('refuses without the confirmation string', async () => {
    const { prisma } = makePrisma({ id: 't1', email: 't@x', role: 'USER' });
    const svc = new DataPurgeService(prisma, stubSec);
    await expect(
      svc.purge({ targetUserId: 't1', actingAdminId: 'a1', confirmation: 'oops' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('refuses self-purge', async () => {
    const { prisma } = makePrisma({ id: 'a1', email: 'a@x', role: 'USER' });
    const svc = new DataPurgeService(prisma, stubSec);
    await expect(
      svc.purge({ targetUserId: 'a1', actingAdminId: 'a1', confirmation: CONFIRM }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('refuses 404 on missing target', async () => {
    const { prisma } = makePrisma(null);
    const svc = new DataPurgeService(prisma, stubSec);
    await expect(
      svc.purge({ targetUserId: 'gone', actingAdminId: 'a1', confirmation: CONFIRM }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('refuses purging an admin', async () => {
    const { prisma } = makePrisma({ id: 't1', email: 't@x', role: 'ADMIN' });
    const svc = new DataPurgeService(prisma, stubSec);
    await expect(
      svc.purge({ targetUserId: 't1', actingAdminId: 'a1', confirmation: CONFIRM }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('dry-run returns counts without committing a transaction', async () => {
    const { prisma, txCalls } = makePrisma({ id: 't1', email: 't@x', role: 'USER' });
    const svc = new DataPurgeService(prisma, stubSec);
    const out = await svc.purge({
      targetUserId: 't1',
      actingAdminId: 'a1',
      confirmation: CONFIRM,
      dryRun: true,
    });
    expect(out.dryRun).toBe(true);
    expect(out.counts).toBeDefined();
    expect(txCalls).toEqual([]);
  });

  it('real purge commits inside a transaction + emits audit rows', async () => {
    const { prisma, tx, txCalls } = makePrisma({ id: 't1', email: 't@x', role: 'USER' });
    const svc = new DataPurgeService(prisma, stubSec);
    const out = await svc.purge({
      targetUserId: 't1',
      actingAdminId: 'a1',
      confirmation: CONFIRM,
    });
    expect(out.dryRun).toBe(false);
    expect(txCalls).toEqual(['begin', 'commit']);
    expect(tx.securityAuditLog.updateMany).toHaveBeenCalledWith({
      where: { userId: 't1' },
      data: { userId: null, emailHint: null },
    });
    expect(tx.user.delete).toHaveBeenCalledWith({ where: { id: 't1' } });
    // Two audit-record calls — one before, one after.
    expect((stubSec.record as jest.Mock).mock.calls.length).toBeGreaterThanOrEqual(2);
  });
});
