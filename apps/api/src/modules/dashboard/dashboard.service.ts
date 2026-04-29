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
import { UserContextService } from '../intelligence/user-context.service';
import { SmartBriefService } from './smart-brief.service';

@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly userCtx: UserContextService,
    private readonly smartBrief: SmartBriefService,
  ) {}

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
        // Round 37: include the rationale fields so Home can render the
        // "Why this?" sheet without a second round-trip.
        select: {
          id: true,
          type: true,
          title: true,
          content: true,
          priority: true,
          explainText: true,
          evidence: true,
        },
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
    const totalItems = todayItems.length;
    const doneItems = todayItems.filter((i) => i.status === 'COMPLETED').length;

    // Round 30: build the smart brief + suggested captures + privacy hints
    // from the existing snapshot so the redesigned Home can render in one
    // round-trip without firing extra queries.
    const ctx = await this.userCtx.build(userId);
    const profile = await this.prisma.userProfile.findUnique({
      where: { userId },
      select: { budgetMonthly: true },
    });
    const briefInput = {
      ctx,
      todayPlanItems: totalItems,
      todayPlanDone: doneItems,
      budgetMonthly: profile?.budgetMonthly == null ? null : Number(profile.budgetMonthly),
      monthSpend: ctx.monthSpendVnd,
      hasAiKey: !!aiKey?.isActive,
    };
    const smartBrief = this.smartBrief.build(briefInput);
    const suggestedCaptures = this.smartBrief.suggestCaptures(briefInput);
    const privacyLimitedDomains = this.smartBrief.privacyLimitedDomains(ctx);

    // Round 37: adaptive Home card ordering. Each card gets a score based
    // on recency-of-need; the highest-scoring card surfaces first. Stable
    // within the snapshot's 60 s TTL (UserContextService caches the
    // upstream signals) so the UI doesn't shuffle on a refresh.
    const homeOrder = this.computeHomeOrder({
      monthSpend: ctx.monthSpendVnd,
      budgetMonthly: briefInput.budgetMonthly,
      overdueTasks: ctx.openHighPriorityTaskCount ?? 0,
      lastSleepMinutes: ctx.lastSleepMinutes,
      lastMood: ctx.lastMood,
      todayPlanRemaining: Math.max(0, totalItems - doneItems),
      privacyLimited: privacyLimitedDomains,
    });

    return {
      aiEnabled: !!aiKey?.isActive,
      todayPlan: {
        planId: todayPlan?.id ?? null,
        totalItems,
        doneItems,
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
            explainText: topRec.explainText ?? null,
            evidence: liftEvidenceItems(topRec.evidence),
          }
        : null,
      moodSleep: {
        lastSleepMinutes: lastSleep?.durationMinutes ?? null,
        lastSleepQuality: lastSleep?.quality ?? null,
        lastMood: lastMood?.mood ?? null,
        lastEnergy: lastMood?.energy ?? null,
      },
      serverTime: now.toISOString(),
      smartBrief,
      suggestedCaptures,
      privacyLimitedDomains,
      homeOrder,
    };
  }

  /**
   * Score-and-order the Home cards. Highest-scoring card surfaces first.
   * Cards belonging to a privacy-hidden domain are dropped — UI handles
   * the absence by showing the privacy banner.
   */
  private computeHomeOrder(args: {
    monthSpend: number | null;
    budgetMonthly: number | null;
    overdueTasks: number;
    lastSleepMinutes: number | null;
    lastMood: string | null;
    todayPlanRemaining: number;
    privacyLimited: Array<'finance' | 'health' | 'meals' | 'tasks'>;
  }): Array<'plan' | 'money' | 'task' | 'health' | 'mood' | 'meal'> {
    const scores: Record<'plan' | 'money' | 'task' | 'health' | 'mood' | 'meal', number> = {
      plan: 10, // baseline — Today plan is always reasonably useful
      money: 5,
      task: 5,
      health: 5,
      mood: 3,
      meal: 2,
    };

    // Money — over budget bumps it to the top.
    if (args.budgetMonthly && args.monthSpend != null && args.budgetMonthly > 0) {
      const ratio = args.monthSpend / args.budgetMonthly;
      if (ratio >= 1) scores.money += 30;
      else if (ratio >= 0.85) scores.money += 15;
      else if (ratio >= 0.7) scores.money += 5;
    }

    // Tasks — overdue counts pile on weight quickly.
    if (args.overdueTasks >= 3) scores.task += 25;
    else if (args.overdueTasks >= 1) scores.task += 10;

    // Plan — if there's a plan and remaining items, plan stays salient.
    if (args.todayPlanRemaining > 0) scores.plan += 5;

    // Sleep — < 6h last night promotes the health card.
    if (args.lastSleepMinutes != null) {
      if (args.lastSleepMinutes < 5 * 60) scores.health += 25;
      else if (args.lastSleepMinutes < 6 * 60) scores.health += 12;
      else if (args.lastSleepMinutes < 7 * 60) scores.health += 4;
    }

    // Mood — TIRED / STRESSED / SAD bumps mood to the front of the row.
    if (args.lastMood === 'TIRED' || args.lastMood === 'STRESSED' || args.lastMood === 'SAD') {
      scores.mood += 15;
    }

    // Apply privacy filter — drop hidden domains.
    const hiddenFinance = args.privacyLimited.includes('finance');
    const hiddenHealth = args.privacyLimited.includes('health');
    const hiddenMeals = args.privacyLimited.includes('meals');
    const hiddenTasks = args.privacyLimited.includes('tasks');

    type Card = 'plan' | 'money' | 'task' | 'health' | 'mood' | 'meal';
    const all: Card[] = ['plan', 'money', 'task', 'health', 'mood', 'meal'];
    const visible = all.filter((c) => {
      if (c === 'money' && hiddenFinance) return false;
      if ((c === 'health' || c === 'mood') && hiddenHealth) return false;
      if (c === 'meal' && hiddenMeals) return false;
      if (c === 'task' && hiddenTasks) return false;
      return true;
    });

    return visible.sort((a, b) => scores[b] - scores[a]);
  }
}

/**
 * Pull the structured evidence items out of the recommendation's free-form
 * JSON. Returns undefined when not present so the wire response stays
 * compact.
 */
function liftEvidenceItems(
  raw: unknown,
):
  | Array<{ label: string; value: string; source?: 'MANUAL' | 'DEVICE' | 'INFERRED' | 'COMPUTED' }>
  | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const items = (raw as { items?: unknown }).items;
  if (!Array.isArray(items)) return undefined;
  return items
    .filter(
      (i): i is { label: string; value: string; source?: string } =>
        !!i && typeof i === 'object' && typeof (i as { label?: unknown }).label === 'string',
    )
    .map((i) => ({
      label: i.label,
      value: i.value,
      source: i.source as 'MANUAL' | 'DEVICE' | 'INFERRED' | 'COMPUTED' | undefined,
    }));
}
