import { z } from 'zod';

/**
 * Privacy preferences. Each flag controls what feature data is allowed into
 * the LifeSnapshot the AI features read from. Disabling a flag does **not**
 * delete data — it just stops it from being included in AI context.
 */
export const PrivacySettingPublicSchema = z.object({
  personalizationEnabled: z.boolean(),
  useFinanceForAI: z.boolean(),
  useHealthForAI: z.boolean(),
  useMealsForAI: z.boolean(),
  useTasksForAI: z.boolean(),
  aiMemoryEnabled: z.boolean(),
  proactiveRecommendations: z.boolean(),
  updatedAt: z.string(),
});
export type PrivacySettingPublic = z.infer<typeof PrivacySettingPublicSchema>;

export const UpdatePrivacyRequestSchema = z
  .object({
    personalizationEnabled: z.boolean().optional(),
    useFinanceForAI: z.boolean().optional(),
    useHealthForAI: z.boolean().optional(),
    useMealsForAI: z.boolean().optional(),
    useTasksForAI: z.boolean().optional(),
    aiMemoryEnabled: z.boolean().optional(),
    proactiveRecommendations: z.boolean().optional(),
  })
  .strict();
export type UpdatePrivacyRequest = z.infer<typeof UpdatePrivacyRequestSchema>;
