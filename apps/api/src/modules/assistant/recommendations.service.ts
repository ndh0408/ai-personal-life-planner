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
import { InsightGenerator } from '../intelligence/insight.generator';
import { EventLogService } from '../intelligence/event-log.service';

@Injectable()
export class RecommendationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly insight: InsightGenerator,
    private readonly events: EventLogService,
  ) {}

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
    // Event-log dismissals + applies so future insights know not to repeat.
    if (status === 'DISMISSED') {
      await this.events.log(userId, 'INSIGHT_DISMISSED', updated.title, { id, type: updated.type });
    } else if (status === 'APPLIED') {
      await this.events.log(userId, 'INSIGHT_LIKED', updated.title, { id, type: updated.type });
    }
    return toPublic(updated);
  }

  /**
   * Re-run the recommendation pipeline. Round-18 prefers the LLM-driven
   * Insight generator (reads full UserContext) when an AI key is available,
   * falling back to the deterministic rule generator otherwise. Old NEW
   * recs are bumped to VIEWED before new ones land.
   */
  async refresh(userId: string): Promise<RefreshRecommendationsResponse> {
    const privacy = await this.prisma.privacySetting.findUnique({ where: { userId } });
    if (!privacy) return { generated: 0, rows: [] };

    let drafts = await this.insight.generate(userId);
    if (!drafts || drafts.length === 0) {
      drafts = await generateForUser(this.prisma, userId, privacy);
    }

    await this.prisma.aIRecommendation.updateMany({
      where: { userId, status: AiRecommendationStatus.NEW },
      data: { status: AiRecommendationStatus.VIEWED },
    });

    const created: AIRecommendation[] = [];
    for (const d of drafts) {
      const draftWithExtras = d as typeof d & {
        explainText?: string;
        evidenceItems?: Array<{ label: string; value: string; source?: string }>;
      };
      // Round 37: persist explainText + structured evidence items so the
      // mobile "Why this?" sheet can render without re-deriving anything.
      // Items live alongside the legacy free-form `evidence` JSON.
      const evidenceJson =
        draftWithExtras.evidenceItems && draftWithExtras.evidenceItems.length > 0
          ? {
              ...((d.evidence as Record<string, unknown>) ?? {}),
              items: draftWithExtras.evidenceItems,
            }
          : d.evidence;
      const row = await this.prisma.aIRecommendation.create({
        data: {
          userId,
          type: d.type as AiRecommendationType,
          title: d.title,
          content: d.content,
          priority: d.priority as AiRecommendationPriority,
          status: AiRecommendationStatus.NEW,
          evidence: evidenceJson,
          explainText: draftWithExtras.explainText ?? null,
        },
      });
      created.push(row);
    }
    return { generated: created.length, rows: created.map(toPublic) };
  }
}

function toPublic(r: AIRecommendation): RecommendationPublic {
  // Round 37: lift the structured evidence items out of the JSON blob.
  const ev = r.evidence as { items?: Array<{ label: string; value: string; source?: string }> } | null;
  const items = Array.isArray(ev?.items) ? ev!.items : undefined;
  return {
    id: r.id,
    type: r.type,
    title: r.title,
    content: r.content,
    priority: r.priority,
    status: r.status,
    explainText: (r as unknown as { explainText: string | null }).explainText ?? null,
    evidence: items?.map((i) => ({
      label: i.label,
      value: i.value,
      source: i.source as 'MANUAL' | 'DEVICE' | 'INFERRED' | 'COMPUTED' | undefined,
    })),
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  };
}
