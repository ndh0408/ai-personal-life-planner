import { z } from 'zod';

export const CaptureKindSchema = z.enum([
  'EXPENSE',
  'INCOME',
  'MEAL',
  'TASK',
  'SLEEP',
  'MOOD',
  'UNKNOWN',
]);
export type CaptureKind = z.infer<typeof CaptureKindSchema>;

export const ParserSourceSchema = z.enum(['RULE', 'OPENAI']);
export type ParserSource = z.infer<typeof ParserSourceSchema>;

// ── Parse: input ──────────────────────────────────────────────────────────────

export const CaptureParseRequestSchema = z.object({
  text: z.string().min(1).max(2000),
  /** IANA timezone, e.g. "Asia/Ho_Chi_Minh". Used by date heuristics. */
  tz: z.string().min(1).max(64).default('Asia/Ho_Chi_Minh'),
  /**
   * "now" reference for relative dates ("hôm qua", "tối nay"). Optional;
   * the server uses Date.now() if omitted.
   */
  nowIso: z.string().datetime().optional(),
});
export type CaptureParseRequest = z.infer<typeof CaptureParseRequestSchema>;

// ── Parse: per-kind field shapes ──────────────────────────────────────────────

export const ExpenseFieldsSchema = z.object({
  title: z.string().min(1).max(200),
  amount: z.number().int().nonnegative(),
  currency: z.literal('VND').default('VND'),
  category: z.string().max(40).default('other'),
  expenseDateIso: z.string().datetime(),
});
export type ExpenseFields = z.infer<typeof ExpenseFieldsSchema>;

export const IncomeFieldsSchema = z.object({
  title: z.string().min(1).max(200),
  amount: z.number().int().nonnegative(),
  currency: z.literal('VND').default('VND'),
  category: z.string().max(40).default('other'),
  incomeDateIso: z.string().datetime(),
});
export type IncomeFields = z.infer<typeof IncomeFieldsSchema>;

export const MealFieldsSchema = z.object({
  title: z.string().min(1).max(200),
  mealType: z.enum(['BREAKFAST', 'LUNCH', 'DINNER', 'SNACK']),
  cost: z.number().int().nonnegative().nullable().optional(),
  loggedAtIso: z.string().datetime(),
});
export type MealFields = z.infer<typeof MealFieldsSchema>;

export const TaskFieldsSchema = z.object({
  title: z.string().min(1).max(200),
  dueAtIso: z.string().datetime().nullable().optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH']).default('MEDIUM'),
});
export type TaskFields = z.infer<typeof TaskFieldsSchema>;

export const SleepFieldsSchema = z.object({
  sleepAtIso: z.string().datetime(),
  wakeAtIso: z.string().datetime(),
  durationMinutes: z.number().int().min(15).max(20 * 60),
  quality: z.enum(['BAD', 'OK', 'GOOD']).nullable().optional(),
});
export type SleepFields = z.infer<typeof SleepFieldsSchema>;

export const MoodFieldsSchema = z.object({
  mood: z.enum(['GREAT', 'GOOD', 'OK', 'TIRED', 'STRESSED', 'SAD']),
  energy: z.enum(['LOW', 'MEDIUM', 'HIGH']).default('MEDIUM'),
  loggedAtIso: z.string().datetime(),
});
export type MoodFields = z.infer<typeof MoodFieldsSchema>;

// ── Parse: response (preview) ────────────────────────────────────────────────

export const CaptureParseResponseSchema = z.object({
  kind: CaptureKindSchema,
  source: ParserSourceSchema,
  confidence: z.number().min(0).max(1),
  /** Pre-formatted line for the preview chip, e.g. "🍚 Cơm tấm — 75.000 ₫ — 12:00". */
  previewText: z.string().max(200),
  /** Per-kind shape; UNKNOWN means an empty object plus a hint. */
  fields: z.record(z.string(), z.unknown()),
  hint: z.string().max(200).optional(),
});
export type CaptureParseResponse = z.infer<typeof CaptureParseResponseSchema>;

// ── Confirm: input ────────────────────────────────────────────────────────────

export const CaptureConfirmRequestSchema = z.object({
  kind: z.enum(['EXPENSE', 'INCOME', 'MEAL', 'TASK', 'SLEEP', 'MOOD']),
  fields: z.record(z.string(), z.unknown()),
  /** Idempotency key — same value insert returns the existing row, not a duplicate. */
  idempotencyKey: z.string().min(8).max(80).optional(),
  /**
   * The original user-typed text. When provided, the server writes a row to
   * the QuickCapture audit table with status=CONFIRMED + parsedActions=
   * { kind, fields }, so "what did the user actually say" is recoverable
   * for undo / activity log later.
   */
  rawText: z.string().min(1).max(2000).optional(),
});
export type CaptureConfirmRequest = z.infer<typeof CaptureConfirmRequestSchema>;

export const CaptureConfirmResponseSchema = z.object({
  kind: z.enum(['EXPENSE', 'INCOME', 'MEAL', 'TASK', 'SLEEP', 'MOOD']),
  id: z.string(),
  createdAt: z.string().datetime(),
});
export type CaptureConfirmResponse = z.infer<typeof CaptureConfirmResponseSchema>;

export const CAPTURE_ERROR_CODES = [
  'CAPTURE_AMBIGUOUS',
  'CAPTURE_FIELDS_INVALID',
  'CAPTURE_AI_KEY_MISSING',
] as const;
export type CaptureErrorCode = (typeof CAPTURE_ERROR_CODES)[number];
