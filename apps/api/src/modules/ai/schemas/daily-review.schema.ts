import { z } from 'zod';

export const DailyReviewSchema = z.object({
  todaySummary: z.string().min(1).max(4000),
  wins: z.array(z.string().min(1).max(300)).max(10),
  issues: z.array(z.string().min(1).max(300)).max(10),
  suggestionsForTomorrow: z.array(z.string().min(1).max(300)).max(10),
  healthAdvice: z.string().max(1000),
  financeAdvice: z.string().max(1000),
  productivityAdvice: z.string().max(1000),
});
export type DailyReviewOutput = z.infer<typeof DailyReviewSchema>;
