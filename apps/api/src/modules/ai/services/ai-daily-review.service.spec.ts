import { AiDailyReviewService } from './ai-daily-review.service';
import { AiProviderService } from './ai-provider.service';
import { AiPromptTemplateService } from './ai-prompt-template.service';
import { AiJsonValidationService } from './ai-json-validation.service';
import { AiHealthService } from './ai-health.service';
import { AiGoalService } from './ai-goal.service';
import { MockAiProvider } from '../providers/mock.provider';
import type { LocaleService } from '../../../common/i18n/locale.service';

function mockLocale(tag: 'vi' | 'en' = 'vi'): LocaleService {
  return {
    forUser: jest.fn(() => Promise.resolve(tag)),
    fromRequest: jest.fn(() => tag),
    get default() {
      return tag;
    },
  } as unknown as LocaleService;
}

function makePrisma() {
  const upsertSpy = jest.fn((args: { update: Record<string, unknown>; create: Record<string, unknown> }) =>
    Promise.resolve({ id: 'dr-1', ...args.create }),
  );
  const api = {
    userProfile: { findUnique: jest.fn(() => Promise.resolve({ currency: 'VND' })) },
    dailySchedule: { findFirst: jest.fn(() => Promise.resolve(null)) },
    task: { findMany: jest.fn(() => Promise.resolve([])) },
    habit: { count: jest.fn(() => Promise.resolve(3)) },
    habitLog: { findMany: jest.fn(() => Promise.resolve([])) },
    mealPlan: { count: jest.fn(() => Promise.resolve(1)) },
    mealLog: { findMany: jest.fn(() => Promise.resolve([])) },
    sleepLog: { findFirst: jest.fn(() => Promise.resolve(null)) },
    moodLog: { findFirst: jest.fn(() => Promise.resolve(null)) },
    expense: { findMany: jest.fn(() => Promise.resolve([])) },
    personalGoal: { findMany: jest.fn(() => Promise.resolve([])) },
    dailyReview: { upsert: upsertSpy },
    $transaction: jest.fn((calls: Promise<unknown>[]) => Promise.all(calls)),
  };
  return { api, upsertSpy };
}

describe('AiDailyReviewService', () => {
  it('writes a DailyReview row on happy path', async () => {
    const { api, upsertSpy } = makePrisma();
    const provider = new AiProviderService(new MockAiProvider());
    const svc = new AiDailyReviewService(
      api as never,
      provider,
      new AiPromptTemplateService(),
      new AiJsonValidationService(provider),
      mockLocale('vi'),
      new AiHealthService(),
      new AiGoalService(api as never),
    );
    const result = await svc.review('u1', { date: '2026-04-24' }, {});
    expect(result.usedFallback).toBe(false);
    expect(upsertSpy).toHaveBeenCalledTimes(1);
    expect(result.review.todaySummary.length).toBeGreaterThan(0);
  });

  it('swaps unsafe healthAdvice with a safe fallback (health screening)', async () => {
    const { api } = makePrisma();
    const mock = new MockAiProvider();
    mock.setNextResponse(
      JSON.stringify({
        todaySummary: 'ok',
        wins: [],
        issues: [],
        suggestionsForTomorrow: [],
        healthAdvice: 'take a prescription dosage of X for your condition', // triggers screen
        financeAdvice: 'ok',
        productivityAdvice: 'ok',
      }),
    );
    const provider = new AiProviderService(mock);
    const svc = new AiDailyReviewService(
      api as never,
      provider,
      new AiPromptTemplateService(),
      new AiJsonValidationService(provider),
      mockLocale('en'),
      new AiHealthService(),
      new AiGoalService(api as never),
    );
    const result = await svc.review('u1', { date: '2026-04-24' }, {});
    expect(result.review.healthAdvice).toContain('qualified professional');
  });

  it('falls back when JSON repair still fails (locale=en)', async () => {
    const { api } = makePrisma();
    const mock = new MockAiProvider();
    mock.setBroken(true);
    mock.setNextResponse('still garbage');
    const provider = new AiProviderService(mock);
    const svc = new AiDailyReviewService(
      api as never,
      provider,
      new AiPromptTemplateService(),
      new AiJsonValidationService(provider),
      mockLocale('en'),
      new AiHealthService(),
      new AiGoalService(api as never),
    );
    const result = await svc.review('u1', { date: '2026-04-24' }, {});
    expect(result.usedFallback).toBe(true);
    expect(result.review.todaySummary).toMatch(/unavailable/);
  });
});
