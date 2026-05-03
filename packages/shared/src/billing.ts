import { z } from 'zod';
import { BillingTierSchema, type BillingTier, type Entitlements } from '@lifeos/taxonomy';

export const SubscriptionStatusSchema = z.enum([
  'NONE',
  'TRIAL',
  'ACTIVE',
  'GRACE',
  'EXPIRED',
  'CANCELLED',
]);
export type SubscriptionStatus = z.infer<typeof SubscriptionStatusSchema>;

export const SubscriptionPublicSchema = z.object({
  tier: BillingTierSchema,
  status: SubscriptionStatusSchema,
  /** ISO 8601, when the current paid period ends. Null for FREE / LIFETIME. */
  currentPeriodEnd: z.string().nullable(),
  /** True if the user has opted into auto-renewal. */
  autoRenew: z.boolean(),
  /** Source of truth for billing — appstore | playstore | stripe | promo | lifetime. */
  provider: z.enum(['appstore', 'playstore', 'stripe', 'promo', 'lifetime', 'none']),
  /** ISO 8601 of when LIFETIME was purchased, if applicable. */
  lifetimePurchasedAt: z.string().nullable(),
});
export type SubscriptionPublic = z.infer<typeof SubscriptionPublicSchema>;

export const EntitlementsBagSchema: z.ZodType<Entitlements> = z.object({
  historyDays: z.number().int().nullable(),
  aiQueriesPerMonth: z.number().int().nullable(),
  maxDevices: z.number().int(),
  voiceUnlimited: z.boolean(),
  photoUnderstanding: z.boolean(),
  weeklyReview: z.boolean(),
  widgetsLiveActivity: z.boolean(),
  forecastingAdvanced: z.boolean(),
  byokAllowed: z.boolean(),
  onDeviceLlmAllowed: z.boolean(),
  bankCalendarSync: z.boolean(),
  familySharingSeats: z.number().int(),
  prioritySupport: z.boolean(),
  apiAccess: z.boolean(),
});

export const SubscriptionResponseSchema = z.object({
  subscription: SubscriptionPublicSchema,
  entitlements: EntitlementsBagSchema,
});
export type SubscriptionResponse = z.infer<typeof SubscriptionResponseSchema>;

export type { BillingTier };
