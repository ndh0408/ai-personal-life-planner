import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { dateToHhmm, hhmmToDate } from '../../common/utils/time.util';

export type UpdateSettingsInput = {
  wakeReminder?: boolean;
  sleepReminder?: boolean;
  mealReminder?: boolean;
  taskReminder?: boolean;
  habitReminder?: boolean;
  moodCheckinReminder?: boolean;
  quietHoursStart?: string | null;
  quietHoursEnd?: string | null;
};

export type RegisterDeviceInput = {
  platform: 'IOS' | 'ANDROID' | 'WEB';
  pushToken: string;
  deviceName?: string;
};

function serializeSettings(s: {
  wakeReminder: boolean;
  sleepReminder: boolean;
  mealReminder: boolean;
  taskReminder: boolean;
  habitReminder: boolean;
  moodCheckinReminder: boolean;
  quietHoursStart: Date | null;
  quietHoursEnd: Date | null;
}) {
  return {
    wakeReminder: s.wakeReminder,
    sleepReminder: s.sleepReminder,
    mealReminder: s.mealReminder,
    taskReminder: s.taskReminder,
    habitReminder: s.habitReminder,
    moodCheckinReminder: s.moodCheckinReminder,
    quietHoursStart: dateToHhmm(s.quietHoursStart),
    quietHoursEnd: dateToHhmm(s.quietHoursEnd),
  };
}

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async getSettings(userId: string) {
    const s = await this.prisma.notificationSetting.upsert({
      where: { userId },
      update: {},
      create: { userId },
    });
    return serializeSettings(s);
  }

  async updateSettings(userId: string, input: UpdateSettingsInput) {
    const data: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(input)) {
      if (v === undefined) continue;
      if (k === 'quietHoursStart' || k === 'quietHoursEnd') {
        data[k] = v === null ? null : hhmmToDate(v as string);
      } else {
        data[k] = v;
      }
    }
    const s = await this.prisma.notificationSetting.upsert({
      where: { userId },
      update: data,
      create: { userId, ...data },
    });
    return serializeSettings(s);
  }

  async registerDevice(userId: string, input: RegisterDeviceInput) {
    return this.prisma.notificationDevice.upsert({
      where: { userId_pushToken: { userId, pushToken: input.pushToken } },
      update: {
        platform: input.platform,
        deviceName: input.deviceName,
        isActive: true,
      },
      create: {
        userId,
        platform: input.platform,
        pushToken: input.pushToken,
        deviceName: input.deviceName,
      },
      select: { id: true, platform: true, deviceName: true, isActive: true, createdAt: true },
    });
  }

  async listDevices(userId: string) {
    return this.prisma.notificationDevice.findMany({
      where: { userId },
      select: { id: true, platform: true, deviceName: true, isActive: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async removeDevice(userId: string, id: string): Promise<void> {
    const result = await this.prisma.notificationDevice.deleteMany({ where: { id, userId } });
    if (result.count === 0) {
      const exists = await this.prisma.notificationDevice.findUnique({ where: { id } });
      if (!exists) {
        throw new NotFoundException({ message: 'Device not found', errorCode: 'NOT_FOUND' });
      }
      throw new ForbiddenException({
        message: 'Device not owned by caller',
        errorCode: 'FORBIDDEN',
      });
    }
  }

  async listLogs(userId: string, limit = 20) {
    return this.prisma.notificationLog.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: Math.min(Math.max(limit, 1), 100),
      select: {
        id: true,
        title: true,
        body: true,
        type: true,
        status: true,
        scheduledAt: true,
        sentAt: true,
        createdAt: true,
      },
    });
  }
}
