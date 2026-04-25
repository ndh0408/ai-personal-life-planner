import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { AICompanionMemory } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CommunicationSettingsService } from './communication-settings.service';
import type {
  AiCompanionMemoryTypeDto,
  CreateAiCompanionMemoryInput,
  UpdateAiCompanionMemoryInput,
} from '@planner/shared';

const SENSITIVE_TYPES: ReadonlySet<AiCompanionMemoryTypeDto> = new Set([
  'HEALTH_CONTEXT',
  'FINANCE_CONTEXT',
  'RELATIONSHIP',
]);

/**
 * AI Companion memory store. The mobile app surfaces these as
 * "things AI remembers about you" with view/edit/delete and a Clear-all
 * action. Sensitive memory types (health/finance/relationship) require
 * the user to confirm at the source — the service refuses to write them
 * unless `userConfirmed: true` is passed by the caller.
 */
@Injectable()
export class CompanionMemoryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: CommunicationSettingsService,
  ) {}

  list(userId: string, type?: AiCompanionMemoryTypeDto): Promise<AICompanionMemory[]> {
    return this.prisma.aICompanionMemory.findMany({
      where: { userId, ...(type ? { memoryType: type } : {}) },
      orderBy: [{ isActive: 'desc' }, { updatedAt: 'desc' }],
      take: 200,
    });
  }

  async create(
    userId: string,
    input: CreateAiCompanionMemoryInput,
    /** Required for SENSITIVE_TYPES; producer must pass true after a user confirm. */
    userConfirmed = false,
  ): Promise<AICompanionMemory> {
    const settings = await this.settings.getSettings(userId);
    if (!settings.aiMemoryEnabled) {
      throw new ForbiddenException({
        message: 'AI memory is disabled in settings',
        errorCode: 'AI_MEMORY_DISABLED',
      });
    }
    if (SENSITIVE_TYPES.has(input.memoryType) && !userConfirmed) {
      throw new ForbiddenException({
        message: 'Sensitive memory requires explicit user confirmation',
        errorCode: 'SENSITIVE_MEMORY_REQUIRES_CONFIRM',
      });
    }
    return this.prisma.aICompanionMemory.create({
      data: {
        userId,
        memoryType: input.memoryType,
        content: input.content.slice(0, 600),
        source: input.source,
        confidence: input.confidence ?? null,
      },
    });
  }

  async update(
    userId: string,
    id: string,
    input: UpdateAiCompanionMemoryInput,
  ): Promise<AICompanionMemory> {
    const owns = await this.assertOwn(userId, id);
    return this.prisma.aICompanionMemory.update({
      where: { id: owns.id },
      data: {
        ...(input.content !== undefined ? { content: input.content.slice(0, 600) } : {}),
        ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      },
    });
  }

  async delete(userId: string, id: string): Promise<void> {
    const owns = await this.assertOwn(userId, id);
    await this.prisma.aICompanionMemory.delete({ where: { id: owns.id } });
  }

  /** Soft-clear: flip isActive=false on every active row. Audit trail kept. */
  async clearAll(userId: string): Promise<{ cleared: number }> {
    const r = await this.prisma.aICompanionMemory.updateMany({
      where: { userId, isActive: true },
      data: { isActive: false },
    });
    return { cleared: r.count };
  }

  private async assertOwn(userId: string, id: string): Promise<AICompanionMemory> {
    const row = await this.prisma.aICompanionMemory.findUnique({ where: { id } });
    if (!row) {
      throw new NotFoundException({ message: 'Memory not found', errorCode: 'NOT_FOUND' });
    }
    if (row.userId !== userId) {
      throw new ForbiddenException({ errorCode: 'FORBIDDEN' });
    }
    return row;
  }
}
