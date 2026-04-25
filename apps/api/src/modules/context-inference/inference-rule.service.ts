import { Injectable } from '@nestjs/common';
import type { ContextInferenceType } from '@prisma/client';
import type { CollectedSignals } from './context-signal.service';

export interface RuleResult {
  type: ContextInferenceType;
  confidence: number;
  evidence: { locale: 'vi' | 'en'; items: Array<{ key: string; summary: string }> };
  suggestedAction?: { type: string; [k: string]: unknown };
}

const COPY = {
  vi: {
    sleepDuration: (h: string) => `Bạn ngủ khoảng ${h} hôm qua.`,
    sleepNearUsual: (hhmm: string) => `Bạn thường ngủ lúc ${hhmm}.`,
    pendingLate: (n: number) => `Còn ${n} task chưa xong sau 21h.`,
    energyLow: 'Bạn báo năng lượng thấp hôm nay.',
    overdueTasks: (n: number) => `Đang có ${n} task quá hạn.`,
    mealOverdue: (meal: string, h: number) => `Đã qua giờ ${meal} ${h} tiếng và bạn chưa log.`,
    budgetUsage: (cat: string, p: number) => `Ngân sách "${cat}" đã dùng ${Math.round(p)}%.`,
    daysLeft: (d: number) => `Còn ${d} ngày trong tháng.`,
    habitMissed: (n: number) => `${n} thói quen chưa hoàn thành hôm nay.`,
    noReviewYet: 'Bạn chưa tạo daily review hôm nay.',
    rescheduleLight: 'Bạn có muốn dời 2 việc nhẹ sang ngày mai không?',
  },
  en: {
    sleepDuration: (h: string) => `You slept about ${h} last night.`,
    sleepNearUsual: (hhmm: string) => `Your usual sleep time is ${hhmm}.`,
    pendingLate: (n: number) => `${n} tasks still pending after 9pm.`,
    energyLow: 'You reported low energy today.',
    overdueTasks: (n: number) => `${n} tasks are overdue.`,
    mealOverdue: (meal: string, h: number) => `${meal} was ${h}h ago and not logged yet.`,
    budgetUsage: (cat: string, p: number) => `Budget "${cat}" is at ${Math.round(p)}%.`,
    daysLeft: (d: number) => `${d} days left in the month.`,
    habitMissed: (n: number) => `${n} habits not done today.`,
    noReviewYet: "You haven't created today's daily review yet.",
    rescheduleLight: 'Want me to move 2 light tasks to tomorrow?',
  },
} as const;

const MEAL_NAMES: Record<'vi' | 'en', { breakfast: string; lunch: string; dinner: string }> = {
  vi: { breakfast: 'bữa sáng', lunch: 'bữa trưa', dinner: 'bữa tối' },
  en: { breakfast: 'breakfast', lunch: 'lunch', dinner: 'dinner' },
};

/**
 * Pure rule engine. Takes a CollectedSignals snapshot, returns the
 * matching ContextInference candidates (rule-based only — no AI).
 *
 * Rules are intentionally conservative: confidence ≥ 0.5 to surface, AND
 * each rule respects its matching privacy gate (skipped when the user
 * opted out of the underlying domain).
 */
@Injectable()
export class InferenceRuleService {
  evaluate(signals: CollectedSignals, locale: 'vi' | 'en' = 'vi'): RuleResult[] {
    const results: RuleResult[] = [];
    const c = COPY[locale];

    // --- POSSIBLE_SLEEPINESS ----------------------------------------------
    if (signals.gates.health) {
      const usual = signals.patterns['USUAL_SLEEP_TIME']?.value as
        | { hour: number; minute: number }
        | undefined;
      const now = signals.now;
      const usualMinutes = usual ? usual.hour * 60 + usual.minute : 23 * 60 + 30;
      const nowMinutes = now.getHours() * 60 + now.getMinutes();
      const minsTillUsual = Math.abs(usualMinutes - nowMinutes);
      const nearSleepTime = minsTillUsual <= 90 || nowMinutes >= 22 * 60;
      const lowSleepLast =
        signals.lastSleepDurationMin !== null && signals.lastSleepDurationMin < 6 * 60;
      const lowEnergy = signals.latestMood?.energy === 'LOW';
      const manyPendingLate = signals.pendingTasksAfter21Count >= 2;

      const score =
        (nearSleepTime ? 0.3 : 0) +
        (lowSleepLast ? 0.3 : 0) +
        (lowEnergy ? 0.2 : 0) +
        (manyPendingLate ? 0.2 : 0);

      if (score >= 0.5) {
        const items: Array<{ key: string; summary: string }> = [];
        if (lowSleepLast) {
          const h = (signals.lastSleepDurationMin! / 60).toFixed(1);
          items.push({ key: 'sleepDuration', summary: c.sleepDuration(`${h}h`) });
        }
        if (usual) {
          const hhmm = `${String(usual.hour).padStart(2, '0')}:${String(usual.minute).padStart(2, '0')}`;
          items.push({ key: 'usualSleepTime', summary: c.sleepNearUsual(hhmm) });
        }
        if (manyPendingLate) {
          items.push({ key: 'pendingLate', summary: c.pendingLate(signals.pendingTasksAfter21Count) });
        }
        if (lowEnergy) items.push({ key: 'energyLow', summary: c.energyLow });

        results.push({
          type: 'POSSIBLE_SLEEPINESS',
          confidence: Math.min(1, score),
          evidence: { locale, items },
          suggestedAction:
            signals.pendingTasksAfter21Count >= 2
              ? { type: 'RESCHEDULE_LIGHT', count: 2, copy: c.rescheduleLight }
              : undefined,
        });
      }
    }

    // --- WORKLOAD_OVERLOAD -------------------------------------------------
    if (signals.gates.tasks && signals.pendingTasksAfter21Count >= 3) {
      results.push({
        type: 'WORKLOAD_OVERLOAD',
        confidence: Math.min(1, 0.5 + signals.pendingTasksAfter21Count * 0.1),
        evidence: {
          locale,
          items: [{ key: 'pendingLate', summary: c.pendingLate(signals.pendingTasksAfter21Count) }],
        },
        suggestedAction: { type: 'RESCHEDULE_LIGHT', count: 2, copy: c.rescheduleLight },
      });
    }

    // --- MEAL_MAY_BE_SKIPPED ----------------------------------------------
    if (signals.gates.meals) {
      const checkMeal = (
        kind: 'breakfast' | 'lunch' | 'dinner',
        patternKey: 'USUAL_MEAL_TIME_BREAKFAST' | 'USUAL_MEAL_TIME_LUNCH' | 'USUAL_MEAL_TIME_DINNER',
      ) => {
        if (signals.mealLogsToday[kind]) return;
        const usual = signals.patterns[patternKey]?.value as
          | { hour: number; minute: number }
          | undefined;
        if (!usual) return;
        const usualMinutes = usual.hour * 60 + usual.minute;
        const nowMinutes = signals.now.getHours() * 60 + signals.now.getMinutes();
        if (nowMinutes - usualMinutes >= 90 && nowMinutes - usualMinutes <= 6 * 60) {
          const hoursLate = ((nowMinutes - usualMinutes) / 60).toFixed(1);
          results.push({
            type: 'MEAL_MAY_BE_SKIPPED',
            confidence: 0.7,
            evidence: {
              locale,
              items: [
                { key: 'mealOverdue', summary: c.mealOverdue(MEAL_NAMES[locale][kind], Number(hoursLate)) },
              ],
            },
            suggestedAction: { type: 'OPEN_MEAL_QUICK_LOG', mealType: kind.toUpperCase() },
          });
        }
      };
      checkMeal('breakfast', 'USUAL_MEAL_TIME_BREAKFAST');
      checkMeal('lunch', 'USUAL_MEAL_TIME_LUNCH');
      checkMeal('dinner', 'USUAL_MEAL_TIME_DINNER');
    }

    // --- BUDGET_RISK -------------------------------------------------------
    if (signals.gates.finance) {
      for (const b of signals.budgetUsages) {
        if (b.usagePercent >= b.threshold && signals.daysLeftInMonth >= 5) {
          results.push({
            type: 'BUDGET_RISK',
            confidence: Math.min(1, 0.5 + (b.usagePercent - b.threshold) / 100),
            evidence: {
              locale,
              items: [
                { key: 'budgetUsage', summary: c.budgetUsage(b.category, b.usagePercent) },
                { key: 'daysLeft', summary: c.daysLeft(signals.daysLeftInMonth) },
              ],
            },
            suggestedAction: { type: 'OPEN_BUDGET_REVIEW', category: b.category },
          });
        }
      }
    }

    // --- TASK_PROCRASTINATION_RISK ----------------------------------------
    if (signals.gates.tasks && signals.overdueTasksCount >= 2) {
      results.push({
        type: 'TASK_PROCRASTINATION_RISK',
        confidence: Math.min(1, 0.5 + signals.overdueTasksCount * 0.1),
        evidence: {
          locale,
          items: [{ key: 'overdueTasks', summary: c.overdueTasks(signals.overdueTasksCount) }],
        },
      });
    }

    // --- HABIT_DROP_RISK ---------------------------------------------------
    if (signals.gates.habits && signals.habitsMissedToday >= 2 && signals.hourLocal >= 19) {
      results.push({
        type: 'HABIT_DROP_RISK',
        confidence: 0.6,
        evidence: {
          locale,
          items: [{ key: 'habitMissed', summary: c.habitMissed(signals.habitsMissedToday) }],
        },
      });
    }

    // --- LOW_ENERGY_DAY ----------------------------------------------------
    if (signals.gates.health && signals.latestMood?.energy === 'LOW') {
      const lowSleep = signals.lastSleepDurationMin !== null && signals.lastSleepDurationMin < 6 * 60;
      results.push({
        type: 'LOW_ENERGY_DAY',
        confidence: lowSleep ? 0.8 : 0.55,
        evidence: {
          locale,
          items: [
            { key: 'energyLow', summary: c.energyLow },
            ...(lowSleep
              ? [
                  {
                    key: 'sleepDuration',
                    summary: c.sleepDuration(`${(signals.lastSleepDurationMin! / 60).toFixed(1)}h`),
                  },
                ]
              : []),
          ],
        },
      });
    }

    // --- NEED_REVIEW_DAY ---------------------------------------------------
    if (signals.gates.schedule && signals.hourLocal >= 21 && !signals.hasReviewToday) {
      results.push({
        type: 'NEED_REVIEW_DAY',
        confidence: 0.6,
        evidence: { locale, items: [{ key: 'noReviewYet', summary: c.noReviewYet }] },
        suggestedAction: { type: 'OPEN_DAILY_REVIEW' },
      });
    }

    return results;
  }
}
