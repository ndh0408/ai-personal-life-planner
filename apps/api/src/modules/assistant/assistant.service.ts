import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AssistantService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Returns the caller's active insights. Today this is a thin read of
   * AIRecommendation; the scanner that *creates* those rows lands with the
   * full assistant worker in a follow-up iteration.
   */
  async insights(userId: string, limit = 20) {
    return this.prisma.aIRecommendation.findMany({
      where: { userId, status: { in: ['NEW', 'VIEWED'] } },
      orderBy: { createdAt: 'desc' },
      take: Math.min(Math.max(limit, 1), 100),
      select: {
        id: true,
        type: true,
        title: true,
        content: true,
        status: true,
        createdAt: true,
      },
    });
  }

  async dismiss(userId: string, id: string) {
    const result = await this.prisma.aIRecommendation.updateMany({
      where: { id, userId },
      data: { status: 'DISMISSED' },
    });
    return { dismissed: result.count };
  }
}
