import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { GoalCategory, PersonalGoalStatus, Prisma, Priority } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

export type CreateGoalInput = {
  title: string;
  description?: string;
  category: GoalCategory;
  targetValue?: number;
  currentValue?: number;
  unit?: string;
  deadline?: string; // YYYY-MM-DD
  priority?: Priority;
};

export type UpdateGoalInput = Partial<CreateGoalInput> & { status?: PersonalGoalStatus };

function toDate(yyyyMmDd: string): Date {
  return new Date(`${yyyyMmDd}T00:00:00.000Z`);
}

@Injectable()
export class GoalsService {
  constructor(private readonly prisma: PrismaService) {}

  list(userId: string) {
    return this.prisma.personalGoal.findMany({
      where: { userId },
      include: { milestones: { orderBy: { createdAt: 'asc' } } },
      orderBy: [{ status: 'asc' }, { priority: 'desc' }, { deadline: 'asc' }],
    });
  }

  async getById(userId: string, id: string) {
    const goal = await this.prisma.personalGoal.findUnique({
      where: { id },
      include: { milestones: { orderBy: { createdAt: 'asc' } } },
    });
    if (!goal) throw new NotFoundException({ message: 'Goal not found', errorCode: 'NOT_FOUND' });
    if (goal.userId !== userId) throw new ForbiddenException({ errorCode: 'FORBIDDEN' });
    return goal;
  }

  create(userId: string, input: CreateGoalInput) {
    return this.prisma.personalGoal.create({
      data: {
        userId,
        title: input.title,
        description: input.description ?? null,
        category: input.category,
        targetValue: input.targetValue ?? null,
        currentValue: input.currentValue ?? null,
        unit: input.unit ?? null,
        deadline: input.deadline ? toDate(input.deadline) : null,
        priority: input.priority ?? Priority.MEDIUM,
      },
    });
  }

  async update(userId: string, id: string, input: UpdateGoalInput) {
    await this.getById(userId, id);
    const data: Prisma.PersonalGoalUpdateInput = {};
    if (input.title !== undefined) data.title = input.title;
    if (input.description !== undefined) data.description = input.description;
    if (input.category !== undefined) data.category = input.category;
    if (input.targetValue !== undefined) data.targetValue = input.targetValue;
    if (input.currentValue !== undefined) data.currentValue = input.currentValue;
    if (input.unit !== undefined) data.unit = input.unit;
    if (input.priority !== undefined) data.priority = input.priority;
    if (input.status !== undefined) data.status = input.status;
    if (input.deadline !== undefined) {
      data.deadline = input.deadline ? toDate(input.deadline) : null;
    }
    return this.prisma.personalGoal.update({ where: { id }, data });
  }

  async delete(userId: string, id: string) {
    await this.getById(userId, id);
    // milestones cascade.
    await this.prisma.personalGoal.delete({ where: { id } });
  }
}
