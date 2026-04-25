import { EmailVerificationService } from './email-verification.service';
import { hashAuthToken } from './auth-token.util';
import type { ConfigService } from '@nestjs/config';
import type { SecurityAuditService } from './security-audit.service';
import type { EmailProvider } from './email-provider';

function makePrisma() {
  const users = new Map<string, any>();
  const tokens: any[] = [];
  const api: any = {
    users,
    tokens,
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
    emailVerificationToken: {
      findFirst: jest.fn(({ where, orderBy }: any) => {
        const matches = tokens.filter((t) => t.userId === where.userId);
        if (orderBy?.createdAt === 'desc') matches.sort((a, b) => b.createdAt - a.createdAt);
        return Promise.resolve(matches[0] ?? null);
      }),
      findUnique: jest.fn(({ where, include }: any) => {
        const t = tokens.find((x) => x.tokenHash === where.tokenHash);
        if (!t) return Promise.resolve(null);
        if (include?.user) {
          const u = users.get(t.userId);
          return Promise.resolve({ ...t, user: u });
        }
        return Promise.resolve(t);
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
      updateMany: jest.fn(async () => ({ count: 0 })),
    },
    $transaction: jest.fn(async (cb: any) => cb(api)),
  };
  return api;
}

const stubConfig = {
  get: jest.fn(() => undefined),
} as unknown as ConfigService;

const stubAudit = { record: jest.fn(async () => undefined) } as unknown as SecurityAuditService;

const captureProvider = (): EmailProvider & { sent: any[] } => {
  const sent: any[] = [];
  return {
    sent,
    async send(m) {
      sent.push(m);
    },
  } as EmailProvider & { sent: any[] };
};

describe('EmailVerificationService', () => {
  it('resend stores token HASH, never raw', async () => {
    const prisma = makePrisma();
    prisma.users.set('u1', { id: 'u1', email: 'a@b.co', displayName: 'A', emailVerifiedAt: null });
    const provider = captureProvider();
    const svc = new EmailVerificationService(prisma as never, stubConfig, stubAudit, provider);
    await svc.resend('a@b.co');
    expect(prisma.tokens).toHaveLength(1);
    const stored = prisma.tokens[0];
    expect(stored.tokenHash).toMatch(/^[a-f0-9]{64}$/);
    // No `raw`/`token` field on the row.
    expect(stored.token).toBeUndefined();
    expect(provider.sent[0].to).toBe('a@b.co');
  });

  it('verify succeeds + sets emailVerifiedAt; usedAt on token', async () => {
    const prisma = makePrisma();
    prisma.users.set('u1', { id: 'u1', email: 'a@b.co', displayName: 'A', emailVerifiedAt: null });
    const provider = captureProvider();
    const svc = new EmailVerificationService(prisma as never, stubConfig, stubAudit, provider);
    // Inject a known token rather than relying on the random one from resend().
    const raw = 'a-fake-but-long-enough-token-1234567890';
    prisma.tokens.push({
      id: 't-1',
      userId: 'u1',
      tokenHash: hashAuthToken(raw),
      expiresAt: new Date(Date.now() + 60_000),
      usedAt: null,
      createdAt: new Date(),
    });
    await svc.verify(raw);
    expect(prisma.users.get('u1').emailVerifiedAt).toBeInstanceOf(Date);
    expect(prisma.tokens[0].usedAt).toBeInstanceOf(Date);
  });

  it('expired token rejected', async () => {
    const prisma = makePrisma();
    prisma.users.set('u1', { id: 'u1', email: 'a@b.co', emailVerifiedAt: null });
    const provider = captureProvider();
    const svc = new EmailVerificationService(prisma as never, stubConfig, stubAudit, provider);
    const raw = 'expired-token-1234567890123456';
    prisma.tokens.push({
      id: 't-1',
      userId: 'u1',
      tokenHash: hashAuthToken(raw),
      expiresAt: new Date(Date.now() - 1000),
      usedAt: null,
      createdAt: new Date(),
    });
    await expect(svc.verify(raw)).rejects.toMatchObject({
      response: { errorCode: 'AUTH_TOKEN_EXPIRED' },
    });
  });

  it('used token rejected', async () => {
    const prisma = makePrisma();
    prisma.users.set('u1', { id: 'u1', email: 'a@b.co', emailVerifiedAt: null });
    const provider = captureProvider();
    const svc = new EmailVerificationService(prisma as never, stubConfig, stubAudit, provider);
    const raw = 'used-token-12345678901234567';
    prisma.tokens.push({
      id: 't-1',
      userId: 'u1',
      tokenHash: hashAuthToken(raw),
      expiresAt: new Date(Date.now() + 60_000),
      usedAt: new Date(Date.now() - 1000),
      createdAt: new Date(),
    });
    await expect(svc.verify(raw)).rejects.toMatchObject({
      response: { errorCode: 'AUTH_TOKEN_USED' },
    });
  });

  it('resend on unknown email is a silent no-op', async () => {
    const prisma = makePrisma();
    const provider = captureProvider();
    const svc = new EmailVerificationService(prisma as never, stubConfig, stubAudit, provider);
    await svc.resend('nobody@b.co');
    expect(prisma.tokens).toHaveLength(0);
    expect(provider.sent).toHaveLength(0);
  });

  it('resend rate-limited within 1 minute window', async () => {
    const prisma = makePrisma();
    prisma.users.set('u1', { id: 'u1', email: 'a@b.co', displayName: 'A', emailVerifiedAt: null });
    const provider = captureProvider();
    const svc = new EmailVerificationService(prisma as never, stubConfig, stubAudit, provider);
    await svc.resend('a@b.co');
    await svc.resend('a@b.co');
    expect(prisma.tokens).toHaveLength(1);
    expect(provider.sent).toHaveLength(1);
  });
});
