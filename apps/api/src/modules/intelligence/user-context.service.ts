/**
 * The single function every AI consumer calls before sending anything to
 * OpenAI. Returns the full user context — profile, behavior summary,
 * recent events, long-term assistant memories — packed into one
 * JSON-shaped object the LLM can read in one pass.
 *
 * Goal: no AI feature should ever build its own snapshot. If a new feature
 * needs more context, add it here so every other feature benefits.
 */
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { BehaviorService, type BehaviorSummary } from './behavior.service';
import { EventLogService } from './event-log.service';
import { AssistantMemoryService } from './assistant-memory.service';

export interface UserContext {
  now: string; // ISO
  tz: string;
  profile: {
    preferredName: string | null;
    locale: 'vi' | 'en';
    mainGoals: string[];
    usualWakeTime: string | null;
    usualSleepTime: string | null;
    dislikes: string[];
    allergies: string[];
    monthlyGoal: string | null;
    workPattern: string | null;
    budgetMonthly: number | null;
  } | null;
  behavior: BehaviorSummary;
  /** Last 30 events newest-first. */
  recentEvents: Array<{
    kind: string;
    summary: string;
    payload: Record<string, unknown>;
    createdAt: string;
  }>;
  /** Long-term Assistant memories (top weight first), max 10. */
  memories: Array<{ fact: string; kind: string; weight: number }>;
  // Live signals — reuse these in every feature.
  lastSleepMinutes: number | null;
  lastMood: string | null;
  todaySpendVnd: number;
  monthSpendVnd: number;
  openHighPriorityTaskCount: number;
}

@Injectable()
export class UserContextService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly behavior: BehaviorService,
    private readonly events: EventLogService,
    private readonly memory: AssistantMemoryService,
  ) {}

  async build(userId: string): Promise<UserContext> {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60_000);

    const [profile, behavior, recentEvents, memories, lastSleep, lastMood, todayExp, monthExp, openHighTasks] =
      await Promise.all([
        this.prisma.userProfile.findUnique({ where: { userId } }),
        this.behavior.get(userId),
        this.events.recent(userId, 30),
        this.memory.top(userId, 10),
        this.prisma.sleepLog.findFirst({
          where: { userId },
          orderBy: { sleepAt: 'desc' },
          select: { durationMinutes: true },
        }),
        this.prisma.moodLog.findFirst({
          where: { userId },
          orderBy: { loggedAt: 'desc' },
          select: { mood: true },
        }),
        this.prisma.expense.findMany({
          where: { userId, deletedAt: null, expenseDate: { gte: todayStart, lt: todayEnd } },
          select: { amount: true },
        }),
        this.prisma.expense.findMany({
          where: { userId, deletedAt: null, expenseDate: { gte: monthStart } },
          select: { amount: true },
        }),
        this.prisma.task.count({
          where: {
            userId,
            deletedAt: null,
            status: { in: ['TODO', 'IN_PROGRESS'] },
            priority: 'HIGH',
          },
        }),
      ]);

    return {
      now: now.toISOString(),
      tz: profile?.timezone ?? 'Asia/Ho_Chi_Minh',
      profile: profile
        ? {
            preferredName: profile.preferredName,
            locale: profile.locale as 'vi' | 'en',
            mainGoals: Array.isArray(profile.mainGoals) ? (profile.mainGoals as string[]) : [],
            usualWakeTime: profile.usualWakeTime,
            usualSleepTime: profile.usualSleepTime,
            dislikes: Array.isArray(profile.dislikes) ? (profile.dislikes as string[]) : [],
            allergies: Array.isArray(profile.allergies) ? (profile.allergies as string[]) : [],
            monthlyGoal: profile.monthlyGoal,
            workPattern: profile.workPattern,
            budgetMonthly: profile.budgetMonthly == null ? null : Number(profile.budgetMonthly),
          }
        : null,
      behavior,
      recentEvents: recentEvents.map((e) => ({
        kind: e.kind,
        summary: e.summary,
        payload: (e.payload as Record<string, unknown>) ?? {},
        createdAt: e.createdAt.toISOString(),
      })),
      memories: memories.map((m) => ({
        fact: m.fact,
        kind: m.kind,
        weight: m.weight,
      })),
      lastSleepMinutes: lastSleep?.durationMinutes ?? null,
      lastMood: lastMood?.mood ?? null,
      todaySpendVnd: todayExp.reduce((s, e) => s + Number(e.amount), 0),
      monthSpendVnd: monthExp.reduce((s, e) => s + Number(e.amount), 0),
      openHighPriorityTaskCount: openHighTasks,
    };
  }
}
