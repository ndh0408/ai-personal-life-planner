/**
 * Rule-based recommendations: read the user's recent data and emit
 * actionable nudges. AI-generated recommendations (round 7+) will share
 * the same output shape so the controller stays unchanged.
 *
 * Each rule looks at one signal and produces 0..1 recommendation. The
 * service merges them and writes new rows in AIRecommendation.
 */
import type { Prisma, PrismaClient } from '@prisma/client';
import { rangeFor } from '../../common/datetime/range';

export interface DraftRec {
  type: 'SCHEDULE' | 'TASK' | 'MEAL' | 'SLEEP' | 'MOOD' | 'FINANCE' | 'GENERAL';
  title: string;
  content: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH';
  evidence: Prisma.InputJsonValue;
}

interface PrivacyToggles {
  useFinanceForAI: boolean;
  useHealthForAI: boolean;
  useMealsForAI: boolean;
  useTasksForAI: boolean;
  proactiveRecommendations: boolean;
}

export async function generateForUser(
  prisma: PrismaClient,
  userId: string,
  privacy: PrivacyToggles,
  now = new Date(),
): Promise<DraftRec[]> {
  if (!privacy.proactiveRecommendations) return [];

  const drafts: DraftRec[] = [];

  // ── Finance: today vs week-avg ──────────────────────────────────────────
  if (privacy.useFinanceForAI) {
    const today = rangeFor('today', now);
    const week = rangeFor('week', now);
    const [todayRows, weekRows] = await Promise.all([
      prisma.expense.findMany({
        where: { userId, deletedAt: null, expenseDate: { gte: today.start, lt: today.end } },
        select: { amount: true },
      }),
      prisma.expense.findMany({
        where: { userId, deletedAt: null, expenseDate: { gte: week.start, lt: week.end } },
        select: { amount: true, expenseDate: true },
      }),
    ]);
    const sum = (rows: { amount: { toString: () => string } }[]) =>
      rows.reduce((s, r) => s + Number(r.amount), 0);
    const todayTotal = sum(todayRows);
    const weekTotal = sum(weekRows);
    // Use a 6-day baseline (exclude today) to avoid double-counting.
    const dailyAvg = weekTotal > todayTotal ? (weekTotal - todayTotal) / 6 : 0;
    if (dailyAvg > 0 && todayTotal > dailyAvg * 1.5 && todayTotal > 100_000) {
      drafts.push({
        type: 'FINANCE',
        title: 'Hôm nay chi tiêu cao hơn bình thường',
        content: `Hôm nay bạn đã chi ${fmt(todayTotal)}, vượt ~${Math.round(
          (todayTotal / dailyAvg - 1) * 100,
        )}% so với mức trung bình ${fmt(Math.round(dailyAvg))}/ngày của tuần này.`,
        priority: todayTotal > dailyAvg * 2 ? 'HIGH' : 'MEDIUM',
        evidence: { todayTotal, dailyAvg: Math.round(dailyAvg), weekTotal },
      });
    }
  }

  // ── Tasks: overdue ──────────────────────────────────────────────────────
  if (privacy.useTasksForAI) {
    const overdue = await prisma.task.findMany({
      where: {
        userId,
        deletedAt: null,
        status: { in: ['TODO', 'IN_PROGRESS'] },
        dueAt: { lt: now },
      },
      orderBy: { dueAt: 'asc' },
      take: 3,
    });
    if (overdue.length > 0) {
      const first = overdue[0];
      const daysLate = Math.max(
        1,
        Math.round((now.getTime() - first.dueAt!.getTime()) / 86_400_000),
      );
      drafts.push({
        type: 'TASK',
        title:
          overdue.length === 1
            ? `"${first.title}" đã quá hạn ${daysLate} ngày`
            : `${overdue.length} task đã quá hạn`,
        content:
          overdue.length === 1
            ? 'Hoàn thành ngay hôm nay hoặc dời lịch — đừng để treo lâu hơn.'
            : `Cũ nhất: "${first.title}" (quá hạn ${daysLate} ngày). Mở Today để xem hết.`,
        priority: daysLate >= 3 || overdue.length >= 2 ? 'HIGH' : 'MEDIUM',
        evidence: { overdueIds: overdue.map((t) => t.id), daysLate },
      });
    }
  }

  // ── Sleep: short-sleep streak ───────────────────────────────────────────
  if (privacy.useHealthForAI) {
    const recent = await prisma.sleepLog.findMany({
      where: { userId },
      orderBy: { sleepAt: 'desc' },
      take: 3,
    });
    if (recent.length >= 2) {
      const shortNights = recent.filter((s) => s.durationMinutes < 6 * 60).length;
      if (shortNights >= 2) {
        const lastDur = (recent[0].durationMinutes / 60).toFixed(1);
        drafts.push({
          type: 'SLEEP',
          title: `Ngủ ít hơn 6 tiếng ${shortNights} đêm gần đây`,
          content: `Đêm qua bạn ngủ ${lastDur} tiếng. Cân nhắc đi ngủ trước 23:00 tối nay — mình sẽ thêm vào kế hoạch hôm nay nếu muốn.`,
          priority: shortNights >= 3 ? 'HIGH' : 'MEDIUM',
          evidence: {
            shortNights,
            lastDurationMinutes: recent[0].durationMinutes,
          },
        });
      }
    }
  }

  // ── Meal: no meal logged after lunch hour ───────────────────────────────
  if (privacy.useMealsForAI) {
    const today = rangeFor('today', now);
    const localHour = (now.getUTCHours() + 7) % 24; // ICT
    if (localHour >= 13) {
      const lunchish = await prisma.mealLog.findFirst({
        where: {
          userId,
          loggedAt: { gte: today.start, lt: today.end },
          mealType: { in: ['LUNCH', 'SNACK'] },
        },
      });
      if (!lunchish) {
        drafts.push({
          type: 'MEAL',
          title: 'Đã ghi bữa trưa chưa?',
          content: 'Một dòng "ăn cơm tấm 75k" ở Quick Capture là đủ.',
          priority: 'LOW',
          evidence: { hour: localHour },
        });
      }
    }
  }

  // ── Mood: STRESSED / TIRED streak ───────────────────────────────────────
  if (privacy.useHealthForAI) {
    const recent = await prisma.moodLog.findMany({
      where: { userId },
      orderBy: { loggedAt: 'desc' },
      take: 3,
    });
    const lowMood = recent.filter((m) => m.mood === 'STRESSED' || m.mood === 'TIRED').length;
    if (recent.length >= 2 && lowMood >= 2) {
      drafts.push({
        type: 'MOOD',
        title: 'Mấy hôm nay bạn có vẻ mệt',
        content:
          'Cân nhắc một buổi đi bộ 20 phút hoặc nghỉ sớm. Mình có thể nhắc 22:30 nếu muốn.',
        priority: 'MEDIUM',
        evidence: { lowMoodCount: lowMood },
      });
    }
  }

  return drafts;
}

function fmt(n: number): string {
  return n.toLocaleString('vi-VN') + ' ₫';
}
