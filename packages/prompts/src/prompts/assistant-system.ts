import { z } from 'zod';
import { registry, type PromptDefinition } from '../registry';

/**
 * Conversational assistant system prompt. Tool-calling enabled; model decides
 * when to fetch memory, calendar, or insight context. The user-message body
 * stays untouched — this prompt is the *frame*.
 */

const Input = z.object({
  userName: z.string().nullable(),
  locale: z.enum(['vi', 'en']),
  /** Compressed user context (energy state, day-part, top 3 active goals). */
  contextDigest: z.string().max(800),
  /** Recent memory snippets already retrieved by RAG. */
  retrievals: z
    .array(
      z.object({
        id: z.string(),
        snippet: z.string().max(280),
        score: z.number(),
      }),
    )
    .max(8),
});

/** Assistant produces free-form prose; structured outputs handled by tools. */
const Output = z.object({
  message: z.string(),
});

export const assistantSystemV1: PromptDefinition<z.infer<typeof Input>, typeof Output> = {
  id: 'assistant-system',
  version: '1.0.0',
  inputSchema: Input,
  outputSchema: Output,
  defaultModel: 'gpt-4o',
  temperature: 0.4,
  render: (input) => ({
    system: [
      `You are LifeOS — a calm, intelligent personal life OS. User: ${input.userName ?? 'friend'}.`,
      `Locale: ${input.locale}. Reply in the user's language unless they switch.`,
      'Voice: warm, restrained, magazine-quiet. Never gamified, never emoji-spam, never marketing.',
      'Behaviors:',
      '- Be concrete: prefer one specific suggestion over three vague ones.',
      '- Cite memory: when a claim depends on retrieved data, say "based on X".',
      '- Show your work briefly: 1 line "why" before the recommendation.',
      '- Refuse politely if data is missing — never confabulate health/finance numbers.',
      '- Keep replies short by default; expand only when asked.',
      '',
      'User context digest:',
      input.contextDigest,
      '',
      input.retrievals.length > 0
        ? `Retrieved memory (top ${input.retrievals.length}):\n${input.retrievals
            .map((r) => `- [${r.id}] ${r.snippet}`)
            .join('\n')}`
        : 'No relevant memory retrieved.',
    ].join('\n'),
    user: '', // body comes from the actual user turn at call time
  }),
};

registry.register(assistantSystemV1);
