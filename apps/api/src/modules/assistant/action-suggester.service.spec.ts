import { ActionSuggesterService } from './action-suggester.service';
import type { UserContext } from '../intelligence/user-context.service';

const FULL_PRIVACY: UserContext['privacy'] = {
  personalizationEnabled: true,
  useFinanceForAI: true,
  useHealthForAI: true,
  useMealsForAI: true,
  useTasksForAI: true,
  aiMemoryEnabled: true,
};

function baseCtx(): UserContext {
  return {
    snapshotVersion: 'test',
    generatedAt: '2026-04-29T09:00:00.000Z',
    now: '2026-04-29T09:00:00.000Z',
    tz: 'Asia/Ho_Chi_Minh',
    privacy: FULL_PRIVACY,
    profile: null,
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
    todaySpendVnd: null,
    monthSpendVnd: null,
    openHighPriorityTaskCount: null,
  };
}

describe('ActionSuggesterService', () => {
  const svc = new ActionSuggesterService();

  it('suggests GENERATE_TODAY_PLAN when the assistant mentions plan', () => {
    const out = svc.suggest({
      assistantText: 'Bạn nên lập kế hoạch hôm nay rồi bắt đầu việc gấp.',
      ctx: baseCtx(),
      userText: 'hôm nay tôi nên làm gì?',
    });
    expect(out.some((a) => a.type === 'GENERATE_TODAY_PLAN')).toBe(true);
  });

  it('prefills SmartEntry EXPENSE when the user mentions an amount', () => {
    const out = svc.suggest({
      assistantText: 'Có thể bạn muốn ghi chi tiêu lại.',
      ctx: baseCtx(),
      userText: 'phở 60k',
    });
    const entry = out.find((a) => a.type === 'OPEN_SMART_ENTRY');
    expect(entry).toBeDefined();
    expect((entry as { mode: string }).mode).toBe('EXPENSE');
  });

  it('falls back to OPEN_SCREEN(Today) when no signals match', () => {
    const out = svc.suggest({
      assistantText: 'Hi.',
      ctx: baseCtx(),
      userText: 'chào',
    });
    expect(out).toHaveLength(1);
    expect(out[0].type).toBe('OPEN_SCREEN');
  });

  it('caps suggestions to 3', () => {
    const out = svc.suggest({
      assistantText: 'Lập kế hoạch hôm nay. Ghi chi tiêu. Việc cần làm. Gợi ý',
      ctx: baseCtx(),
      userText: 'phở 60k với việc cần',
    });
    expect(out.length).toBeLessThanOrEqual(3);
  });
});
