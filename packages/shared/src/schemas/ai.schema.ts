import { z } from 'zod';

export const AiChatMessageSchema = z.object({
  role: z.enum(['user', 'assistant', 'system']),
  content: z.string().min(1).max(8000),
});
export type AiChatMessage = z.infer<typeof AiChatMessageSchema>;

export const AiChatRequestSchema = z.object({
  messages: z.array(AiChatMessageSchema).min(1).max(50),
  context: z.record(z.unknown()).optional(),
});
export type AiChatRequest = z.infer<typeof AiChatRequestSchema>;

export const PlanDayRequestSchema = z.object({
  date: z.string().date(),
  energyLevel: z.number().int().min(1).max(10).optional(),
  mood: z.enum(['great', 'good', 'okay', 'low', 'bad']).optional(),
  notes: z.string().max(1000).optional(),
});
export type PlanDayRequest = z.infer<typeof PlanDayRequestSchema>;
