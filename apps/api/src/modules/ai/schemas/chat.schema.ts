import { z } from 'zod';

export const ChatReplySchema = z.object({
  answer: z.string().min(1).max(4000),
  suggestedActions: z
    .array(
      z.object({
        type: z.string().min(1).max(80),
        title: z.string().min(1).max(200),
        startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).optional(),
        endTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).optional(),
        payload: z.record(z.unknown()).optional(),
      }),
    )
    .max(10),
});
export type ChatReply = z.infer<typeof ChatReplySchema>;
