import type { AiFeature, AiUsagePlan } from '@prisma/client';

/**
 * Map between an AI feature and the quota field it counts against. Keeps the
 * limit name in one place so adding a feature only touches: (1) the enum,
 * (2) this map, (3) the DB default in schema.
 */
export const FEATURE_TO_QUOTA: Record<
  AiFeature,
  | 'dailyChatLimit'
  | 'dailyScheduleLimit'
  | 'dailyFinanceAnalysisLimit'
  | 'dailyMealSuggestionLimit'
  | 'dailyAssistantMonitoringLimit'
  | 'dailyReportLimit'
> = {
  CHAT: 'dailyChatLimit',
  GENERATE_SCHEDULE: 'dailyScheduleLimit',
  RESCHEDULE: 'dailyScheduleLimit',
  SUGGEST_MEALS: 'dailyMealSuggestionLimit',
  ANALYZE_FINANCE: 'dailyFinanceAnalysisLimit',
  DAILY_REVIEW: 'dailyReportLimit',
  WEEKLY_INSIGHT: 'dailyReportLimit',
  ASSISTANT_MONITOR: 'dailyAssistantMonitoringLimit',
  QUICK_CAPTURE: 'dailyChatLimit',
  HEALTH_SCREEN: 'dailyChatLimit',
};

/** Plans that should never be quota-blocked. */
export const ADMIN_BYPASS_PLANS: AiUsagePlan[] = ['ADMIN'];
