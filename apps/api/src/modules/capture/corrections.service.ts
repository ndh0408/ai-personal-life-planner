/**
 * Read/write capture corrections.
 *
 * The CaptureCorrection table is append-only — every time the user edited
 * the parser preview before confirming, we keep what the parser said vs
 * what the user changed it to. The parser orchestrator (CaptureService)
 * pulls the most recent N entries on every parse and feeds them to the
 * LLM as few-shot examples; that's how the system learns "when this user
 * says trà sữa it's still an EXPENSE even if 'trà' looks like a MEAL".
 *
 * Persistence happens from ConfirmService when a confirm carries
 * `originalKind`/`originalFields` that differ from the final ones.
 */
import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

export interface CorrectionExample {
  rawText: string;
  originalKind: string | null;
  correctedKind: string | null;
  originalPayload: Record<string, unknown> | null;
  correctedPayload: Record<string, unknown> | null;
}

@Injectable()
export class CorrectionsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Most recent N corrections, newest first. Empty array when none. */
  async recentForUser(userId: string, limit = 5): Promise<CorrectionExample[]> {
    const rows = await this.prisma.captureCorrection.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
    return rows.map((r) => ({
      rawText: r.rawText,
      originalKind: r.originalKind,
      correctedKind: r.correctedKind,
      originalPayload: r.originalPayload as Record<string, unknown> | null,
      correctedPayload: r.correctedPayload as Record<string, unknown> | null,
    }));
  }

  /**
   * Persist a correction. Caller is responsible for deciding *whether* it's
   * a real correction (i.e. the user actually changed something between
   * parse and confirm) — this method just writes.
   */
  async record(
    args: {
      userId: string;
      quickCaptureId: string;
      rawText: string;
      originalSource: 'RULE' | 'LLM' | 'HYBRID' | 'MANUAL';
      originalKind: string | null;
      originalConfidence: number | null;
      originalPayload: unknown;
      correctedKind: string | null;
      correctedPayload: unknown;
    },
    db: Prisma.TransactionClient | PrismaService = this.prisma,
  ): Promise<void> {
    await db.captureCorrection.create({
      data: {
        userId: args.userId,
        quickCaptureId: args.quickCaptureId,
        rawText: args.rawText,
        originalSource: args.originalSource,
        originalKind: args.originalKind,
        originalConfidence: args.originalConfidence,
        originalPayload: (args.originalPayload ?? null) as Prisma.InputJsonValue,
        correctedKind: args.correctedKind,
        correctedPayload: (args.correctedPayload ?? null) as Prisma.InputJsonValue,
        confirmed: true,
      },
    });
    await db.quickCapture.update({
      where: { id: args.quickCaptureId },
      data: { correctionCount: { increment: 1 } },
    });
  }
}
