import { InferenceRuleService } from './inference-rule.service';
import type { CollectedSignals } from './context-signal.service';
import type { PrivacyGates } from '../privacy/privacy.service';

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

function pat(hour: number, minute: number) {
  return {
    id: 'p',
    userId: 'u1',
    value: { hour, minute },
    confidence: 0.9,
    lastObservedAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

function baseSignals(now: Date, overrides: Partial<CollectedSignals> = {}): CollectedSignals {
  return {
    now,
    hourLocal: now.getHours(),
    gates: ALL_GATES_ON,
    patterns: {
      USUAL_SLEEP_TIME: { ...pat(23, 30), patternType: 'USUAL_SLEEP_TIME' as const },
      USUAL_MEAL_TIME_LUNCH: { ...pat(12, 0), patternType: 'USUAL_MEAL_TIME_LUNCH' as const },
    } as never,
    lastSleepDurationMin: 320,
    lastSleepEndedAt: null,
    latestMood: { energy: 'LOW', stress: 'MEDIUM' },
    pendingTasksCount: 5,
    pendingTasksAfter21Count: 3,
    overdueTasksCount: 0,
    habitsMissedToday: 0,
    hasReviewToday: false,
    mealLogsToday: { breakfast: false, lunch: false, dinner: false },
    budgetUsages: [],
    daysLeftInMonth: 10,
    ...overrides,
  } as CollectedSignals;
}

describe('InferenceRuleService', () => {
  const svc = new InferenceRuleService();

  it('POSSIBLE_SLEEPINESS fires when near usual sleep + low sleep + low energy + many late tasks', () => {
    const at22 = new Date(); at22.setHours(22, 30, 0, 0);
    const r = svc.evaluate(baseSignals(at22), 'vi');
    const sleepiness = r.find((x) => x.type === 'POSSIBLE_SLEEPINESS');
    expect(sleepiness).toBeDefined();
    expect(sleepiness!.confidence).toBeGreaterThanOrEqual(0.5);
    // Suggested action is RESCHEDULE_LIGHT because pendingLate >= 2.
    expect(sleepiness!.suggestedAction?.type).toBe('RESCHEDULE_LIGHT');
  });

  it('POSSIBLE_SLEEPINESS does NOT fire when health gate is OFF, even if sleep+energy match', () => {
    const at22 = new Date(); at22.setHours(22, 30, 0, 0);
    const r = svc.evaluate(
      baseSignals(at22, { gates: { ...ALL_GATES_ON, health: false } }),
      'vi',
    );
    expect(r.find((x) => x.type === 'POSSIBLE_SLEEPINESS')).toBeUndefined();
  });

  it('MEAL_MAY_BE_SKIPPED fires when 90+ min past usual lunch and not logged', () => {
    const lateLunch = new Date(); lateLunch.setHours(13, 35, 0, 0);
    const r = svc.evaluate(baseSignals(lateLunch, { hourLocal: 13 }), 'vi');
    const meal = r.find((x) => x.type === 'MEAL_MAY_BE_SKIPPED');
    expect(meal).toBeDefined();
    expect(meal!.suggestedAction).toEqual({ type: 'OPEN_MEAL_QUICK_LOG', mealType: 'LUNCH' });
  });

  it('MEAL_MAY_BE_SKIPPED does NOT fire when meal already logged', () => {
    const lateLunch = new Date(); lateLunch.setHours(13, 35, 0, 0);
    const r = svc.evaluate(
      baseSignals(lateLunch, { mealLogsToday: { breakfast: true, lunch: true, dinner: false } }),
      'vi',
    );
    expect(r.find((x) => x.type === 'MEAL_MAY_BE_SKIPPED')).toBeUndefined();
  });

  it('BUDGET_RISK fires when usage > threshold AND >=5 days left', () => {
    const noon = new Date(); noon.setHours(12, 0, 0, 0);
    const r = svc.evaluate(
      baseSignals(noon, {
        budgetUsages: [{ category: 'food', usagePercent: 92, threshold: 80 }],
        daysLeftInMonth: 12,
      }),
      'vi',
    );
    const risk = r.find((x) => x.type === 'BUDGET_RISK');
    expect(risk).toBeDefined();
    expect(risk!.evidence.items.map((i) => i.key)).toContain('budgetUsage');
    expect(risk!.evidence.items.map((i) => i.key)).toContain('daysLeft');
  });

  it('BUDGET_RISK does NOT fire when finance gate OFF', () => {
    const noon = new Date(); noon.setHours(12, 0, 0, 0);
    const r = svc.evaluate(
      baseSignals(noon, {
        gates: { ...ALL_GATES_ON, finance: false },
        budgetUsages: [{ category: 'food', usagePercent: 99, threshold: 80 }],
        daysLeftInMonth: 12,
      }),
      'vi',
    );
    expect(r.find((x) => x.type === 'BUDGET_RISK')).toBeUndefined();
  });

  it('NEED_REVIEW_DAY fires after 21:00 when no review yet today', () => {
    const at22 = new Date(); at22.setHours(22, 0, 0, 0);
    const r = svc.evaluate(baseSignals(at22, { hasReviewToday: false }), 'en');
    expect(r.find((x) => x.type === 'NEED_REVIEW_DAY')).toBeDefined();
  });

  it('Evidence is locale-tagged', () => {
    const at22 = new Date(); at22.setHours(22, 30, 0, 0);
    const r = svc.evaluate(baseSignals(at22), 'en');
    expect(r[0].evidence.locale).toBe('en');
    expect(r[0].evidence.items[0].summary).toMatch(/[A-Za-z]/);
  });
});
