import { z } from 'zod';

/**
 * Domain event taxonomy — every action the platform records flows through
 * one of these names. Stored long-term; renaming is a breaking change.
 *
 * Format: <domain>.<noun>.<verb-past>. Domains kept flat (no nested dots)
 * so analytics filters stay simple.
 */
export const EVENT_NAMES = [
  // capture
  'capture.text.created',
  'capture.voice.created',
  'capture.photo.created',
  'capture.classified',
  'capture.confirmed',
  'capture.corrected',
  'capture.deleted',

  // assistant
  'assistant.message.sent',
  'assistant.message.received',
  'assistant.tool.called',
  'assistant.feedback.given',

  // intelligence
  'insight.generated',
  'insight.viewed',
  'insight.helpful',
  'insight.dismissed',
  'forecast.generated',
  'nudge.sent',
  'nudge.acted',
  'nudge.snoozed',
  'nudge.suppressed',

  // health
  'health.synced',
  'health.permission.granted',
  'health.permission.denied',

  // privacy
  'privacy.tier.changed',
  'privacy.export.requested',
  'privacy.account.deleted',

  // billing
  'billing.checkout.started',
  'billing.subscribed',
  'billing.cancelled',
  'billing.byok.added',
  'billing.byok.removed',
] as const;

export const EventNameSchema = z.enum(EVENT_NAMES);
export type EventName = z.infer<typeof EventNameSchema>;

export const isEventName = (s: unknown): s is EventName =>
  typeof s === 'string' && (EVENT_NAMES as readonly string[]).includes(s);
