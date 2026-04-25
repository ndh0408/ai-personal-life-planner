// Centralised queue + job names. Kept stringly-typed so a typo on the
// publisher side never slips past the worker — every name appears in a
// const-as-const map and is exported as a literal type.

export const QUEUE_NAMES = {
  notification: 'notification-queue',
  ai: 'ai-queue',
  report: 'report-queue',
  assistantMonitoring: 'assistant-monitoring-queue',
  financeSnapshot: 'finance-snapshot-queue',
} as const;

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];

export const NOTIFICATION_JOBS = {
  send: 'send-notification',
} as const;

export const AI_JOBS = {
  generate: 'ai-generate',
  rebuildContext: 'ai-rebuild-context',
} as const;

export const REPORT_JOBS = {
  precomputeDaily: 'precompute-daily-report',
  precomputeWeekly: 'precompute-weekly-report',
} as const;

export const ASSISTANT_JOBS = {
  proactiveSweep: 'assistant-proactive-sweep',
  monitor: 'assistant-monitor',
} as const;

export const FINANCE_SNAPSHOT_JOBS = {
  daily: 'finance-snapshot-daily',
} as const;

export const REDIS_KEY_PREFIX = 'lifeos:';
