import { z } from 'zod';

const DateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD required');
const TimeOfDay = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'HH:mm required');

export const EnergyEnum = z.enum(['LOW', 'MEDIUM', 'HIGH']);
export const MoodEnum = z.enum(['HAPPY', 'NORMAL', 'STRESSED', 'TIRED', 'SAD', 'MOTIVATED']);

// ---- chat (legacy) --------------------------------------------------------
export const AiChatMessageSchema = z.object({
  role: z.enum(['user', 'assistant', 'system']),
  content: z.string().min(1).max(8000),
});
export type AiChatMessage = z.infer<typeof AiChatMessageSchema>;

export const AiChatRequestSchema = z.object({
  conversationId: z.string().uuid().optional(),
  message: z.string().min(1).max(4000),
  contextType: z.string().min(1).max(80).optional(),
});
export type AiChatRequest = z.infer<typeof AiChatRequestSchema>;

// ---- generate-schedule -----------------------------------------------------
export const GenerateScheduleRequestSchema = z.object({
  date: DateOnly,
  energyLevel: EnergyEnum.optional(),
  mood: MoodEnum.optional(),
  extraNote: z.string().max(1000).optional(),
});
export type GenerateScheduleRequest = z.infer<typeof GenerateScheduleRequestSchema>;

// ---- reschedule ------------------------------------------------------------
export const RescheduleRequestSchema = z.object({
  date: DateOnly,
  currentTime: TimeOfDay,
  delayMinutes: z.number().int().min(1).max(8 * 60),
  mustKeepItemIds: z.array(z.string().uuid()).max(20).optional(),
  priorityNote: z.string().max(500).optional(),
});
export type RescheduleRequest = z.infer<typeof RescheduleRequestSchema>;

export const ApplyRescheduleRequestSchema = z.object({
  date: DateOnly,
  previewId: z.string().uuid(),
});
export type ApplyRescheduleRequest = z.infer<typeof ApplyRescheduleRequestSchema>;

// ---- meal suggestions ------------------------------------------------------
export const SuggestMealsRequestSchema = z.object({
  date: DateOnly,
  goal: z.string().max(200).optional(),
  budget: z.string().max(50).optional(),
  availableIngredients: z.array(z.string().min(1).max(100)).max(50).optional(),
  cookingTimeMinutes: z.number().int().min(1).max(720).optional(),
  save: z.boolean().optional().default(false),
});
export type SuggestMealsRequest = z.infer<typeof SuggestMealsRequestSchema>;

// ---- weekly insight --------------------------------------------------------
export const WeeklyInsightRequestSchema = z.object({
  weekStart: DateOnly,
});
export type WeeklyInsightRequest = z.infer<typeof WeeklyInsightRequestSchema>;

// ---- daily review ----------------------------------------------------------
export const DailyReviewRequestSchema = z.object({
  date: DateOnly,
});
export type DailyReviewRequest = z.infer<typeof DailyReviewRequestSchema>;

// ---- finance analysis ------------------------------------------------------
export const AnalyzeFinanceRequestSchema = z.object({
  month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'YYYY-MM required'),
});
export type AnalyzeFinanceRequest = z.infer<typeof AnalyzeFinanceRequestSchema>;

// ---- legacy day plan request (still exported for back-compat) -------------
export const PlanDayRequestSchema = GenerateScheduleRequestSchema;
export type PlanDayRequest = GenerateScheduleRequest;
