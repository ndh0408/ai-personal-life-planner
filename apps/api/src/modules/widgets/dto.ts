import type { WidgetPreferences } from '@prisma/client';
import type { WidgetPreferencesDto } from '@planner/shared';

export function toWidgetPreferencesDto(row: WidgetPreferences): WidgetPreferencesDto {
  return {
    enabled: row.enabled,
    showTasks: row.showTasks,
    showRecommendations: row.showRecommendations,
    showHealthData: row.showHealthData,
    showFinance: row.showFinance,
    showFinanceAmounts: row.showFinanceAmounts,
    privacyMode: row.privacyMode,
    updatedAt: row.updatedAt.toISOString(),
  };
}
