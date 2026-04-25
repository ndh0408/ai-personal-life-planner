import { WidgetSummaryService } from './widget-summary.service';
import { WidgetPreferencesService } from './widget-preferences.service';
import type { LocaleService } from '../../common/i18n/locale.service';
import type { PrivacyService, PrivacyGates } from '../privacy/privacy.service';

const ALL_GATES_ON: PrivacyGates = {
  personalization: true,
  schedule: true,
  tasks: true,
  habits: true,
  meals: true,
  meal: true,
  health: true,
  finance: true,
  goals: true,
  calendar: true,
  location: true,
  healthFitness: true,
};

function makePrisma() {
  const prefs = new Map<string, any>();
  return {
    api: {
      widgetPreferences: {
        findUnique: jest.fn(async ({ where }: any) => prefs.get(where.userId) ?? null),
        upsert: jest.fn(async ({ where, create, update }: any) => {
          const existing = prefs.get(where.userId);
          const next = existing
            ? { ...existing, ...update, updatedAt: new Date() }
            : { id: `w-${prefs.size + 1}`, ...create, createdAt: new Date(), updatedAt: new Date() };
          prefs.set(where.userId, next);
          return next;
        }),
      },
      task: {
        count: jest.fn(async () => 4),
        findFirst: jest.fn(async () => ({
          id: 't-1',
          title: 'Reply Khanh',
          dueDate: new Date('2026-04-25T22:00:00Z'),
          priority: 'HIGH',
        })),
      },
      scheduleItem: { findFirst: jest.fn(async () => null) },
      mealLog: {
        findMany: jest.fn(async () => [{ mealType: 'BREAKFAST' }, { mealType: 'LUNCH' }]),
      },
      aIRecommendation: {
        findFirst: jest.fn(async () => ({
          id: 'r-1',
          type: 'HABIT_NUDGE',
          title: 'Exercise',
          content: 'You skipped today.',
          priority: 'MEDIUM',
        })),
      },
      userProfile: { findUnique: jest.fn(async () => ({ currency: 'VND' })) },
      wallet: { aggregate: jest.fn(async () => ({ _sum: { balance: 0 } })) },
      income: { aggregate: jest.fn(async () => ({ _sum: { amount: 25_000_000 } })) },
      expense: {
        findMany: jest.fn(async () => [
          { category: 'food', amount: 3_500_000 },
          { category: 'rent', amount: 8_000_000 },
        ]),
      },
      budget: {
        findMany: jest.fn(async () => [
          { category: 'food', amount: 3_000_000, alertThresholdPercent: 80 },
        ]),
      },
      savingGoal: { findFirst: jest.fn(async () => ({ targetAmount: 1_000_000, currentAmount: 250_000 })) },
      sleepLog: { findFirst: jest.fn(async () => ({ durationMinutes: 320 })) },
      moodLog: {
        findFirst: jest.fn(async () => ({ mood: 'TIRED', energyLevel: 'LOW' })),
      },
    },
    prefs,
  };
}

function makeStubs(gates: PrivacyGates = ALL_GATES_ON) {
  const locale = { forUser: async () => 'vi' as const } as unknown as LocaleService;
  const privacy = { aiGates: async () => gates } as unknown as PrivacyService;
  return { locale, privacy };
}

describe('WidgetSummaryService', () => {
  it('returns empty-shaped doc when widget master is OFF', async () => {
    const { api } = makePrisma();
    const prefsSvc = new WidgetPreferencesService(api as never);
    await prefsSvc.update('u1', { enabled: false });
    const { locale, privacy } = makeStubs();
    const svc = new WidgetSummaryService(api as never, locale, privacy, prefsSvc);
    const r = await svc.build('u1');
    expect(r.preferences.enabled).toBe(false);
    expect(r.nextTask).toBeNull();
    expect(r.finance).toBeUndefined();
    expect(r.health).toBeUndefined();
    expect(r.topRecommendation).toBeUndefined();
  });

  it('hides finance amounts when showFinanceAmounts=false (default)', async () => {
    const { api } = makePrisma();
    const prefsSvc = new WidgetPreferencesService(api as never);
    const { locale, privacy } = makeStubs();
    const svc = new WidgetSummaryService(api as never, locale, privacy, prefsSvc);
    const r = await svc.build('u1');
    expect(r.finance).toBeDefined();
    // amounts field is ABSENT (not zeroed) — the wire shape itself doesn't carry it.
    expect(r.finance!.amounts).toBeUndefined();
    // budget warnings are still surfaced as percent (no amount leak).
    expect(r.finance!.budgetWarnings.length).toBeGreaterThan(0);
    expect(r.finance!.budgetWarnings[0].usagePercent).toBeGreaterThan(80);
  });

  it('shows finance amounts only when showFinanceAmounts=true AND privacyMode=FULL', async () => {
    const { api } = makePrisma();
    const prefsSvc = new WidgetPreferencesService(api as never);
    await prefsSvc.update('u1', { showFinanceAmounts: true, privacyMode: 'FULL' });
    const { locale, privacy } = makeStubs();
    const svc = new WidgetSummaryService(api as never, locale, privacy, prefsSvc);
    const r = await svc.build('u1');
    expect(r.finance!.amounts).toEqual({
      totalIncome: 25_000_000,
      totalExpense: 11_500_000,
      remaining: 13_500_000,
    });
  });

  it('drops finance entirely when finance privacy gate OFF, regardless of widget pref', async () => {
    const { api } = makePrisma();
    const prefsSvc = new WidgetPreferencesService(api as never);
    await prefsSvc.update('u1', {
      showFinance: true,
      showFinanceAmounts: true,
      privacyMode: 'FULL',
    });
    const { locale, privacy } = makeStubs({ ...ALL_GATES_ON, finance: false });
    const svc = new WidgetSummaryService(api as never, locale, privacy, prefsSvc);
    const r = await svc.build('u1');
    expect(r.finance).toBeUndefined();
  });

  it('drops health + recommendation when privacyMode=MINIMAL', async () => {
    const { api } = makePrisma();
    const prefsSvc = new WidgetPreferencesService(api as never);
    await prefsSvc.update('u1', { privacyMode: 'MINIMAL' });
    const { locale, privacy } = makeStubs();
    const svc = new WidgetSummaryService(api as never, locale, privacy, prefsSvc);
    const r = await svc.build('u1');
    expect(r.health).toBeUndefined();
    expect(r.topRecommendation).toBeUndefined();
  });
});
