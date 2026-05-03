import { z } from 'zod';
import { PrivacyTierSchema, type PrivacyTier } from '@lifeos/taxonomy';

/**
 * User-level privacy tier choice. Distinct from `privacy.ts` (per-feature
 * AI inclusion flags). Tier is the *macro* policy; flags are the *micro*
 * controls inside the cloud / hybrid tiers. LOCAL forces all flags off.
 */
export const PrivacyTierSettingSchema = z.object({
  tier: PrivacyTierSchema,
  /**
   * For HYBRID/CLOUD: passcode-derived E2EE key fingerprint. The server
   * stores only the fingerprint; the actual key never leaves the device.
   * `null` until the user sets a passcode.
   */
  e2eeKeyFingerprint: z.string().nullable(),
  /** Whether the on-device LLM bundle (Phi-3.5-mini) has been downloaded. */
  onDeviceLlmReady: z.boolean(),
  updatedAt: z.string(),
});
export type PrivacyTierSetting = z.infer<typeof PrivacyTierSettingSchema>;

export const SetPrivacyTierRequestSchema = z
  .object({
    tier: PrivacyTierSchema,
    e2eeKeyFingerprint: z.string().nullable().optional(),
  })
  .strict();
export type SetPrivacyTierRequest = z.infer<typeof SetPrivacyTierRequestSchema>;

export type { PrivacyTier };
