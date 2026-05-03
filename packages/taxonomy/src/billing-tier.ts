import { z } from 'zod';

export const BILLING_TIERS = ['FREE', 'PLUS', 'PRO', 'LIFETIME'] as const;
export const BillingTierSchema = z.enum(BILLING_TIERS);
export type BillingTier = z.infer<typeof BillingTierSchema>;

/**
 * Entitlements per tier. Server is authoritative — clients receive a copy
 * of their effective entitlement bag and gate UI accordingly.
 *
 * History limit `null` = unlimited. AI quota counts assistant + classifier
 * cloud calls combined; on-device classification is never metered.
 */
export interface Entitlements {
  historyDays: number | null;
  aiQueriesPerMonth: number | null;
  maxDevices: number;
  voiceUnlimited: boolean;
  photoUnderstanding: boolean;
  weeklyReview: boolean;
  widgetsLiveActivity: boolean;
  forecastingAdvanced: boolean;
  byokAllowed: boolean;
  onDeviceLlmAllowed: boolean;
  bankCalendarSync: boolean;
  familySharingSeats: number;
  prioritySupport: boolean;
  apiAccess: boolean;
}

export const ENTITLEMENTS: Record<BillingTier, Entitlements> = {
  FREE: {
    historyDays: 30,
    aiQueriesPerMonth: 50,
    maxDevices: 1,
    voiceUnlimited: false,
    photoUnderstanding: false,
    weeklyReview: false,
    widgetsLiveActivity: false,
    forecastingAdvanced: false,
    byokAllowed: false,
    onDeviceLlmAllowed: false,
    bankCalendarSync: false,
    familySharingSeats: 0,
    prioritySupport: false,
    apiAccess: false,
  },
  PLUS: {
    historyDays: null,
    aiQueriesPerMonth: null,
    maxDevices: 3,
    voiceUnlimited: true,
    photoUnderstanding: true,
    weeklyReview: true,
    widgetsLiveActivity: true,
    forecastingAdvanced: true,
    byokAllowed: false,
    onDeviceLlmAllowed: false,
    bankCalendarSync: false,
    familySharingSeats: 0,
    prioritySupport: false,
    apiAccess: false,
  },
  PRO: {
    historyDays: null,
    aiQueriesPerMonth: null,
    maxDevices: 5,
    voiceUnlimited: true,
    photoUnderstanding: true,
    weeklyReview: true,
    widgetsLiveActivity: true,
    forecastingAdvanced: true,
    byokAllowed: true,
    onDeviceLlmAllowed: true,
    bankCalendarSync: true,
    familySharingSeats: 5,
    prioritySupport: true,
    apiAccess: true,
  },
  LIFETIME: {
    historyDays: null,
    aiQueriesPerMonth: null,
    maxDevices: 5,
    voiceUnlimited: true,
    photoUnderstanding: true,
    weeklyReview: true,
    widgetsLiveActivity: true,
    forecastingAdvanced: true,
    byokAllowed: true,
    onDeviceLlmAllowed: true,
    bankCalendarSync: true,
    familySharingSeats: 5,
    prioritySupport: true,
    apiAccess: true,
  },
};

/** VND prices, in dong. Used for client display; Stripe is source of truth for charging. */
export const TIER_PRICING_VND: Record<BillingTier, { monthly: number | null; yearly: number | null; oneTime: number | null }> = {
  FREE: { monthly: 0, yearly: 0, oneTime: null },
  PLUS: { monthly: 79_000, yearly: 790_000, oneTime: null },
  PRO: { monthly: 199_000, yearly: 1_990_000, oneTime: null },
  LIFETIME: { monthly: null, yearly: null, oneTime: 2_990_000 },
};
