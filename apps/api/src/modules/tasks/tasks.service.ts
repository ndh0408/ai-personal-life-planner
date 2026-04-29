import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { TaskStatus, type Task } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { rangeFor, type RangeName } from '../../common/datetime/range';
import { EventLogService } from '../intelligence/event-log.service';

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

export interface CreateTaskInput {
  title: string;
  description?: string | null;
  dueAt?: string | null;
  priority?: 'LOW' | 'MEDIUM' | 'HIGH';
}

export interface UpdateTaskInput {
  title?: string;
  description?: string | null;
  dueAt?: string | null;
  priority?: 'LOW' | 'MEDIUM' | 'HIGH';
  status?: 'TODO' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
}

@Injectable()
export class TasksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventLogService,
  ) {}

  async list(userId: string, range: RangeName | null): Promise<TaskListResponse> {
    const where = baseWhere(userId);
    if (range) {
      const { start, end } = rangeFor(range);
      Object.assign(where, {
        OR: [
          { dueAt: { gte: start, lt: end } },
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

  async create(userId: string, input: CreateTaskInput): Promise<TaskRow> {
    const row = await this.prisma.task.create({
      data: {
        userId,
        title: input.title.trim(),
        description: input.description?.trim() || null,
        dueAt: input.dueAt ? new Date(input.dueAt) : null,
        priority: input.priority ?? 'MEDIUM',
        status: 'TODO',
      },
    });
    return toRow(row);
  }

  async update(userId: string, id: string, input: UpdateTaskInput): Promise<TaskRow> {
    await this.assertOwn(userId, id);
    const data: Record<string, unknown> = {};
    if (input.title !== undefined) data.title = input.title.trim();
    if (input.description !== undefined) data.description = input.description?.trim() || null;
    if (input.dueAt !== undefined) data.dueAt = input.dueAt ? new Date(input.dueAt) : null;
    if (input.priority !== undefined) data.priority = input.priority;
    if (input.status !== undefined) {
      data.status = input.status;
      data.completedAt = input.status === 'COMPLETED' ? new Date() : null;
    }
    const row = await this.prisma.task.update({ where: { id }, data });
    return toRow(row);
  }

  async complete(userId: string, id: string): Promise<TaskRow> {
    await this.assertOwn(userId, id);
    const row = await this.prisma.task.update({
      where: { id },
      data: { status: 'COMPLETED', completedAt: new Date() },
    });
    await this.events.log(userId, 'TASK_COMPLETED', row.title, {
      id: row.id,
      priority: row.priority,
    });
    return toRow(row);
  }

  async softDelete(userId: string, id: string): Promise<{ id: string }> {
    await this.assertOwn(userId, id);
    const row = await this.prisma.task.findUnique({ where: { id }, select: { title: true } });
    await this.prisma.task.update({ where: { id }, data: { deletedAt: new Date() } });
    if (row) await this.events.log(userId, 'TASK_DELETED', row.title, { id });
    return { id };
  }

  private async assertOwn(userId: string, id: string): Promise<void> {
    const t = await this.prisma.task.findUnique({
      where: { id },
      select: { userId: true, deletedAt: true },
    });
    if (!t || t.deletedAt) {
      throw new NotFoundException({
        error: { code: 'NOT_FOUND', message: 'Task không tồn tại.' },
      });
    }
    if (t.userId !== userId) {
      throw new ForbiddenException({
        error: { code: 'FORBIDDEN', message: 'Không có quyền với task này.' },
      });
    }
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
