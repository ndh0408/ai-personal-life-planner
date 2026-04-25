import { api } from './client';
import type {
  UpdateWidgetPreferencesInput,
  WidgetPreferencesDto,
  WidgetSummaryDto,
} from '@planner/shared';

export const widgetsApi = {
  summary: () => api.get<WidgetSummaryDto>('/widgets/summary'),
  getPreferences: () => api.get<WidgetPreferencesDto>('/widgets/preferences'),
  updatePreferences: (input: UpdateWidgetPreferencesInput) =>
    api.put<WidgetPreferencesDto>('/widgets/preferences', input),
};
