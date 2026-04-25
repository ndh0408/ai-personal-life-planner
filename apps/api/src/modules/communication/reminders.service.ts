import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type {
  EmailReminder,
  MessageReminder,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type {
  CreateEmailReminderInput,
  CreateMessageReminderInput,
  EmailReminderStatusDto,
  MessageReminderStatusDto,
} from '@planner/shared';

/**
 * Email + message reminders. Both are user-owned, ownership-scoped to the
 * JWT subject. Manual creation only — automated AI suggestions still
 * require a user confirm before persistence (see AiCommunicationService).
 */
@Injectable()
export class RemindersService {
  constructor(private readonly prisma: PrismaService) {}

  // ---- Email reminders -----------------------------------------------------

  listEmailReminders(userId: string): Promise<EmailReminder[]> {
    return this.prisma.emailReminder.findMany({
      where: { userId },
      orderBy: [{ status: 'asc' }, { remindAt: 'asc' }],
      take: 200,
    });
  }

  async createEmailReminder(
    userId: string,
    input: CreateEmailReminderInput,
  ): Promise<EmailReminder> {
    if (input.emailItemId) {
      const owns = await this.prisma.emailItem.findFirst({
        where: { id: input.emailItemId, userId },
        select: { id: true },
      });
      if (!owns) {
        throw new NotFoundException({ message: 'Email not found', errorCode: 'NOT_FOUND' });
      }
    }
    return this.prisma.emailReminder.create({
      data: {
        userId,
        emailItemId: input.emailItemId ?? null,
        title: input.title,
        note: input.note ?? null,
        remindAt: new Date(input.remindAt),
      },
    });
  }

  async updateEmailReminderStatus(
    userId: string,
    id: string,
    status: EmailReminderStatusDto,
  ): Promise<EmailReminder> {
    const owns = await this.assertOwnsEmailReminder(userId, id);
    return this.prisma.emailReminder.update({ where: { id: owns.id }, data: { status } });
  }

  async deleteEmailReminder(userId: string, id: string): Promise<void> {
    const owns = await this.assertOwnsEmailReminder(userId, id);
    await this.prisma.emailReminder.delete({ where: { id: owns.id } });
  }

  private async assertOwnsEmailReminder(userId: string, id: string): Promise<EmailReminder> {
    const r = await this.prisma.emailReminder.findUnique({ where: { id } });
    if (!r) throw new NotFoundException({ message: 'Reminder not found', errorCode: 'NOT_FOUND' });
    if (r.userId !== userId) throw new ForbiddenException({ errorCode: 'FORBIDDEN' });
    return r;
  }

  // ---- Message reminders ---------------------------------------------------

  listMessageReminders(userId: string): Promise<MessageReminder[]> {
    return this.prisma.messageReminder.findMany({
      where: { userId },
      orderBy: [{ status: 'asc' }, { remindAt: 'asc' }],
      take: 200,
    });
  }

  createMessageReminder(
    userId: string,
    input: CreateMessageReminderInput,
  ): Promise<MessageReminder> {
    const data: Prisma.MessageReminderCreateInput = {
      user: { connect: { id: userId } },
      contactName: input.contactName ?? null,
      platform: input.platform ?? null,
      title: input.title,
      note: input.note ?? null,
      remindAt: new Date(input.remindAt),
      source: input.source ?? 'MANUAL',
    };
    return this.prisma.messageReminder.create({ data });
  }

  async updateMessageReminderStatus(
    userId: string,
    id: string,
    status: MessageReminderStatusDto,
  ): Promise<MessageReminder> {
    const owns = await this.assertOwnsMessageReminder(userId, id);
    return this.prisma.messageReminder.update({ where: { id: owns.id }, data: { status } });
  }

  async deleteMessageReminder(userId: string, id: string): Promise<void> {
    const owns = await this.assertOwnsMessageReminder(userId, id);
    await this.prisma.messageReminder.delete({ where: { id: owns.id } });
  }

  private async assertOwnsMessageReminder(userId: string, id: string): Promise<MessageReminder> {
    const r = await this.prisma.messageReminder.findUnique({ where: { id } });
    if (!r) throw new NotFoundException({ message: 'Reminder not found', errorCode: 'NOT_FOUND' });
    if (r.userId !== userId) throw new ForbiddenException({ errorCode: 'FORBIDDEN' });
    return r;
  }
}
