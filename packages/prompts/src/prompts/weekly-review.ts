import { z } from 'zod';
import { registry, type PromptDefinition } from '../registry';

/**
 * Weekly Life Review — runs Sunday 21:00 user-local. Produces a conversational
 * scrollable review (3-5 sections) grounded in the week's captures + metrics.
 */

const WeekDigest = z.object({
  weekStart: z.string(),
  weekEnd: z.string(),
  captureCount: z.number().int(),
  topCategories: z.array(z.object({ kind: z.string(), n: z.number().int() })),
  spendingVnd: z.number().int(),
  spendingDeltaPct: z.number(),
  sleepAvgHours: z.number().nullable(),
  sleepBaselineHours: z.number().nullable(),
  moodAvg: z.number().nullable(),
  completedTasks: z.number().int(),
  missedTasks: z.number().int(),
  notableEvents: z.array(z.string()).max(10),
});

const Output = z.object({
  headline: z.string().max(120),
  sections: z
    .array(
      z.object({
        title: z.string().max(80),
        body: z.string().max(800),
        tone: z.enum(['neutral', 'celebrate', 'concern', 'invite']),
      }),
    )
    .min(3)
    .max(5),
  forwardPrompt: z.string().max(200),
});

export const weeklyReviewV1: PromptDefinition<z.infer<typeof WeekDigest>, typeof Output> = {
  id: 'weekly-review',
  version: '1.0.0',
  inputSchema: WeekDigest,
  outputSchema: Output,
  defaultModel: 'gpt-4o',
  temperature: 0.5,
  render: (input) => ({
    system: [
      'You write a weekly life review. Tone: a thoughtful friend who keeps notes — not a coach.',
      'Structure: 1 headline, 3-5 sections, 1 forward prompt for next week.',
      'Sections cover: rhythm (sleep/energy), money, attention (tasks/missed), highlights.',
      'Rules:',
      '- Anchor every claim in numbers from the digest.',
      '- Skip a section rather than fluff one.',
      '- "concern" tone is allowed but max 1 per review — calm, not alarming.',
      '- forwardPrompt is a single open question for the user, not advice.',
    ].join('\n'),
    user: JSON.stringify(input),
  }),
};

registry.register(weeklyReviewV1);
