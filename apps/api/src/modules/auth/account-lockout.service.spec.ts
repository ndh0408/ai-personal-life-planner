import { AccountLockoutService, LOCK_MINUTES, MAX_FAILS } from './account-lockout.service';

interface UserRow {
  id: string;
  failedLoginCount: number;
  lockUntil: Date | null;
  lastLoginAt: Date | null;
  lastFailedLoginAt: Date | null;
}

/** Minimal in-memory PrismaService stub. We only exercise user.update. */
function makeFakePrisma(initial: UserRow) {
  const row = { ...initial };
  return {
    row,
    user: {
      update: jest.fn(async ({ data, select }: { data: Record<string, unknown>; select?: Record<string, true> }) => {
        if ('failedLoginCount' in data && typeof data.failedLoginCount === 'object') {
          // { increment: 1 }
          row.failedLoginCount += (data.failedLoginCount as { increment: number }).increment;
        } else if ('failedLoginCount' in data) {
          row.failedLoginCount = data.failedLoginCount as number;
        }
        if ('lockUntil' in data) row.lockUntil = data.lockUntil as Date | null;
        if ('lastLoginAt' in data) row.lastLoginAt = data.lastLoginAt as Date | null;
        if ('lastFailedLoginAt' in data) row.lastFailedLoginAt = data.lastFailedLoginAt as Date | null;
        if (select) {
          const out: Record<string, unknown> = {};
          for (const k of Object.keys(select)) out[k] = (row as unknown as Record<string, unknown>)[k];
          return out;
        }
        return row;
      }),
    },
  };
}

describe('AccountLockoutService', () => {
  it('isLocked() returns null when lockUntil is null', () => {
    const svc = new AccountLockoutService({} as never);
    expect(svc.isLocked({ lockUntil: null })).toBeNull();
  });

  it('isLocked() returns null when lockUntil is in the past', () => {
    const svc = new AccountLockoutService({} as never);
    const past = new Date(Date.now() - 60_000);
    expect(svc.isLocked({ lockUntil: past })).toBeNull();
  });

  it('isLocked() returns the deadline when lockUntil is in the future', () => {
    const svc = new AccountLockoutService({} as never);
    const future = new Date(Date.now() + 60_000);
    expect(svc.isLocked({ lockUntil: future })?.until).toBe(future);
  });

  it('records failures without locking until threshold reached', async () => {
    const fake = makeFakePrisma({
      id: 'u1',
      failedLoginCount: 0,
      lockUntil: null,
      lastLoginAt: null,
      lastFailedLoginAt: null,
    });
    const svc = new AccountLockoutService(fake as unknown as never);
    for (let i = 1; i < MAX_FAILS; i++) {
      const r = await svc.recordFailure('u1', fake as unknown as never);
      expect(r.lockedUntil).toBeNull();
      expect(r.count).toBe(i);
    }
  });

  it('locks the account on the MAX_FAILS-th failure', async () => {
    const fake = makeFakePrisma({
      id: 'u1',
      failedLoginCount: MAX_FAILS - 1,
      lockUntil: null,
      lastLoginAt: null,
      lastFailedLoginAt: null,
    });
    const svc = new AccountLockoutService(fake as unknown as never);
    const before = Date.now();
    const r = await svc.recordFailure('u1', fake as unknown as never);
    expect(r.count).toBe(MAX_FAILS);
    expect(r.lockedUntil).toBeInstanceOf(Date);
    const expectedUnlock = before + LOCK_MINUTES * 60_000;
    // Allow a small clock-skew margin since recordFailure does its own Date.now().
    expect(r.lockedUntil!.getTime()).toBeGreaterThanOrEqual(expectedUnlock - 1000);
    expect(r.lockedUntil!.getTime()).toBeLessThanOrEqual(expectedUnlock + 1000);
  });

  it('recordSuccess() clears the failure counter and stamps lastLoginAt', async () => {
    const fake = makeFakePrisma({
      id: 'u1',
      failedLoginCount: 3,
      lockUntil: new Date(Date.now() + 60_000),
      lastLoginAt: null,
      lastFailedLoginAt: new Date(),
    });
    const svc = new AccountLockoutService(fake as unknown as never);
    await svc.recordSuccess('u1', fake as unknown as never);
    expect(fake.row.failedLoginCount).toBe(0);
    expect(fake.row.lockUntil).toBeNull();
    expect(fake.row.lastLoginAt).toBeInstanceOf(Date);
  });
});
