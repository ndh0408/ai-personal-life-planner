import { z } from 'zod';
import { registry, type PromptDefinition } from '../registry';

/**
 * Classify a free-form capture into one of the canonical kinds + extract
 * salient fields. On-device DistilBERT handles type alone; this prompt is
 * the cloud enrichment path that adds NER + structured fields.
 */

const Input = z.object({
  text: z.string().min(1).max(2000),
  /** ISO 8601, user's local. Lets the model resolve "tomorrow" / "tối nay". */
  capturedAtLocal: z.string(),
  locale: z.enum(['vi', 'en']).default('vi'),
});

const Output = z.object({
  kind: z.enum([
    'EXPENSE',
    'INCOME',
    'TASK',
    'EVENT',
    'NOTE',
    'MOOD',
    'MEAL',
    'SLEEP',
    'IDEA',
    'UNKNOWN',
  ]),
  confidence: z.number().min(0).max(1),
  fields: z
    .object({
      title: z.string().optional(),
      amountVnd: z.number().int().optional(),
      currency: z.string().optional(),
      due: z.string().optional(),
      eventStart: z.string().optional(),
      eventEnd: z.string().optional(),
      moodScore: z.number().int().min(1).max(5).optional(),
      mealItems: z.array(z.string()).optional(),
      sleepHours: z.number().optional(),
      tags: z.array(z.string()).optional(),
    })
    .strict(),
  reasoning: z.string().max(280),
});

export const captureClassifierV1: PromptDefinition<z.infer<typeof Input>, typeof Output> = {
  id: 'capture-classifier',
  version: '1.0.0',
  inputSchema: Input,
  outputSchema: Output,
  defaultModel: 'gpt-4o-mini',
  temperature: 0.1,
  render: (input) => ({
    system: [
      'You are LifeOS Capture Classifier. Read a single user capture and return strict JSON.',
      'Rules:',
      '- Pick exactly one kind. UNKNOWN only if truly ambiguous.',
      '- Confidence reflects shape clarity, not your epistemic certainty.',
      '- Extract only fields the user actually stated; never guess amounts or dates.',
      '- Resolve relative time using capturedAtLocal as anchor (Asia/Ho_Chi_Minh assumed if no tz).',
      '- Reasoning ≤ 240 chars, plain language, no chain-of-thought.',
      '- Vietnamese input is common; respond with VN-friendly tags but JSON keys stay English.',
    ].join('\n'),
    user: JSON.stringify(input),
  }),
};

registry.register(captureClassifierV1);
