import { z } from 'zod';

/**
 * Canonical capture kinds. Order matters: classifier confidence ties break
 * by index (earlier = preferred when tied).
 */
export const CAPTURE_KINDS = [
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
] as const;

export const CaptureKindSchema = z.enum(CAPTURE_KINDS);
export type CaptureKind = z.infer<typeof CaptureKindSchema>;

/**
 * Display metadata. Mobile reads this for KindBadge label / icon names.
 * Hex values intentionally omitted — colors live in @lifeos/design-tokens.
 */
export const CAPTURE_KIND_META: Record<
  CaptureKind,
  { labelVi: string; labelEn: string; iconName: string }
> = {
  EXPENSE: { labelVi: 'Chi tiêu', labelEn: 'Expense', iconName: 'arrow-down-circle' },
  INCOME: { labelVi: 'Thu nhập', labelEn: 'Income', iconName: 'arrow-up-circle' },
  TASK: { labelVi: 'Việc', labelEn: 'Task', iconName: 'check-circle' },
  EVENT: { labelVi: 'Sự kiện', labelEn: 'Event', iconName: 'calendar' },
  NOTE: { labelVi: 'Ghi chú', labelEn: 'Note', iconName: 'file-text' },
  MOOD: { labelVi: 'Tâm trạng', labelEn: 'Mood', iconName: 'heart' },
  MEAL: { labelVi: 'Bữa ăn', labelEn: 'Meal', iconName: 'coffee' },
  SLEEP: { labelVi: 'Giấc ngủ', labelEn: 'Sleep', iconName: 'moon' },
  IDEA: { labelVi: 'Ý tưởng', labelEn: 'Idea', iconName: 'zap' },
  UNKNOWN: { labelVi: 'Khác', labelEn: 'Other', iconName: 'circle' },
};
