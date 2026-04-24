import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function dayBounds(date: string): { from: Date; to: Date } {
  const from = startOfDay(new Date(`${date}T00:00:00.000Z`));
  const to = new Date(from.getTime() + 24 * 60 * 60 * 1000);
  return { from, to };
}

function rangeBounds(from: string, to: string): { from: Date; to: Date } {
  const start = startOfDay(new Date(`${from}T00:00:00.000Z`));
  const end = new Date(`${to}T00:00:00.000Z`);
  end.setUTCHours(23, 59, 59, 999);
  return { from: start, to: end };
}

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Aggregates a single day for the caller:
   *   - tasks due on that day + status breakdown
   *   - habits logged / target breakdown
   *   - sleep + mood snapshots
   *
   * Deep AI insights belong to AiModule; this service only returns structured data.
   */
  async daily(userId: string, date: string) {
    const { from, to } = dayBounds(date);

    const [tasks, habitLogs, totalHabits, sleep, mood, schedule] = await Promise.all([
      this.prisma.task.findMany({
        where: { userId, dueDate: { gte: from, lt: to } },
        select: { id: true, title: true, status: true, priority: true, estimatedMinutes: true },
      }),
      this.prisma.habitLog.findMany({
        where: { userId, date: from },
        select: { id: true, habitId: true, completed: true, count: true },
      }),
      this.prisma.habit.count({ where: { userId, isActive: true } }),
      this.prisma.sleepLog.findFirst({
        where: { userId, date: from },
        select: { durationMinutes: true, quality: true },
      }),
      this.prisma.moodLog.findFirst({
        where: { userId, date: from },
        select: { mood: true, energyLevel: true, stressLevel: true },
      }),
      this.prisma.dailySchedule.findFirst({
        where: { userId, date: from },
        select: { id: true, status: true, items: { select: { status: true } } },
      }),
    ]);

    const taskByStatus = tasks.reduce<Record<string, number>>((acc, t) => {
      acc[t.status] = (acc[t.status] ?? 0) + 1;
      return acc;
    }, {});

    const habitsCompleted = habitLogs.filter((l) => l.completed).length;
    const scheduleItemsTotal = schedule?.items.length ?? 0;
    const scheduleItemsDone = schedule?.items.filter((i) => i.status === 'COMPLETED').length ?? 0;

    return {
      date,
      tasks: {
        total: tasks.length,
        byStatus: taskByStatus,
        totalEstimatedMinutes: tasks.reduce((sum, t) => sum + (t.estimatedMinutes ?? 0), 0),
      },
      habits: {
        active: totalHabits,
        logged: habitLogs.length,
        completed: habitsCompleted,
      },
      schedule: schedule
        ? {
            id: schedule.id,
            status: schedule.status,
            items: { total: scheduleItemsTotal, completed: scheduleItemsDone },
          }
        : null,
      sleep: sleep ?? null,
      mood: mood ?? null,
    };
  }

  async weekly(userId: string, from: string, to: string) {
    const range = rangeBounds(from, to);

    const [tasks, habitLogs, sleepLogs, moodLogs] = await Promise.all([
      this.prisma.task.groupBy({
        by: ['status'],
        where: { userId, dueDate: { gte: range.from, lte: range.to } },
        _count: { _all: true },
      }),
      this.prisma.habitLog.count({
        where: { userId, date: { gte: range.from, lte: range.to }, completed: true },
      }),
      this.prisma.sleepLog.findMany({
        where: { userId, date: { gte: range.from, lte: range.to } },
        select: { durationMinutes: true, quality: true, date: true },
        orderBy: { date: 'asc' },
      }),
      this.prisma.moodLog.findMany({
        where: { userId, date: { gte: range.from, lte: range.to } },
        select: { mood: true, energyLevel: true, stressLevel: true, date: true },
        orderBy: { date: 'asc' },
      }),
    ]);

    const sleepAvg =
      sleepLogs.length > 0
        ? Math.round(
            sleepLogs.reduce((s, x) => s + (x.durationMinutes ?? 0), 0) / sleepLogs.length,
          )
        : null;

    return {
      from,
      to,
      tasks: {
        byStatus: Object.fromEntries(tasks.map((t) => [t.status, t._count._all])),
      },
      habits: { completed: habitLogs },
      sleep: { averageMinutes: sleepAvg, entries: sleepLogs },
      mood: { entries: moodLogs },
    };
  }
}
