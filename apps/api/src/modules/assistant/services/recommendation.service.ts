import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AIRecommendationStatus,
  AIRecommendationType,
  Prisma,
  Priority,
} from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import type { Signal, SignalCode } from './types';

type Locale = 'vi' | 'en';

type Template = {
  type: AIRecommendationType;
  priority: Priority;
  title: Record<Locale, (p: Record<string, unknown>) => string>;
  content: Record<Locale, (p: Record<string, unknown>) => string>;
};

/**
 * Recommendation templates — stable copy that maps a SignalCode to a
 * localized title + body. Keep these tight and non-judgmental per product
 * rules: no shaming, frame everything as a gentle option.
 */
const TEMPLATES: Record<SignalCode, Template> = {
  SCHEDULE_MISSING: {
    type: 'SCHEDULE',
    priority: 'LOW',
    title: {
      vi: () => 'Chưa có kế hoạch hôm nay',
      en: () => 'No plan for today yet',
    },
    content: {
      vi: () =>
        'Bạn muốn mình soạn nhanh một khung ngày 5–7 khối dựa trên thói quen và task đang mở không?',
      en: () =>
        "Want me to draft a 5–7 block day for you based on your habits and open tasks?",
    },
  },
  SCHEDULE_BEHIND: {
    type: 'SCHEDULE',
    priority: 'HIGH',
    title: {
      vi: () => 'Một vài việc đang chậm so với lịch',
      en: () => 'A few items are running behind',
    },
    content: {
      vi: (p) =>
        `Có ${p.pendingPastCount} mục đã qua giờ bắt đầu mà vẫn PENDING. Bạn có muốn mình sắp lại nửa ngày còn lại không?`,
      en: (p) =>
        `${p.pendingPastCount} items are past their start time and still PENDING. Want me to re-plan the rest of the day?`,
    },
  },
  SCHEDULE_OVERLOADED: {
    type: 'SCHEDULE',
    priority: 'MEDIUM',
    title: {
      vi: () => 'Lịch hôm nay hơi dày',
      en: () => 'Today looks a bit packed',
    },
    content: {
      vi: (p) =>
        `Có ${p.itemsCount} mục trên lịch. Nếu không phải hôm deadline, thử dời 1–2 mục ưu tiên thấp sang ngày khác.`,
      en: (p) =>
        `There are ${p.itemsCount} items on your plan. If this isn't a deadline day, moving 1–2 low-priority items helps.`,
    },
  },
  SCHEDULE_FREE_WINDOW: {
    type: 'SCHEDULE',
    priority: 'LOW',
    title: {
      vi: () => 'Bạn có một khoảng rảnh',
      en: () => 'You have an open window',
    },
    content: {
      vi: (p) =>
        `Khoảng trống ${p.gapMinutes} phút. Thử dành 25 phút cho task ưu tiên cao hoặc đi bộ nhẹ.`,
      en: (p) =>
        `A ${p.gapMinutes}-minute gap. A 25-minute focused block or a short walk fits nicely.`,
    },
  },
  TASKS_DUE_SOON: {
    type: 'TASK',
    priority: 'MEDIUM',
    title: {
      vi: () => 'Task sắp đến hạn',
      en: () => 'Tasks due soon',
    },
    content: {
      vi: (p) => `Có ${p.count} task đến hạn trong hôm nay/ngày mai. Đưa vào lịch cho chắc nhé.`,
      en: (p) =>
        `${p.count} tasks are due today/tomorrow. Blocking time for them reduces surprises.`,
    },
  },
  TASK_OVERDUE: {
    type: 'TASK',
    priority: 'HIGH',
    title: {
      vi: () => 'Có task đã quá hạn',
      en: () => 'Some tasks are overdue',
    },
    content: {
      vi: (p) =>
        `${p.count} task đã qua hạn mà chưa đóng. Có thể đóng, dời ngày, hoặc tách nhỏ ra.`,
      en: (p) =>
        `${p.count} tasks are past due. Close them, push the date, or break them down.`,
    },
  },
  HABITS_NOT_LOGGED: {
    type: 'HABIT',
    priority: 'LOW',
    title: {
      vi: () => 'Chưa check-in thói quen hôm nay',
      en: () => 'No habits logged today',
    },
    content: {
      vi: (p) =>
        `${p.habitCount} thói quen đang bật nhưng chưa có log. Chỉ 30 giây để check-in là xong.`,
      en: (p) =>
        `${p.habitCount} active habits with no log. A 30-second check-in keeps the streak honest.`,
    },
  },
  HABIT_DROPPING: {
    type: 'HABIT',
    priority: 'MEDIUM',
    title: {
      vi: (p) => `Thói quen "${p.name}" đang trượt`,
      en: (p) => `Habit "${p.name}" is slipping`,
    },
    content: {
      vi: (p) =>
        `Chỉ hoàn thành ${p.completedLast5}/5 ngày gần đây. Thử rút nhỏ mục tiêu trong 1 tuần để lấy lại đà.`,
      en: (p) =>
        `Only completed ${p.completedLast5}/5 recent days. Shrinking the target for a week often restores momentum.`,
    },
  },
  MEAL_PLAN_MISSING: {
    type: 'MEAL',
    priority: 'LOW',
    title: {
      vi: () => 'Chưa có kế hoạch bữa hôm nay',
      en: () => 'No meal plan for today',
    },
    content: {
      vi: () =>
        'Mình có thể gợi ý 3 bữa hợp mục tiêu và nguyên liệu đang có — mở mục Meals để thử.',
      en: () =>
        'I can suggest 3 meals that match your goal + available ingredients — open the Meals tab.',
    },
  },
  MEAL_SKIPPED_REPEATEDLY: {
    type: 'MEAL',
    priority: 'MEDIUM',
    title: {
      vi: () => 'Có vẻ đang bỏ bữa nhiều',
      en: () => 'Looks like some meals are being skipped',
    },
    content: {
      vi: (p) =>
        `Chỉ ${p.loggedLast5} bữa được ghi trong 5 ngày qua. Bữa sáng hoặc trưa nhẹ đủ chất giúp chiều đỡ mệt.`,
      en: (p) =>
        `Only ${p.loggedLast5} meals logged in 5 days. A light balanced breakfast or lunch helps afternoons.`,
    },
  },
  UNDER_SLEPT_3D: {
    type: 'SLEEP',
    priority: 'HIGH',
    title: {
      vi: () => 'Đang thiếu ngủ vài ngày liền',
      en: () => 'Sleep has been short for a few days',
    },
    content: {
      vi: (p) =>
        `Trung bình ${Math.round(((p.avgMinutes as number) / 60) * 10) / 10} giờ/đêm. Thử tắt điện thoại 30 phút sớm hơn tối nay nhé.`,
      en: (p) =>
        `Averaging ${Math.round(((p.avgMinutes as number) / 60) * 10) / 10}h/night. Try a 30-minute earlier phone-down tonight.`,
    },
  },
  MOOD_CHECKIN_MISSING: {
    type: 'HEALTH',
    priority: 'LOW',
    title: {
      vi: () => 'Chưa check-in tâm trạng hôm nay',
      en: () => 'No mood check-in yet today',
    },
    content: {
      vi: () => 'Chỉ mất 10 giây, nhưng giúp bạn nhận ra xu hướng dài hạn.',
      en: () => 'Takes 10 seconds — pays off as a long-term trend.',
    },
  },
  SLEEP_CHECKIN_MISSING: {
    type: 'SLEEP',
    priority: 'LOW',
    title: {
      vi: () => 'Chưa ghi giấc ngủ hôm nay',
      en: () => 'No sleep log yet today',
    },
    content: {
      vi: () => 'Ghi nhanh giờ đi ngủ + chất lượng ngủ để AI tư vấn tốt hơn.',
      en: () => 'Logging sleep time + quality helps the assistant advise better.',
    },
  },
  STRESS_HIGH_RECURRING: {
    type: 'HEALTH',
    priority: 'MEDIUM',
    title: {
      vi: () => 'Stress cao mấy ngày gần đây',
      en: () => 'Stress has been high lately',
    },
    content: {
      vi: () =>
        'Thử chèn một khối nghỉ 15 phút giữa chiều, hoặc một buổi tập nhẹ cuối ngày.',
      en: () =>
        'Try a 15-minute mid-afternoon break, or a light workout later today.',
    },
  },
  BUDGET_OVER_THRESHOLD: {
    type: 'BUDGET',
    priority: 'HIGH',
    title: {
      vi: (p) => `Ngân sách "${p.category}" sắp hết`,
      en: (p) => `Budget "${p.category}" is running low`,
    },
    content: {
      vi: (p) =>
        `Đã dùng ${p.usagePercent}% (${p.spent} / ${p.cap}). Cân nhắc dừng mua sắm không thiết yếu đến cuối tháng.`,
      en: (p) =>
        `Used ${p.usagePercent}% (${p.spent} / ${p.cap}). Pausing non-essential purchases until month-end helps.`,
    },
  },
  SPENDING_ABOVE_BASELINE: {
    type: 'FINANCE',
    priority: 'MEDIUM',
    title: {
      vi: () => 'Hôm nay chi nhiều hơn trung bình',
      en: () => 'Spending is higher than usual today',
    },
    content: {
      vi: (p) =>
        `Hôm nay ${p.todayTotal}, trung bình gần đây ${p.avgDaily}/ngày. Không phán xét — chỉ để bạn để ý.`,
      en: (p) =>
        `${p.todayTotal} today vs ${p.avgDaily}/day recently. No judgment — just a heads-up.`,
    },
  },
  DEBT_DUE_SOON: {
    type: 'FINANCE',
    priority: 'HIGH',
    title: {
      vi: (p) => `Khoản "${p.title}" sắp đến hạn`,
      en: (p) => `Debt "${p.title}" is due soon`,
    },
    content: {
      vi: (p) =>
        `Còn ${p.daysTo} ngày, còn lại ${p.remaining}. Lên lịch thanh toán trước 2 ngày cho chắc.`,
      en: (p) =>
        `${p.daysTo} days out, ${p.remaining} remaining. Scheduling payment 2 days early is safest.`,
    },
  },
  CASH_LOW_VS_DAYS_LEFT: {
    type: 'FINANCE',
    priority: 'HIGH',
    title: {
      vi: () => 'Tiền còn lại tháng này hơi sát',
      en: () => 'Monthly cash is getting tight',
    },
    content: {
      vi: (p) =>
        `Còn ${p.remaining} cho ${p.daysLeft} ngày tới. Mở Finance để xem khoản nào có thể tạm gác.`,
      en: (p) =>
        `${p.remaining} left for ${p.daysLeft} days. Open Finance to see what can wait.`,
    },
  },
  FIN_GOAL_BEHIND: {
    type: 'GOAL',
    priority: 'MEDIUM',
    title: {
      vi: (p) => `Mục tiêu tiết kiệm "${p.title}" đang chậm`,
      en: (p) => `Saving goal "${p.title}" is behind`,
    },
    content: {
      vi: (p) =>
        `Mới đạt ${p.progressPercent}% sau phần lớn chặng. Tự động chuyển 5% lương sang tài khoản tiết kiệm là cách đơn giản nhất.`,
      en: (p) =>
        `Only ${p.progressPercent}% after most of the runway. Auto-moving 5% of salary to savings is the simplest lift.`,
    },
  },
  PERSONAL_GOAL_BEHIND: {
    type: 'GOAL',
    priority: 'MEDIUM',
    title: {
      vi: (p) => `Mục tiêu "${p.title}" cần chú ý`,
      en: (p) => `Goal "${p.title}" needs attention`,
    },
    content: {
      vi: (p) =>
        `${p.progressPercent}% sau khi còn ${p.daysTo} ngày. Chia nhỏ thành 1 hành động nhỏ mỗi ngày là cách thực tế nhất.`,
      en: (p) =>
        `${p.progressPercent}% with ${p.daysTo} days to go. Breaking it into one tiny daily action is most realistic.`,
    },
  },
};

/**
 * Manages AIRecommendation rows emitted by the assistant.
 *
 *   - create() dedupes within a 24h window by (userId, signalCode).
 *   - list() filters by status + recency.
 *   - patchStatus() transitions NEW → VIEWED → APPLIED / DISMISSED.
 */
@Injectable()
export class RecommendationService {
  constructor(private readonly prisma: PrismaService) {}

  async createFromSignal(
    userId: string,
    signal: Signal,
    locale: Locale,
  ): Promise<{ id: string; created: boolean; type: AIRecommendationType; priority: Priority; title: string; content: string; createdAt: Date }> {
    const template = TEMPLATES[signal.code];
    const title = template.title[locale](signal.payload);
    const content = template.content[locale](signal.payload);
    const priority = severityToPriority(signal.severity, template.priority);

    // Dedupe: within the last 24h, skip if the same signal code already has
    // an open recommendation for this user.
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const existing = await this.prisma.aIRecommendation.findFirst({
      where: {
        userId,
        type: template.type,
        status: { in: ['NEW', 'VIEWED'] },
        createdAt: { gte: since },
        // sourceData is JSON — filter with a raw path.
        AND: [{ sourceData: { path: ['signalCode'], equals: signal.code } }],
      },
      select: { id: true, type: true, priority: true, title: true, content: true, createdAt: true },
    });
    if (existing) {
      return { ...existing, created: false };
    }

    const row = await this.prisma.aIRecommendation.create({
      data: {
        userId,
        type: template.type,
        title,
        content,
        priority,
        status: 'NEW',
        sourceData: {
          signalCode: signal.code,
          severity: signal.severity,
          payload: signal.payload as Prisma.InputJsonValue,
        },
      },
      select: { id: true, type: true, priority: true, title: true, content: true, createdAt: true },
    });
    return { ...row, created: true };
  }

  async list(
    userId: string,
    opts: { status?: AIRecommendationStatus; limit?: number } = {},
  ) {
    const limit = Math.min(Math.max(opts.limit ?? 30, 1), 100);
    return this.prisma.aIRecommendation.findMany({
      where: {
        userId,
        ...(opts.status
          ? { status: opts.status }
          : { status: { in: ['NEW', 'VIEWED'] } }),
      },
      orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
      take: limit,
    });
  }

  async patchStatus(userId: string, id: string, status: AIRecommendationStatus) {
    const row = await this.prisma.aIRecommendation.findUnique({ where: { id } });
    if (!row) throw new NotFoundException({ message: 'Recommendation not found', errorCode: 'NOT_FOUND' });
    if (row.userId !== userId) throw new ForbiddenException({ errorCode: 'FORBIDDEN' });
    // Guard: no going back to NEW after a terminal state.
    if (
      (row.status === 'APPLIED' || row.status === 'DISMISSED') &&
      status === 'NEW'
    ) {
      throw new BadRequestException({
        message: 'Cannot reopen a closed recommendation',
        errorCode: 'UNPROCESSABLE',
      });
    }
    return this.prisma.aIRecommendation.update({ where: { id }, data: { status } });
  }
}

function severityToPriority(severity: 'LOW' | 'MEDIUM' | 'HIGH', fallback: Priority): Priority {
  if (severity === 'HIGH') return Priority.HIGH;
  if (severity === 'MEDIUM') return Priority.MEDIUM;
  if (severity === 'LOW') return Priority.LOW;
  return fallback;
}
