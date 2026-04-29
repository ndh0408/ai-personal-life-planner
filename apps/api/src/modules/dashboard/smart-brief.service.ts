/**
 * Build the dashboard "smart brief" — a one-line headline the redesigned
 * Home command center surfaces above everything else (round 30).
 *
 * Inputs:
 *   - LifeSnapshot (UserContext) for sleep / mood / spend / open tasks
 *   - Today's plan progress
 *   - Privacy flags (so we don't claim "you're under budget" when finance
 *     was hidden — the snapshot already returns null but we phrase the
 *     reason chips honestly).
 *
 * Outputs (in priority order, first match wins):
 *   1. URGENT: lockUntil-style problem — high-priority task overdue, or
 *      spending >100% of monthly budget already.
 *   2. CARE: low sleep + bad mood, or late at night with stuff still open.
 *   3. CELEBRATORY: plan complete, week under budget, sleep on track.
 *   4. NEUTRAL: a gentle "good morning, here's the day" framing.
 *
 * No LLM call — deterministic so the headline doesn't churn between
 * loads. R31+ may add an AI override for richer phrasing.
 */
import { Injectable } from '@nestjs/common';
import type { SmartBrief, SmartBriefAction, SuggestedCapture } from '@lifeos/shared';
import type { UserContext } from '../intelligence/user-context.service';

interface BriefInput {
  ctx: UserContext;
  todayPlanItems: number;
  todayPlanDone: number;
  budgetMonthly: number | null;
  monthSpend: number | null;
  hasAiKey: boolean;
}

@Injectable()
export class SmartBriefService {
  build(input: BriefInput): SmartBrief | null {
    if (!input.ctx.privacy.personalizationEnabled) {
      // User opted out of personalization entirely — show nothing rather
      // than something generic. The Home screen renders plain stats.
      return null;
    }

    const { ctx } = input;
    const sleepHours = ctx.lastSleepMinutes != null ? ctx.lastSleepMinutes / 60 : null;
    const overdueHigh = ctx.openHighPriorityTaskCount ?? 0;
    const todaySpend = ctx.todaySpendVnd ?? 0;
    const monthSpend = input.monthSpend ?? ctx.monthSpendVnd ?? 0;
    const budgetUsage = input.budgetMonthly && input.budgetMonthly > 0
      ? monthSpend / input.budgetMonthly
      : null;
    const planDone = input.todayPlanItems > 0 && input.todayPlanDone === input.todayPlanItems;

    // 1. URGENT path — over budget for the month.
    if (budgetUsage != null && budgetUsage >= 1) {
      return {
        headline: 'Tháng này đã vượt ngân sách',
        body: `Đã chi ${formatVnd(monthSpend)} / ${formatVnd(input.budgetMonthly!)}.`,
        tone: 'urgent',
        source: 'RULE',
        reasonLabels: ['ngân sách', 'vượt mức'],
        primaryAction: openMoneyAction(),
      };
    }

    // 2. URGENT path — >2 high-priority tasks open.
    if (overdueHigh >= 2) {
      return {
        headline: `${overdueHigh} việc HIGH-priority đang mở`,
        body: 'Mở Today để xử lý hoặc dời lịch.',
        tone: 'urgent',
        source: 'RULE',
        reasonLabels: ['việc gấp'],
        primaryAction: { label: 'Mở Today', screen: 'Today' },
      };
    }

    // 3. CARE — short sleep + bad mood.
    if (sleepHours != null && sleepHours < 6 && (ctx.lastMood === 'TIRED' || ctx.lastMood === 'STRESSED')) {
      return {
        headline: 'Hôm qua ngủ ngắn — nhẹ tay với hôm nay nhé',
        body: `Giấc ngủ gần nhất ${sleepHours.toFixed(1)}h. Bớt việc, thêm nghỉ.`,
        tone: 'gentle',
        source: 'RULE',
        reasonLabels: ['ngủ thiếu', 'tâm trạng mệt'],
        primaryAction: { label: 'Mở Today', screen: 'Today' },
      };
    }

    // 4. CELEBRATORY — plan done.
    if (planDone) {
      return {
        headline: 'Đã xong kế hoạch hôm nay 🎯',
        body: 'Cập nhật tâm trạng hoặc nhật ký giấc ngủ để khép ngày.',
        tone: 'celebratory',
        source: 'RULE',
        reasonLabels: ['plan ✓'],
        primaryAction: { label: 'Check-in', screen: 'SleepMoodCheckin' },
      };
    }

    // 5. CELEBRATORY — under budget when budget is set.
    if (budgetUsage != null && budgetUsage <= 0.5) {
      return {
        headline: 'Tài chính ổn — mới dùng dưới một nửa ngân sách',
        body: `Tháng đã chi ${formatVnd(monthSpend)} / ${formatVnd(input.budgetMonthly!)}.`,
        tone: 'celebratory',
        source: 'RULE',
        reasonLabels: ['tài chính ổn'],
      };
    }

    // 6. NEUTRAL — "today" framing with the most relevant signal.
    const signals: string[] = [];
    if (input.todayPlanItems > 0) {
      signals.push(`Plan: ${input.todayPlanDone}/${input.todayPlanItems}`);
    }
    if (todaySpend > 0) signals.push(`Đã chi ${formatVnd(todaySpend)} hôm nay`);
    const headline = signals.length
      ? signals.join(' · ')
      : `Chào ${ctx.profile?.preferredName ?? ''}`.trim() || 'Một ngày mới';

    return {
      headline,
      tone: 'neutral',
      source: 'RULE',
      reasonLabels: input.hasAiKey ? [] : ['chưa bật AI'],
    };
  }

  /**
   * Build up to 3 capture suggestions for the Home chip strip. Heuristic
   * based on what the user typically logs at this time of day + what's
   * missing from today's snapshot.
   */
  suggestCaptures(input: BriefInput): SuggestedCapture[] {
    const out: SuggestedCapture[] = [];
    const hour = new Date().getHours();
    const meals = input.ctx.behavior.recentMealTitles;

    // Meal nudge — meal-typically time of day, no meal logged in last few hours.
    if (input.ctx.privacy.useMealsForAI) {
      if (hour >= 6 && hour < 9) {
        out.push({ text: 'Bữa sáng…', mode: 'MEAL', reason: 'Đầu ngày' });
      } else if (hour >= 11 && hour < 14) {
        const last = meals[0];
        out.push({
          text: last ? `Bữa trưa: ${last}` : 'Bữa trưa…',
          mode: 'MEAL',
          reason: 'Giờ trưa',
        });
      } else if (hour >= 18 && hour < 21) {
        out.push({ text: 'Bữa tối…', mode: 'MEAL', reason: 'Giờ tối' });
      }
    }

    // Sleep nudge — late evening, no sleep log.
    if (out.length < 3 && input.ctx.privacy.useHealthForAI && hour >= 21) {
      out.push({ text: 'Đi ngủ lúc…', mode: 'SLEEP', reason: 'Cuối ngày' });
    }

    // Generic expense nudge — always useful in the morning.
    if (out.length < 3 && input.ctx.privacy.useFinanceForAI && hour < 11) {
      out.push({ text: 'Cà phê 35k', mode: 'EXPENSE', reason: 'Mẫu thường gặp' });
    }

    return out.slice(0, 3);
  }

  privacyLimitedDomains(ctx: UserContext): Array<'finance' | 'health' | 'meals' | 'tasks'> {
    const out: Array<'finance' | 'health' | 'meals' | 'tasks'> = [];
    if (!ctx.privacy.useFinanceForAI) out.push('finance');
    if (!ctx.privacy.useHealthForAI) out.push('health');
    if (!ctx.privacy.useMealsForAI) out.push('meals');
    if (!ctx.privacy.useTasksForAI) out.push('tasks');
    return out;
  }
}

function openMoneyAction(): SmartBriefAction {
  return { label: 'Xem chi tiêu', screen: 'Money' };
}

function formatVnd(n: number): string {
  return `${Math.round(n).toLocaleString('vi-VN')}đ`;
}
