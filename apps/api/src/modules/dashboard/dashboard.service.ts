/**
 * Aggregates the small set of facts the Home dashboard needs into a single
 * round-trip. Each piece is independently optional — the dashboard renders
 * around whatever's null. No AI calls here; the assistant + planner endpoints
 * own those.
 */
import { Injectable } from '@nestjs/common';
import { AiRecommendationStatus } from '@prisma/client';
import type { DashboardSummary } from '@lifeos/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { rangeFor } from '../../common/datetime/range';

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async summary(userId: string): Promise<DashboardSummary> {
    const now = new Date();
    const today = rangeFor('today', now);
    const week = rangeFor('week', now);

    const [
      aiKey,
      todayPlan,
      todayExp,
      weekExp,
      defaultWallet,
      nextTask,
      topRec,
      lastSleep,
      lastMood,
    ] = await Promise.all([
      this.prisma.userAiKey.findUnique({ where: { userId }, select: { isActive: true } }),
      this.prisma.dailyPlan.findUnique({
        where: { userId_date: { userId, date: today.start } },
        include: { items: { select: { status: true } } },
      }),
      this.prisma.expense.findMany({
        where: { userId, deletedAt: null, expenseDate: { gte: today.start, lt: today.end } },
        select: { amount: true },
      }),
      this.prisma.expense.findMany({
        where: { userId, deletedAt: null, expenseDate: { gte: week.start, lt: week.end } },
        select: { amount: true },
      }),
      this.prisma.wallet.findFirst({
        where: { userId, deletedAt: null, isDefault: true },
        select: { balance: true },
      }),
      this.prisma.task.findFirst({
        where: {
          userId,
          deletedAt: null,
          status: { in: ['TODO', 'IN_PROGRESS'] },
        },
        orderBy: [
          // Tasks with a due date come first; then earliest due, then HIGH priority.
          { dueAt: 'asc' },
          { priority: 'desc' },
        ],
        select: { id: true, title: true, dueAt: true, priority: true },
      }),
      this.prisma.aIRecommendation.findFirst({
        where: {
          userId,
          status: { in: [AiRecommendationStatus.NEW, AiRecommendationStatus.VIEWED] },
        },
        orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
        select: { id: true, type: true, title: true, content: true, priority: true },
      }),
      this.prisma.sleepLog.findFirst({
        where: { userId },
        orderBy: { sleepAt: 'desc' },
        select: { durationMinutes: true, quality: true },
      }),
      this.prisma.moodLog.findFirst({
        where: { userId },
        orderBy: { loggedAt: 'desc' },
        select: { mood: true, energy: true },
      }),
    ]);

    const sum = (rows: { amount: { toString: () => string } }[]) =>
      rows.reduce((s, r) => s + Number(r.amount), 0);

    const todayItems = todayPlan?.items ?? [];

    return {
      aiEnabled: !!aiKey?.isActive,
      todayPlan: {
        planId: todayPlan?.id ?? null,
        totalItems: todayItems.length,
        doneItems: todayItems.filter((i) => i.status === 'COMPLETED').length,
        aiGenerated: todayPlan?.aiGenerated ?? false,
      },
      money: {
        todayTotal: sum(todayExp),
        weekTotal: sum(weekExp),
        walletBalance: defaultWallet ? Number(defaultWallet.balance) : 0,
        currency: 'VND',
      },
      nextTask: nextTask
        ? {
            id: nextTask.id,
            title: nextTask.title,
            dueAt: nextTask.dueAt ? nextTask.dueAt.toISOString() : null,
            priority: nextTask.priority,
          }
        : null,
      topRecommendation: topRec
        ? {
            id: topRec.id,
            type: topRec.type,
            title: topRec.title,
            content: topRec.content,
            priority: topRec.priority,
          }
        : null,
      moodSleep: {
        lastSleepMinutes: lastSleep?.durationMinutes ?? null,
        lastSleepQuality: lastSleep?.quality ?? null,
        lastMood: lastMood?.mood ?? null,
        lastEnergy: lastMood?.energy ?? null,
      },
      serverTime: now.toISOString(),
    };
  }
}
