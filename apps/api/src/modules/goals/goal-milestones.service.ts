import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { MilestoneStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

export type CreateMilestoneInput = {
  title: string;
  targetDate?: string; // YYYY-MM-DD
};

export type UpdateMilestoneInput = Partial<CreateMilestoneInput> & { status?: MilestoneStatus };

function toDate(yyyyMmDd: string): Date {
  return new Date(`${yyyyMmDd}T00:00:00.000Z`);
}

@Injectable()
export class GoalMilestonesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, goalId: string, input: CreateMilestoneInput) {
    const goal = await this.prisma.personalGoal.findUnique({ where: { id: goalId } });
    if (!goal) throw new NotFoundException({ message: 'Goal not found', errorCode: 'NOT_FOUND' });
    if (goal.userId !== userId) throw new ForbiddenException({ errorCode: 'FORBIDDEN' });

    return this.prisma.goalMilestone.create({
      data: {
        goalId,
        userId,
        title: input.title,
        targetDate: input.targetDate ? toDate(input.targetDate) : null,
      },
    });
  }

  async update(userId: string, id: string, input: UpdateMilestoneInput) {
    const existing = await this.getById(userId, id);
    const data: Prisma.GoalMilestoneUpdateInput = {};
    if (input.title !== undefined) data.title = input.title;
    if (input.targetDate !== undefined) {
      data.targetDate = input.targetDate ? toDate(input.targetDate) : null;
    }
    if (input.status !== undefined) {
      data.status = input.status;
      data.completedAt =
        input.status === MilestoneStatus.COMPLETED ? new Date() : existing.completedAt;
    }
    return this.prisma.goalMilestone.update({ where: { id }, data });
  }

  async patchStatus(userId: string, id: string, status: MilestoneStatus) {
    await this.getById(userId, id);
    return this.prisma.goalMilestone.update({
      where: { id },
      data: {
        status,
        completedAt: status === MilestoneStatus.COMPLETED ? new Date() : null,
      },
    });
  }

  async delete(userId: string, id: string) {
    await this.getById(userId, id);
    await this.prisma.goalMilestone.delete({ where: { id } });
  }

  private async getById(userId: string, id: string) {
    const row = await this.prisma.goalMilestone.findUnique({ where: { id } });
    if (!row) throw new NotFoundException({ message: 'Milestone not found', errorCode: 'NOT_FOUND' });
    if (row.userId !== userId) throw new ForbiddenException({ errorCode: 'FORBIDDEN' });
    return row;
  }
}
