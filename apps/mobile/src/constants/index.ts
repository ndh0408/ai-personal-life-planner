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
  privacySettings: ['privacy', 'settings'] as const,
  privacyConsents: ['privacy', 'consents'] as const,
  dataUsageSummary: ['privacy', 'data-usage-summary'] as const,
  communicationSettings: ['communication', 'settings'] as const,
  connectedAccounts: ['communication', 'connected-accounts'] as const,
  emails: (params?: Record<string, unknown>) => ['communication', 'emails', params] as const,
  emailReminders: ['communication', 'email-reminders'] as const,
  messageReminders: ['communication', 'message-reminders'] as const,
  companionMemory: ['communication', 'ai-memory'] as const,
  memoryConsent: ['communication', 'ai-memory', 'consent'] as const,
  smartCheckinSettings: ['voice', 'smart-checkins'] as const,
  healthIntegration: ['voice', 'health-integration'] as const,
  pendingActions: ['voice', 'pending-actions'] as const,
};
