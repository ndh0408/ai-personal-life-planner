import { ProactiveNudgeService } from './proactive-nudge.service';
import { DailyMonitoringService } from './daily-monitoring.service';
import { LifeInsightService } from './life-insight.service';
import { RecommendationService } from './recommendation.service';
import type { LocaleService } from '../../../common/i18n/locale.service';
import type { Signal } from './types';

function mockLocale(tag: 'vi' | 'en' = 'vi'): LocaleService {
  return {
    forUser: jest.fn(() => Promise.resolve(tag)),
    fromRequest: jest.fn(() => tag),
    get default() {
      return tag;
    },
  } as unknown as LocaleService;
}

function mockMonitoring(signals: Signal[]): DailyMonitoringService {
  return { collect: jest.fn(() => Promise.resolve(signals)) } as unknown as DailyMonitoringService;
}

function mockInsights(): LifeInsightService {
  return {
    score: jest.fn(() =>
      Promise.resolve({
        scheduleCompletionRate: 80,
        taskCompletionRate: 70,
        habitConsistencyRate: 65,
        sleepConsistencyScore: null,
        workloadBalanceScore: 100,
        mealConsistencyScore: null,
        budgetHealthScore: 90,
        savingProgressScore: 40,
        goalProgressScore: 50,
        energyTrend: 'FLAT',
        stressTrend: 'FLAT',
      }),
    ),
  } as unknown as LifeInsightService;
}

function mockRecommendations(): RecommendationService {
  let seq = 0;
  return {
    createFromSignal: jest.fn(async (userId: string, signal: Signal) => ({
      id: `r-${++seq}`,
      created: true,
      type: 'SLEEP',
      priority: signal.severity,
      title: `T:${signal.code}`,
      content: `C:${signal.code}`,
      createdAt: new Date(),
    })),
    list: jest.fn(() => Promise.resolve([])),
  } as unknown as RecommendationService;
}

function mockPrisma(
  opts: {
    assistantNudge?: boolean;
    quietHours?: { start: Date; end: Date } | null;
  } = {},
) {
  const settings =
    opts.assistantNudge === undefined
      ? null
      : {
          assistantNudge: opts.assistantNudge,
          quietHoursStart: opts.quietHours?.start ?? null,
          quietHoursEnd: opts.quietHours?.end ?? null,
        };
  const logs: Array<Record<string, unknown>> = [];
  return {
    api: {
      notificationSetting: { findUnique: jest.fn(() => Promise.resolve(settings)) },
      notificationLog: { create: jest.fn((args: { data: Record<string, unknown> }) => {
        logs.push(args.data);
        return Promise.resolve({ id: `log-${logs.length}`, ...args.data });
      }) },
    },
    logs,
  };
}

const HIGH_SIGNAL: Signal = {
  code: 'UNDER_SLEPT_3D',
  severity: 'HIGH',
  payload: { avgMinutes: 300, samples: 4 },
};
const LOW_SIGNAL: Signal = {
  code: 'MEAL_PLAN_MISSING',
  severity: 'LOW',
  payload: { date: '2026-04-24' },
};

describe('ProactiveNudgeService.runDaily', () => {
  it('queues a notification for HIGH signals when assistantNudge=true', async () => {
    const { api, logs } = mockPrisma({ assistantNudge: true, quietHours: null });
    const svc = new ProactiveNudgeService(
      api as never,
      mockMonitoring([HIGH_SIGNAL, LOW_SIGNAL]),
      mockRecommendations(),
      mockInsights(),
      mockLocale('vi'),
    );
    const result = await svc.runDaily('u1', '2026-04-24');
    expect(result.recommendations).toHaveLength(2);

    const high = result.recommendations.find((r) => r.signalCode === 'UNDER_SLEPT_3D')!;
    const low = result.recommendations.find((r) => r.signalCode === 'MEAL_PLAN_MISSING')!;
    expect(high.notificationQueued).toBe(true);
    expect(low.notificationQueued).toBe(false); // LOW doesn't trigger push
    expect(logs).toHaveLength(1);
    expect(logs[0].type).toBe('assistant:UNDER_SLEPT_3D');
    expect(logs[0].status).toBe('PENDING');
  });

  it('does NOT queue when assistantNudge=false', async () => {
    const { api, logs } = mockPrisma({ assistantNudge: false });
    const svc = new ProactiveNudgeService(
      api as never,
      mockMonitoring([HIGH_SIGNAL]),
      mockRecommendations(),
      mockInsights(),
      mockLocale('vi'),
    );
    const result = await svc.runDaily('u1', '2026-04-24');
    expect(result.recommendations[0].notificationQueued).toBe(false);
    expect(logs).toHaveLength(0);
  });

  it('during quiet hours: defers delivery to post-quiet time', async () => {
    // UTC 00:00 right now during test — make quiet hours wrap-around current time
    const start = new Date('1970-01-01T00:00:00Z');
    start.setUTCHours(new Date().getUTCHours(), 0, 0, 0);
    const end = new Date(start.getTime() + 2 * 60 * 60 * 1000); // +2h
    const { api, logs } = mockPrisma({
      assistantNudge: true,
      quietHours: { start, end },
    });
    const svc = new ProactiveNudgeService(
      api as never,
      mockMonitoring([HIGH_SIGNAL]),
      mockRecommendations(),
      mockInsights(),
      mockLocale('vi'),
    );
    const result = await svc.runDaily('u1', '2026-04-24');
    expect(result.recommendations[0].notificationQueued).toBe(true);
    expect(logs).toHaveLength(1);
    const scheduledAt = logs[0].scheduledAt as Date;
    // Scheduled for the minute after quiet ends, which is > now.
    expect(scheduledAt.getTime()).toBeGreaterThan(Date.now());
  });

  it('returns scores alongside recommendations', async () => {
    const { api } = mockPrisma({ assistantNudge: false });
    const svc = new ProactiveNudgeService(
      api as never,
      mockMonitoring([]),
      mockRecommendations(),
      mockInsights(),
      mockLocale('vi'),
    );
    const result = await svc.runDaily('u1', '2026-04-24');
    expect(result.scores.scheduleCompletionRate).toBe(80);
    expect(result.scores.energyTrend).toBe('FLAT');
    expect(result.recommendations).toHaveLength(0);
  });
});
