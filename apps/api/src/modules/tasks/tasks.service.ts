import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { Prisma, TaskStatus } from '@prisma/client';
import type {
  CreateTaskInput,
  UpdateTaskInput,
  ListTasksQuery,
  PatchTaskStatusInput,
} from '@planner/shared';
import { PrismaService } from '../../prisma/prisma.service';

function dayBounds(yyyyMmDd: string): { gte: Date; lt: Date } {
  const [y, m, d] = yyyyMmDd.split('-').map(Number);
  const gte = new Date(Date.UTC(y, m - 1, d, 0, 0, 0, 0));
  const lt = new Date(Date.UTC(y, m - 1, d + 1, 0, 0, 0, 0));
  return { gte, lt };
}

@Injectable()
export class TasksService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string, query: ListTasksQuery) {
    const where: Prisma.TaskWhereInput = { userId, deletedAt: null };

    if (query.status) where.status = query.status;
    if (query.priority) where.priority = query.priority;
    if (query.category) where.category = query.category;
    if (query.q) where.title = { contains: query.q, mode: 'insensitive' };
    if (query.dueDate) where.dueDate = dayBounds(query.dueDate);

    const orderBy = this.buildOrderBy(query.sortBy, query.sortDir);

    const [items, total] = await this.prisma.$transaction([
      this.prisma.task.findMany({
        where,
        orderBy,
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.task.count({ where }),
    ]);

    return {
      items,
      total,
      page: query.page,
      limit: query.limit,
      totalPages: Math.max(1, Math.ceil(total / query.limit)),
    };
  }

  async getById(userId: string, id: string) {
    const task = await this.prisma.task.findUnique({ where: { id } });
    if (!task || task.deletedAt) throw new NotFoundException('Task not found');
    if (task.userId !== userId) throw new ForbiddenException();
    return task;
  }

  async create(userId: string, input: CreateTaskInput) {
    return this.prisma.task.create({
      data: {
        userId,
        title: input.title,
        description: input.description ?? null,
        priority: input.priority,
        dueDate: input.dueDate ? new Date(input.dueDate) : null,
        estimatedMinutes: input.estimatedMinutes ?? null,
        category: input.category ?? null,
      },
    });
  }

  async update(userId: string, id: string, input: UpdateTaskInput) {
    await this.getById(userId, id);

    const data: Prisma.TaskUpdateInput = {};
    if (input.title !== undefined) data.title = input.title;
    if (input.description !== undefined) data.description = input.description;
    if (input.priority !== undefined) data.priority = input.priority;
    if (input.estimatedMinutes !== undefined) data.estimatedMinutes = input.estimatedMinutes;
    if (input.category !== undefined) data.category = input.category;
    if (input.dueDate !== undefined) {
      data.dueDate = input.dueDate ? new Date(input.dueDate) : null;
    }
    if (input.status !== undefined) {
      data.status = input.status;
      data.completedAt = input.status === TaskStatus.COMPLETED ? new Date() : null;
    }

    return this.prisma.task.update({ where: { id }, data });
  }

  async patchStatus(userId: string, id: string, input: PatchTaskStatusInput) {
    await this.getById(userId, id);
    return this.prisma.task.update({
      where: { id },
      data: {
        status: input.status,
        completedAt: input.status === TaskStatus.COMPLETED ? new Date() : null,
      },
    });
  }

  async delete(userId: string, id: string) {
    await this.getById(userId, id);
    // Soft delete (round 14): keep the row so audit + history queries work.
    await this.prisma.task.update({ where: { id }, data: { deletedAt: new Date() } });
  }

  private buildOrderBy(
    sortBy: ListTasksQuery['sortBy'],
    sortDir: ListTasksQuery['sortDir'],
  ): Prisma.TaskOrderByWithRelationInput[] {
    if (sortBy === 'priority') {
      return [{ priority: sortDir }, { createdAt: 'desc' }];
    }
    if (sortBy === 'dueDate') {
      return [{ dueDate: { sort: sortDir, nulls: 'last' } }, { createdAt: 'desc' }];
    }
    return [{ [sortBy]: sortDir } as Prisma.TaskOrderByWithRelationInput];
  }
}
