import { Injectable } from '@nestjs/common';
import { TaskStatus, type Task } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { rangeFor, type RangeName } from '../../common/datetime/range';

export interface TaskRow {
  id: string;
  title: string;
  description: string | null;
  dueAt: string | null;
  priority: 'LOW' | 'MEDIUM' | 'HIGH';
  status: 'TODO' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  completedAt: string | null;
  createdAt: string;
}

export interface TaskListResponse {
  range: RangeName | null;
  total: number;
  doneCount: number;
  rows: TaskRow[];
}

@Injectable()
export class TasksService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string, range: RangeName | null): Promise<TaskListResponse> {
    const where = baseWhere(userId);
    if (range) {
      const { start, end } = rangeFor(range);
      Object.assign(where, {
        OR: [
          { dueAt: { gte: start, lt: end } },
          // Tasks with no due date that were created today still belong on Today.
          range === 'today'
            ? { dueAt: null, createdAt: { gte: start, lt: end } }
            : undefined,
        ].filter(Boolean),
      });
    }
    const rows = await this.prisma.task.findMany({
      where,
      orderBy: [{ status: 'asc' }, { dueAt: 'asc' }, { createdAt: 'desc' }],
      take: 100,
    });
    return {
      range,
      total: rows.length,
      doneCount: rows.filter((t) => t.status === TaskStatus.COMPLETED).length,
      rows: rows.map(toRow),
    };
  }
}

function baseWhere(userId: string) {
  return { userId, deletedAt: null };
}

function toRow(t: Task): TaskRow {
  return {
    id: t.id,
    title: t.title,
    description: t.description,
    dueAt: t.dueAt ? t.dueAt.toISOString() : null,
    priority: t.priority,
    status: t.status,
    completedAt: t.completedAt ? t.completedAt.toISOString() : null,
    createdAt: t.createdAt.toISOString(),
  };
}
