import { SubscriptionService } from './subscription.service';

interface Row {
  id: string;
  userId: string;
  tier: 'FREE' | 'PLUS' | 'PRO' | 'LIFETIME';
  status: 'NONE' | 'TRIAL' | 'ACTIVE' | 'GRACE' | 'EXPIRED' | 'CANCELLED';
  provider: 'appstore' | 'playstore' | 'stripe' | 'promo' | 'lifetime' | 'none';
  providerCustomerId: string | null;
  providerSubscriptionId: string | null;
  currentPeriodEnd: Date | null;
  autoRenew: boolean;
  lifetimePurchasedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

class FakePrisma {
  rows = new Map<string, Row>();
  private now = () => new Date();

  subscription = {
    upsert: async ({
      where,
      update,
      create,
    }: {
      where: { userId: string };
      update: Partial<Row>;
      create: Partial<Row> & { userId: string };
    }) => {
      const existing = this.rows.get(where.userId);
      if (existing) {
        const merged: Row = { ...existing, ...update, updatedAt: this.now() };
        this.rows.set(where.userId, merged);
        return merged;
      }
      const fresh: Row = {
        id: `sub-${this.rows.size + 1}`,
        tier: 'FREE',
        status: 'NONE',
        provider: 'none',
        providerCustomerId: null,
        providerSubscriptionId: null,
        currentPeriodEnd: null,
        autoRenew: false,
        lifetimePurchasedAt: null,
        createdAt: this.now(),
        updatedAt: this.now(),
        ...create,
        userId: where.userId,
      };
      this.rows.set(where.userId, fresh);
      return fresh;
    },
    findUnique: async ({ where }: { where: { userId: string } }) =>
      this.rows.get(where.userId) ?? null,
  };
}

describe('SubscriptionService', () => {
  let prisma: FakePrisma;
  let service: SubscriptionService;

  beforeEach(() => {
    prisma = new FakePrisma();
    service = new SubscriptionService(prisma as never);
  });

  it('creates a FREE row on first read', async () => {
    const r = await service.get('u1');
    expect(r.subscription.tier).toBe('FREE');
    expect(r.subscription.status).toBe('NONE');
    expect(r.entitlements.byokAllowed).toBe(false);
    expect(r.entitlements.maxDevices).toBe(1);
  });

  it('upgrades to PLUS sets ACTIVE + plus entitlements', async () => {
    const r = await service.setTier('u1', 'PLUS');
    expect(r.subscription.tier).toBe('PLUS');
    expect(r.subscription.status).toBe('ACTIVE');
    expect(r.entitlements.weeklyReview).toBe(true);
    expect(r.entitlements.byokAllowed).toBe(false);
  });

  it('upgrades to PRO unlocks BYOK + bank sync', async () => {
    const r = await service.setTier('u1', 'PRO');
    expect(r.subscription.tier).toBe('PRO');
    expect(r.entitlements.byokAllowed).toBe(true);
    expect(r.entitlements.bankCalendarSync).toBe(true);
  });

  it('LIFETIME sets lifetimePurchasedAt automatically', async () => {
    const r = await service.setTier('u1', 'LIFETIME');
    expect(r.subscription.tier).toBe('LIFETIME');
    expect(r.subscription.provider).toBe('lifetime');
    expect(r.subscription.lifetimePurchasedAt).not.toBeNull();
    expect(r.entitlements.familySharingSeats).toBe(5);
  });

  it('entitlements() returns FREE for never-subscribed user', async () => {
    const e = await service.entitlements('ghost');
    expect(e.byokAllowed).toBe(false);
    expect(e.aiQueriesPerMonth).toBeGreaterThan(0);
  });
});
