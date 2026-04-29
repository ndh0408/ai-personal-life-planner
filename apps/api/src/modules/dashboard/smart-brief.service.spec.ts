import { SmartBriefService } from './smart-brief.service';
import type { UserContext } from '../intelligence/user-context.service';

const FULL_PRIVACY: UserContext['privacy'] = {
  personalizationEnabled: true,
  useFinanceForAI: true,
  useHealthForAI: true,
  useMealsForAI: true,
  useTasksForAI: true,
  aiMemoryEnabled: true,
};

function ctxWith(overrides: Partial<UserContext>): UserContext {
  return {
    snapshotVersion: 'test',
    generatedAt: '2026-04-29T09:00:00.000Z',
    now: '2026-04-29T09:00:00.000Z',
    tz: 'Asia/Ho_Chi_Minh',
    privacy: FULL_PRIVACY,
    profile: {
      preferredName: 'Nam',
      locale: 'vi',
      mainGoals: [],
      usualWakeTime: null,
      usualSleepTime: null,
      dislikes: [],
      allergies: [],
      monthlyGoal: null,
      workPattern: null,
      budgetMonthly: null,
    },
    behavior: {
      wakeHistogram: [],
      sleepHistogram: [],
      avgSleepByWeekday: [],
      peakFocus: null,
      topExpenseCategories: [],
      recentMealTitles: [],
      moodSleepCorrelation: null,
      taskCompletionByPrio: { LOW: 0, MEDIUM: 0, HIGH: 0 },
    },
    recentEvents: [],
    memories: [],
    wallets: [],
    recentCorrections: [],
    lastSleepMinutes: null,
    lastMood: null,
    todaySpendVnd: 0,
    monthSpendVnd: 0,
    openHighPriorityTaskCount: 0,
    ...overrides,
  };
}

describe('SmartBriefService', () => {
  const svc = new SmartBriefService();

  it('returns null when personalization is disabled', () => {
    const ctx = ctxWith({ privacy: { ...FULL_PRIVACY, personalizationEnabled: false } });
    expect(
      svc.build({
        ctx,
        todayPlanItems: 0,
        todayPlanDone: 0,
        budgetMonthly: null,
        monthSpend: 0,
        hasAiKey: false,
      }),
    ).toBeNull();
  });

  it('flags an urgent brief when month spend exceeds budget', () => {
    const ctx = ctxWith({ monthSpendVnd: 11_000_000 });
    const brief = svc.build({
      ctx,
      todayPlanItems: 0,
      todayPlanDone: 0,
      budgetMonthly: 10_000_000,
      monthSpend: 11_000_000,
      hasAiKey: false,
    });
    expect(brief?.tone).toBe('urgent');
    expect(brief?.reasonLabels).toContain('vượt mức');
  });

  it('returns a gentle brief when sleep was short and mood is rough', () => {
    const ctx = ctxWith({ lastSleepMinutes: 320, lastMood: 'TIRED' });
    const brief = svc.build({
      ctx,
      todayPlanItems: 0,
      todayPlanDone: 0,
      budgetMonthly: null,
      monthSpend: 0,
      hasAiKey: false,
    });
    expect(brief?.tone).toBe('gentle');
  });

  it('celebrates when the plan is fully complete', () => {
    const ctx = ctxWith({});
    const brief = svc.build({
      ctx,
      todayPlanItems: 4,
      todayPlanDone: 4,
      budgetMonthly: null,
      monthSpend: 0,
      hasAiKey: false,
    });
    expect(brief?.tone).toBe('celebratory');
  });

  it('falls back to a neutral brief with the user name', () => {
    const ctx = ctxWith({});
    const brief = svc.build({
      ctx,
      todayPlanItems: 0,
      todayPlanDone: 0,
      budgetMonthly: null,
      monthSpend: 0,
      hasAiKey: true,
    });
    expect(brief?.tone).toBe('neutral');
  });

  it('lists privacy-limited domains accurately', () => {
    const ctx = ctxWith({
      privacy: { ...FULL_PRIVACY, useFinanceForAI: false, useHealthForAI: false },
    });
    expect(svc.privacyLimitedDomains(ctx)).toEqual(['finance', 'health']);
  });
});
