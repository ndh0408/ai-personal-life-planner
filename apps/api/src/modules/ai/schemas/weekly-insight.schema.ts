import { z } from 'zod';

export const WeeklyInsightSchema = z.object({
  summary: z.string().min(1).max(3000),
  goodPoints: z.array(z.string().max(500)).max(20),
  improvementPoints: z.array(z.string().max(500)).max(20),
  nextWeekSuggestions: z.array(z.string().max(500)).max(20),
});
export type WeeklyInsight = z.infer<typeof WeeklyInsightSchema>;
