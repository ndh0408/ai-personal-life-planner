import { Injectable } from '@nestjs/common';
import type { HealthIntegrationSetting } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type { UpdateHealthIntegrationInput } from '@planner/shared';

const DEFAULTS = {
  provider: 'NONE' as const,
  readSleep: false,
  readSteps: false,
  readExercise: false,
  readHeartRate: false,
  readWeight: false,
};

/**
 * Health/fitness integration — settings + (eventual) sync.
 *
 * v1.2 ships the contract only: the matching toggles + the per-data-type
 * read flags + the lastSyncedAt column. Native HealthKit / Health Connect
 * adapters land in v1.3 (Expo modules + native bridges).
 *
 * The DTO surfaces `nativeAvailable: false` so mobile shows a clear
 * "not yet wired in this build" state.
 */
@Injectable()
export class HealthIntegrationService {
  constructor(private readonly prisma: PrismaService) {}

  async get(userId: string): Promise<HealthIntegrationSetting> {
    const found = await this.prisma.healthIntegrationSetting.findUnique({ where: { userId } });
    if (found) return found;
    return {
      id: '',
      userId,
      ...DEFAULTS,
      lastSyncedAt: null,
      createdAt: new Date(0),
      updatedAt: new Date(0),
    } as HealthIntegrationSetting;
  }

  update(
    userId: string,
    input: UpdateHealthIntegrationInput,
  ): Promise<HealthIntegrationSetting> {
    return this.prisma.healthIntegrationSetting.upsert({
      where: { userId },
      create: { userId, ...DEFAULTS, ...input },
      update: input,
    });
  }
}
