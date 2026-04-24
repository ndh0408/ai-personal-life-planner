import { api } from './client';

export type HealthMetric = {
  id: string;
  date: string;
  weightKg: number | null;
  waterIntakeMl: number | null;
  steps: number | null;
  exerciseMinutes: number | null;
  note: string | null;
};

export type CreateHealthMetricInput = {
  date: string;
  weightKg?: number;
  waterIntakeMl?: number;
  steps?: number;
  exerciseMinutes?: number;
  note?: string;
};

export const healthMetricsApi = {
  list: (params?: { from?: string; to?: string }) => {
    const qs = params
      ? Object.entries(params)
          .filter(([, v]) => v)
          .map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`)
          .join('&')
      : '';
    return api.get<HealthMetric[]>(`/health-metrics${qs ? `?${qs}` : ''}`);
  },
  create: (body: CreateHealthMetricInput) => api.post<HealthMetric>('/health-metrics', body),
  update: (id: string, body: Partial<CreateHealthMetricInput>) =>
    api.put<HealthMetric>(`/health-metrics/${id}`, body),
  remove: (id: string) => api.delete(`/health-metrics/${id}`),
};

export type MealLog = {
  id: string;
  date: string;
  mealType: 'BREAKFAST' | 'LUNCH' | 'DINNER' | 'SNACK';
  title: string;
  note: string | null;
  estimatedCalories: number | null;
  cost: string | null;
};

export const mealLogsApi = {
  list: (params?: { from?: string; to?: string }) => {
    const qs = params
      ? Object.entries(params)
          .filter(([, v]) => v)
          .map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`)
          .join('&')
      : '';
    return api.get<MealLog[]>(`/meal-logs${qs ? `?${qs}` : ''}`);
  },
  create: (body: {
    date: string;
    mealType: MealLog['mealType'];
    title: string;
    note?: string;
    estimatedCalories?: number;
    cost?: number;
  }) => api.post<MealLog>('/meal-logs', body),
  remove: (id: string) => api.delete(`/meal-logs/${id}`),
};
