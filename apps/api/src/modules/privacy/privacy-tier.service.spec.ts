import { BadRequestException } from '@nestjs/common';
import { PrivacyTierService } from './privacy-tier.service';

type Row = {
  tier: 'CLOUD' | 'HYBRID' | 'LOCAL';
  e2eeKeyFingerprint: string | null;
  onDeviceLlmReady: boolean;
  updatedAt: Date;
};

class FakePrisma {
  rows = new Map<string, Row>();
  privacySetting = {
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
        const merged: Row = { ...existing, ...update, updatedAt: new Date() };
        this.rows.set(where.userId, merged);
        return merged;
      }
      const fresh: Row = {
        tier: 'CLOUD',
        e2eeKeyFingerprint: null,
        onDeviceLlmReady: false,
        updatedAt: new Date(),
        ...create,
      };
      this.rows.set(where.userId, fresh);
      return fresh;
    },
    findUnique: async ({ where }: { where: { userId: string } }) =>
      this.rows.get(where.userId) ?? null,
  };
}

describe('PrivacyTierService', () => {
  let prisma: FakePrisma;
  let service: PrivacyTierService;

  beforeEach(() => {
    prisma = new FakePrisma();
    service = new PrivacyTierService(prisma as never);
  });

  it('returns CLOUD by default for a fresh user', async () => {
    const row = await service.get('u1');
    expect(row.tier).toBe('CLOUD');
    expect(row.e2eeKeyFingerprint).toBeNull();
    expect(row.onDeviceLlmReady).toBe(false);
  });

  it('rejects HYBRID without an E2EE fingerprint', async () => {
    await expect(
      service.set('u1', { tier: 'HYBRID', e2eeKeyFingerprint: null }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects LOCAL without an E2EE fingerprint', async () => {
    await expect(service.set('u1', { tier: 'LOCAL' })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('accepts HYBRID with a fingerprint', async () => {
    const row = await service.set('u1', { tier: 'HYBRID', e2eeKeyFingerprint: 'abc123' });
    expect(row.tier).toBe('HYBRID');
    expect(row.e2eeKeyFingerprint).toBe('abc123');
  });

  it('cloudAiAllowed defaults true for never-set users', async () => {
    expect(await service.cloudAiAllowed('new-user')).toBe(true);
  });

  it('cloudAiAllowed returns false only for LOCAL', async () => {
    await service.set('u1', { tier: 'LOCAL', e2eeKeyFingerprint: 'fp' });
    expect(await service.cloudAiAllowed('u1')).toBe(false);
    await service.set('u2', { tier: 'CLOUD' });
    expect(await service.cloudAiAllowed('u2')).toBe(true);
    await service.set('u3', { tier: 'HYBRID', e2eeKeyFingerprint: 'fp' });
    expect(await service.cloudAiAllowed('u3')).toBe(true);
  });

  it('markOnDeviceLlmReady toggles the flag', async () => {
    await service.markOnDeviceLlmReady('u1', true);
    expect((await service.get('u1')).onDeviceLlmReady).toBe(true);
    await service.markOnDeviceLlmReady('u1', false);
    expect((await service.get('u1')).onDeviceLlmReady).toBe(false);
  });
});
