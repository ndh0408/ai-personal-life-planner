/**
 * Read/write the user's PrivacySetting row.
 *
 * Tightly coupled to UserContextService.invalidate() because flipping a
 * privacy flag *must* drop the snapshot cache — otherwise the next AI call
 * would still see the disabled domain for up to 60 s.
 */
import { Injectable, NotFoundException } from '@nestjs/common';
import type { PrivacySettingPublic, UpdatePrivacyRequest } from '@lifeos/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { UserContextService } from '../intelligence/user-context.service';

@Injectable()
export class PrivacyService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly userCtx: UserContextService,
  ) {}

  async get(userId: string): Promise<PrivacySettingPublic> {
    let row = await this.prisma.privacySetting.findUnique({ where: { userId } });
    if (!row) {
      // The auth.register() flow auto-creates a PrivacySetting row, so this
      // branch only runs for users created before that landed.
      row = await this.prisma.privacySetting.create({ data: { userId } });
    }
    return toPublic(row);
  }

  async update(userId: string, input: UpdatePrivacyRequest): Promise<PrivacySettingPublic> {
    // Upsert so we don't crash if the row was never seeded.
    const row = await this.prisma.privacySetting.upsert({
      where: { userId },
      create: { userId, ...input },
      update: { ...input },
    });
    // Drop the snapshot cache so the next AI turn reflects the new flags.
    await this.userCtx.invalidate(userId);
    return toPublic(row);
  }
}

function toPublic(r: {
  personalizationEnabled: boolean;
  useFinanceForAI: boolean;
  useHealthForAI: boolean;
  useMealsForAI: boolean;
  useTasksForAI: boolean;
  aiMemoryEnabled: boolean;
  proactiveRecommendations: boolean;
  updatedAt: Date;
}): PrivacySettingPublic {
  return {
    personalizationEnabled: r.personalizationEnabled,
    useFinanceForAI: r.useFinanceForAI,
    useHealthForAI: r.useHealthForAI,
    useMealsForAI: r.useMealsForAI,
    useTasksForAI: r.useTasksForAI,
    aiMemoryEnabled: r.aiMemoryEnabled,
    proactiveRecommendations: r.proactiveRecommendations,
    updatedAt: r.updatedAt.toISOString(),
  };
}

// Quiet the unused import — kept for callers that might 404 in the future.
void NotFoundException;
