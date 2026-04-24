import { z } from 'zod';

export const ReschedulePreviewSchema = z.object({
  summary: z.string().min(1).max(2000),
  kept: z
    .array(z.object({ id: z.string().min(1), reason: z.string().max(500) }))
    .max(40),
  shortened: z
    .array(
      z.object({
        id: z.string().min(1),
        minutesRemoved: z.number().int().min(0).max(8 * 60),
        reason: z.string().max(500),
      }),
    )
    .max(40),
  removed: z
    .array(z.object({ id: z.string().min(1), reason: z.string().max(500) }))
    .max(40),
  warnings: z.array(z.string().max(500)).max(20),
});
export type ReschedulePreview = z.infer<typeof ReschedulePreviewSchema>;
