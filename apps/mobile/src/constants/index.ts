export const APP_NAME = 'LifeOS AI';

export const STORAGE_KEYS = {
  ACCESS_TOKEN: 'lifeos.accessToken',
  REFRESH_TOKEN: 'lifeos.refreshToken',
  ONBOARDING_DONE: 'lifeos.onboardingDone',
  LOCALE: 'lifeos.locale',
} as const;

export const QUERY_KEYS = {
  me: ['me'] as const,
  profile: ['profile'] as const,
  tasks: (params?: Record<string, unknown>) => ['tasks', params] as const,
  task: (id: string) => ['tasks', id] as const,
  schedule: (date: string) => ['schedules', date] as const,
  habits: ['habits'] as const,
  habitLogs: (params?: Record<string, unknown>) => ['habit-logs', params] as const,
  meals: (date: string) => ['meals', date] as const,
  sleepLogs: (params?: Record<string, unknown>) => ['sleep-logs', params] as const,
  moodLogs: (params?: Record<string, unknown>) => ['mood-logs', params] as const,
  aiProviders: ['user-ai-providers'] as const,
  aiProvider: (id: string) => ['user-ai-providers', id] as const,
  aiPreference: ['user-ai-preferences'] as const,
};
