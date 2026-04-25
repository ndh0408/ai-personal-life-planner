import { AuthService } from './auth.service';
import * as bcrypt from 'bcrypt';
import { UnauthorizedException } from '@nestjs/common';
import type { JwtService } from '@nestjs/jwt';
import type { ConfigService } from '@nestjs/config';
import type { SecurityAuditService } from '../auth-security/security-audit.service';

function makePrisma() {
  const users = new Map<string, any>();
  const refreshTokens: any[] = [];
  const api: any = {
    users,
    user: {
      findUnique: jest.fn(({ where }: any) => {
        if (where.email) {
          for (const u of users.values()) if (u.email === where.email) return Promise.resolve(u);
          return Promise.resolve(null);
        }
        return Promise.resolve(users.get(where.id) ?? null);
      }),
      update: jest.fn(({ where, data }: any) => {
        const u = users.get(where.id);
        if (!u) throw new Error('not found');
        Object.assign(u, data);
        return Promise.resolve(u);
      }),
    },
    refreshToken: {
      create: jest.fn(({ data }: any) => {
        refreshTokens.push(data);
        return Promise.resolve({ id: `rt-${refreshTokens.length}`, ...data });
      }),
      findUnique: jest.fn(async () => null),
      update: jest.fn(async () => undefined),
      updateMany: jest.fn(async () => ({ count: 0 })),
    },
  };
  return { prisma: api, refreshTokens };
}

const stubJwt = {
  signAsync: jest.fn(async () => 'token'),
} as unknown as JwtService;

const stubConfig = {
  get: jest.fn((k: string, def?: string) => {
    if (k === 'JWT_REFRESH_EXPIRES_IN') return '30d';
    if (k === 'JWT_ACCESS_EXPIRES_IN') return '15m';
    if (k === 'JWT_REFRESH_SECRET') return 'a'.repeat(32);
    return def;
  }),
} as unknown as ConfigService;

const stubAudit = {
  record: jest.fn(async () => undefined),
} as unknown as SecurityAuditService;

async function seedUser(prisma: any, opts: { email: string; password: string }) {
  const hash = await bcrypt.hash(opts.password, 4);
  const u: any = {
    id: `u-${prisma.users.size + 1}`,
    email: opts.email,
    passwordHash: hash,
    displayName: 'Test',
    status: 'ACTIVE' as const,
    failedLoginCount: 0,
    lastFailedLoginAt: null as Date | null,
    lockedUntil: null as Date | null,
  };
  prisma.users.set(u.id, u);
  return u;
}

describe('AuthService.login per-account lockout', () => {
  beforeEach(() => jest.clearAllMocks());

  it('5 failed attempts in 15 min lock the account', async () => {
    const ctx = makePrisma();
    const u = await seedUser(ctx.prisma, { email: 'a@b.co', password: 'rightpw1' });
    const svc = new AuthService(ctx.prisma as never, stubJwt, stubConfig, stubAudit);
    for (let i = 0; i < 4; i++) {
      await expect(svc.login({ email: u.email, password: 'wrong' } as any)).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    }
    expect(ctx.prisma.users.get(u.id).failedLoginCount).toBe(4);
    expect(ctx.prisma.users.get(u.id).lockedUntil).toBeNull();
    await expect(svc.login({ email: u.email, password: 'wrong' } as any)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    const after = ctx.prisma.users.get(u.id);
    expect(after.failedLoginCount).toBe(5);
    expect(after.lockedUntil).toBeInstanceOf(Date);
    expect(after.lockedUntil.getTime()).toBeGreaterThan(Date.now());
  });

  it('locked account rejects even the correct password until unlock', async () => {
    const ctx = makePrisma();
    const u = await seedUser(ctx.prisma, { email: 'b@b.co', password: 'rightpw1' });
    // Force into locked state.
    u.lockedUntil = new Date(Date.now() + 5 * 60_000);
    const svc = new AuthService(ctx.prisma as never, stubJwt, stubConfig, stubAudit);
    await expect(svc.login({ email: u.email, password: 'rightpw1' } as any)).rejects.toMatchObject({
      response: { errorCode: 'ACCOUNT_TEMPORARILY_LOCKED' },
    });
  });

  it('successful login resets failedLoginCount + emits LOGIN_SUCCESS_AFTER_FAILURE when prior failures', async () => {
    const ctx = makePrisma();
    const u = await seedUser(ctx.prisma, { email: 'c@b.co', password: 'rightpw1' });
    u.failedLoginCount = 3;
    u.lastFailedLoginAt = new Date();
    const svc = new AuthService(ctx.prisma as never, stubJwt, stubConfig, stubAudit);
    await svc.login({ email: u.email, password: 'rightpw1' } as any);
    expect(ctx.prisma.users.get(u.id).failedLoginCount).toBe(0);
    expect(ctx.prisma.users.get(u.id).lockedUntil).toBeNull();
    const calls = (stubAudit.record as jest.Mock).mock.calls.map((c) => c[0].type);
    expect(calls).toContain('LOGIN_SUCCESS_AFTER_FAILURE');
  });

  it('unknown email + wrong email both throw AUTH_INVALID_CREDENTIALS (no enumeration)', async () => {
    const ctx = makePrisma();
    await seedUser(ctx.prisma, { email: 'real@b.co', password: 'rightpw1' });
    const svc = new AuthService(ctx.prisma as never, stubJwt, stubConfig, stubAudit);
    await expect(svc.login({ email: 'unknown@b.co', password: 'x' } as any)).rejects.toMatchObject({
      response: { errorCode: 'AUTH_INVALID_CREDENTIALS' },
    });
    await expect(svc.login({ email: 'real@b.co', password: 'wrong' } as any)).rejects.toMatchObject({
      response: { errorCode: 'AUTH_INVALID_CREDENTIALS' },
    });
  });
});
