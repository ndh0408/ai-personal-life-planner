import { PrivacyService } from './privacy.service';
import type { PrismaService } from '../../prisma/prisma.service';
import type { UserContextService } from '../intelligence/user-context.service';

interface PrivacyRow {
  personalizationEnabled: boolean;
  useFinanceForAI: boolean;
  useHealthForAI: boolean;
  useMealsForAI: boolean;
  useTasksForAI: boolean;
  aiMemoryEnabled: boolean;
  proactiveRecommendations: boolean;
  updatedAt: Date;
}

const FULL_ROW: PrivacyRow = {
  personalizationEnabled: true,
  useFinanceForAI: true,
  useHealthForAI: true,
  useMealsForAI: true,
  useTasksForAI: true,
  aiMemoryEnabled: true,
  proactiveRecommendations: true,
  updatedAt: new Date('2026-04-29T00:00:00Z'),
};

function makeService(opts: { initial?: PrivacyRow | null } = {}) {
  // `null` is a valid initial — don't collapse it via ??.
  const initial = 'initial' in opts ? opts.initial : FULL_ROW;
  const store: { current: PrivacyRow | null } = { current: initial ?? null };
  const prisma = {
    privacySetting: {
      findUnique: jest.fn(async () => store.current),
      create: jest.fn(async () => {
        store.current = { ...FULL_ROW, updatedAt: new Date() };
        return store.current;
      }),
      upsert: jest.fn(async ({ update, create }: { update: Partial<PrivacyRow>; create: Partial<PrivacyRow> }) => {
        store.current = store.current
          ? { ...store.current, ...update, updatedAt: new Date() }
          : { ...FULL_ROW, ...create, updatedAt: new Date() };
        return store.current;
      }),
    },
  } as unknown as PrismaService;
  const ctx = { invalidate: jest.fn(async () => undefined) } as unknown as UserContextService;
  return { svc: new PrivacyService(prisma, ctx), prisma, ctx, store };
}

describe('PrivacyService', () => {
  it('get() auto-creates a row when missing (legacy users)', async () => {
    const { svc, prisma } = makeService({ initial: null });
    const row = await svc.get('u1');
    expect(prisma.privacySetting.create).toHaveBeenCalledWith({ data: { userId: 'u1' } });
    expect(row.personalizationEnabled).toBe(true);
  });

  it('update() upserts and invalidates the snapshot cache', async () => {
    const { svc, ctx, store } = makeService();
    const out = await svc.update('u1', { useFinanceForAI: false });
    expect(out.useFinanceForAI).toBe(false);
    expect(store.current?.useFinanceForAI).toBe(false);
    expect(ctx.invalidate).toHaveBeenCalledWith('u1');
  });

  it('serialises updatedAt as an ISO string', async () => {
    const { svc } = makeService();
    const out = await svc.get('u1');
    expect(typeof out.updatedAt).toBe('string');
    expect(out.updatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});
