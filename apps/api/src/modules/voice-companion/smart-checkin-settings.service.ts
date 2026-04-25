import { Injectable } from '@nestjs/common';
import type { SmartCheckinSetting } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type { UpdateSmartCheckinSettingsInput } from '@planner/shared';

const DEFAULTS = {
  morningCheckinEnabled: true,
  mealCheckinEnabled: true,
  eveningReviewEnabled: true,
  sleepReminderEnabled: true,
  financeCheckinEnabled: true,
  morningTime: '07:30',
  eveningTime: '21:00',
  sleepReminderTime: '22:30',
};

/**
 * Smart-checkin settings — the "what notifications am I willing to get" layer.
 * Same lazy-defaults pattern as PrivacySettings: reads return in-memory
 * defaults until the first explicit PUT materialises a row.
 *
 * The actual notification dispatcher (cron + Expo push) lands in v1.3 — for
 * v1.2 we expose the toggles + the times so the UI is real and the consent
 * ledger captures user intent today.
 */
@Injectable()
export class SmartCheckinSettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async get(userId: string): Promise<SmartCheckinSetting> {
    const found = await this.prisma.smartCheckinSetting.findUnique({ where: { userId } });
    if (found) return found;
    return {
      id: '',
      userId,
      ...DEFAULTS,
      createdAt: new Date(0),
      updatedAt: new Date(0),
    } as SmartCheckinSetting;
  }

  update(userId: string, input: UpdateSmartCheckinSettingsInput): Promise<SmartCheckinSetting> {
    return this.prisma.smartCheckinSetting.upsert({
      where: { userId },
      create: { userId, ...DEFAULTS, ...input },
      update: input,
    });
  }
}
