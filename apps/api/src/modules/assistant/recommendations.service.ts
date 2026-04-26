import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import {
  AiRecommendationStatus,
  AiRecommendationPriority,
  AiRecommendationType,
  type AIRecommendation,
} from '@prisma/client';
import type {
  RecommendationPublic,
  RefreshRecommendationsResponse,
} from '@lifeos/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { generateForUser } from './recommendations.generator';

@Injectable()
export class RecommendationsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string): Promise<RecommendationPublic[]> {
    const rows = await this.prisma.aIRecommendation.findMany({
      where: {
        userId,
        status: { in: [AiRecommendationStatus.NEW, AiRecommendationStatus.VIEWED] },
      },
      orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
      take: 20,
    });
    return rows.map(toPublic);
  }

  async updateStatus(
    userId: string,
    id: string,
    status: 'VIEWED' | 'DISMISSED' | 'APPLIED',
  ): Promise<RecommendationPublic> {
    const row = await this.prisma.aIRecommendation.findUnique({ where: { id } });
    if (!row) {
      throw new NotFoundException({
        error: { code: 'NOT_FOUND', message: 'Gợi ý không tồn tại.' },
      });
    }
    if (row.userId !== userId) {
      throw new ForbiddenException({
        error: { code: 'FORBIDDEN', message: 'Không có quyền với gợi ý này.' },
      });
    }
    const updated = await this.prisma.aIRecommendation.update({
      where: { id },
      data: { status: status as AiRecommendationStatus },
    });
    return toPublic(updated);
  }

  /**
   * Re-run the rule-based generator. Old NEW recs are bumped to VIEWED so the
   * "new today" surface stays focused on what just came in.
   */
  async refresh(userId: string): Promise<RefreshRecommendationsResponse> {
    const privacy = await this.prisma.privacySetting.findUnique({ where: { userId } });
    if (!privacy) {
      // No settings row should not happen (auto-created at register), but
      // if it does we can't proceed without consent — return empty.
      return { generated: 0, rows: [] };
    }
    const drafts = await generateForUser(this.prisma, userId, privacy);

    // Move stale NEW → VIEWED so they stop showing as "new" if they aren't
    // re-emitted by the generator on this pass.
    await this.prisma.aIRecommendation.updateMany({
      where: { userId, status: AiRecommendationStatus.NEW },
      data: { status: AiRecommendationStatus.VIEWED },
    });

    const created: AIRecommendation[] = [];
    for (const d of drafts) {
      const row = await this.prisma.aIRecommendation.create({
        data: {
          userId,
          type: d.type as AiRecommendationType,
          title: d.title,
          content: d.content,
          priority: d.priority as AiRecommendationPriority,
          status: AiRecommendationStatus.NEW,
          evidence: d.evidence,
        },
      });
      created.push(row);
    }
    return { generated: created.length, rows: created.map(toPublic) };
  }
}

function toPublic(r: AIRecommendation): RecommendationPublic {
  return {
    id: r.id,
    type: r.type,
    title: r.title,
    content: r.content,
    priority: r.priority,
    status: r.status,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  };
}
