import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

function dayBounds(date: string): { start: Date; end: Date } {
  const start = new Date(`${date}T00:00:00.000Z`);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { start, end };
}

@Injectable()
export class PlannerService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Façade endpoint the mobile app hits on the Today tab.
   * Combines daily schedule + items + tasks due today + habits + mood snapshot
   * in a single call to minimize round-trips.
   */
  async today(userId: string, date: string) {
    const { start, end } = dayBounds(date);

    const [schedule, tasks, habits, mood] = await Promise.all([
      this.prisma.dailySchedule.findFirst({
        where: { userId, date: start },
        include: { items: { orderBy: { startTime: 'asc' } } },
      }),
      this.prisma.task.findMany({
        where: {
          userId,
          OR: [
            { dueDate: { gte: start, lt: end } },
            { status: { in: ['TODO', 'IN_PROGRESS'] }, dueDate: null },
          ],
        },
        orderBy: [{ priority: 'desc' }, { dueDate: 'asc' }],
        take: 20,
      }),
      this.prisma.habit.findMany({
        where: { userId, isActive: true },
        include: { logs: { where: { date: start }, take: 1 } },
      }),
      this.prisma.moodLog.findFirst({
        where: { userId, date: start },
        select: { mood: true, energyLevel: true, stressLevel: true },
      }),
    ]);

    return {
      date,
      schedule: schedule ?? null,
      tasks,
      habits: habits.map((h) => ({
        id: h.id,
        name: h.name,
        targetCount: h.targetCount,
        todayLog: h.logs[0] ?? null,
      })),
      mood,
    };
  }
}
