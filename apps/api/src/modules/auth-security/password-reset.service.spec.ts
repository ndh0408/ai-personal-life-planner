import * as bcrypt from 'bcrypt';
import { PasswordResetService } from './password-reset.service';
import { hashAuthToken } from './auth-token.util';
import type { ConfigService } from '@nestjs/config';
import type { SecurityAuditService } from './security-audit.service';
import type { EmailProvider } from './email-provider';
import { EmailTemplateService } from './email-template.service';

function makePrisma() {
  const users = new Map<string, any>();
  const tokens: any[] = [];
  const refresh: any[] = [];
  const api: any = {
    users,
    tokens,
    refresh,
    userProfile: {
      findUnique: jest.fn(async () => null),
    },
    user: {
      findUnique: jest.fn(({ where }: any) => {
        for (const u of users.values()) if (u.email === where.email || u.id === where.id) return Promise.resolve(u);
        return Promise.resolve(null);
      }),
      update: jest.fn(({ where, data }: any) => {
        const u = users.get(where.id);
        Object.assign(u, data);
        return Promise.resolve(u);
      }),
    },
    passwordResetToken: {
      findUnique: jest.fn(({ where, include }: any) => {
        const t = tokens.find((x) => x.tokenHash === where.tokenHash);
        if (!t) return Promise.resolve(null);
        if (include?.user) return Promise.resolve({ ...t, user: users.get(t.userId) });
        return Promise.resolve(t);
      }),
      findFirst: jest.fn(({ where, orderBy }: any) => {
        const matches = tokens.filter((t) => t.userId === where.userId);
        if (orderBy?.createdAt === 'desc') matches.sort((a, b) => b.createdAt - a.createdAt);
        return Promise.resolve(matches[0] ?? null);
      }),
      create: jest.fn(({ data }: any) => {
        const row = { id: `t-${tokens.length + 1}`, ...data, createdAt: new Date() };
        tokens.push(row);
        return Promise.resolve(row);
      }),
      update: jest.fn(({ where, data }: any) => {
        const t = tokens.find((x) => x.id === where.id);
        Object.assign(t, data);
        return Promise.resolve(t);
      }),
    },
    refreshToken: {
      updateMany: jest.fn(async ({ where, data }: any) => {
        let count = 0;
        for (const r of refresh) {
          if (r.userId === where.userId && r.revokedAt === null) {
            r.revokedAt = data.revokedAt;
            count++;
          }
        }
        return { count };
      }),
    },
    $transaction: jest.fn(async (cb: any) => cb(api)),
  };
  return api;
}

const stubConfig = { get: jest.fn(() => undefined) } as unknown as ConfigService;
const stubAudit = { record: jest.fn(async () => undefined) } as unknown as SecurityAuditService;
const stubProvider: EmailProvider = { send: jest.fn(async () => undefined) };

describe('PasswordResetService', () => {
  it('forgot on unknown email returns silently (no leak)', async () => {
    const prisma = makePrisma();
    const svc = new PasswordResetService(prisma as never, stubConfig, stubAudit, new EmailTemplateService(), stubProvider);
    await svc.forgot('nobody@b.co');
    expect(prisma.tokens).toHaveLength(0);
    // Audit DOES record the attempt (with emailHint) for forensics.
    expect((stubAudit.record as jest.Mock).mock.calls.length).toBeGreaterThanOrEqual(1);
  });

  it('reset succeeds + revokes refresh tokens + clears lockout', async () => {
    const prisma = makePrisma();
    const u = {
      id: 'u1',
      email: 'a@b.co',
      status: 'ACTIVE',
      passwordHash: await bcrypt.hash('oldpw123', 4),
      failedLoginCount: 5,
      lockedUntil: new Date(Date.now() + 5 * 60_000),
    };
    prisma.users.set(u.id, u);
    prisma.refresh.push({ userId: u.id, revokedAt: null });
    prisma.refresh.push({ userId: u.id, revokedAt: null });
    const raw = 'good-reset-token-9876543210abcdef';
    prisma.tokens.push({
      id: 't-1',
      userId: u.id,
      tokenHash: hashAuthToken(raw),
      expiresAt: new Date(Date.now() + 30 * 60_000),
      usedAt: null,
      createdAt: new Date(),
    });
    const svc = new PasswordResetService(prisma as never, stubConfig, stubAudit, new EmailTemplateService(), stubProvider);
    await svc.reset(raw, 'newpw1234');
    const after = prisma.users.get(u.id);
    expect(await bcrypt.compare('newpw1234', after.passwordHash)).toBe(true);
    expect(after.failedLoginCount).toBe(0);
    expect(after.lockedUntil).toBeNull();
    expect(prisma.refresh.every((r: any) => r.revokedAt !== null)).toBe(true);
    expect(prisma.tokens[0].usedAt).toBeInstanceOf(Date);
  });

  it('expired token rejected', async () => {
    const prisma = makePrisma();
    prisma.users.set('u1', {
      id: 'u1',
      email: 'a@b.co',
      status: 'ACTIVE',
      passwordHash: 'x',
    });
    const raw = 'expired-reset-token-12345678901234';
    prisma.tokens.push({
      id: 't-1',
      userId: 'u1',
      tokenHash: hashAuthToken(raw),
      expiresAt: new Date(Date.now() - 1000),
      usedAt: null,
      createdAt: new Date(),
    });
    const svc = new PasswordResetService(prisma as never, stubConfig, stubAudit, new EmailTemplateService(), stubProvider);
    await expect(svc.reset(raw, 'newpw1234')).rejects.toMatchObject({
      response: { errorCode: 'AUTH_TOKEN_EXPIRED' },
    });
  });

  it('weak password rejected (PASSWORD_POLICY_FAILED)', async () => {
    const prisma = makePrisma();
    prisma.users.set('u1', { id: 'u1', email: 'a@b.co', status: 'ACTIVE', passwordHash: 'x' });
    const raw = 'good-reset-token-9876543210abcdef';
    prisma.tokens.push({
      id: 't-1',
      userId: 'u1',
      tokenHash: hashAuthToken(raw),
      expiresAt: new Date(Date.now() + 60_000),
      usedAt: null,
      createdAt: new Date(),
    });
    const svc = new PasswordResetService(prisma as never, stubConfig, stubAudit, new EmailTemplateService(), stubProvider);
    await expect(svc.reset(raw, 'short')).rejects.toMatchObject({
      response: { errorCode: 'PASSWORD_POLICY_FAILED' },
    });
    await expect(svc.reset(raw, 'aaaaaaaaa')).rejects.toMatchObject({
      response: { errorCode: 'PASSWORD_POLICY_FAILED' },
    });
  });
});
