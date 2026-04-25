import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import type {
  ContextInference,
  ContextInferenceStatus,
  Prisma,
  UserPattern,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { LocaleService } from '../../common/i18n/locale.service';
import { PrivacyService } from '../privacy/privacy.service';
import { ContextSignalService, type CollectedSignals } from './context-signal.service';
import { InferenceRuleService } from './inference-rule.service';
import { UserPatternService } from './user-pattern.service';

/**
 * Top-level orchestrator. Reads patterns + signals + privacy gates, runs
 * the rule engine, dedupes against same-day rows the user already
 * dismissed, persists `ContextInference` rows + a metadata pin
 * `ContextSignal` per fired inference.
 *
 * Hard rules:
 *   - No AI calls in v1.2 — rule engine is deterministic and bounded.
 *     `InferenceRuleService` already returns locale-tagged human evidence
 *     so `ContextInference.evidence` is ready for the mobile UI without
 *     ever calling an upstream model.
 *   - Dedupe per (userId, type, day): if a same-day inference exists with
 *     status DISMISSED or APPLIED, we DO NOT recreate today.
 *   - If a same-day NEW/VIEWED inference exists for the same type, we
 *     update its confidence + evidence in place rather than spamming.
 */
@Injectable()
export class RecommendationTriggerService {
  private readonly logger = new Logger(RecommendationTriggerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly locale: LocaleService,
    private readonly privacy: PrivacyService,
    private readonly signals: ContextSignalService,
    private readonly rules: InferenceRuleService,
    private readonly patterns: UserPatternService,
  ) {}

  async run(
    userId: string,
    options: { now?: Date } = {},
  ): Promise<{
    inferences: ContextInference[];
    signals: CollectedSignals;
    patterns: UserPattern[];
  }> {
    const localeTag = await this.locale.forUser(userId, {});
    const patterns = await this.patterns.refresh(userId);
    const signals = await this.signals.collect(userId, patterns, options.now);
    const ruleResults = this.rules.evaluate(signals, localeTag);

    const startOfToday = new Date(signals.now);
    startOfToday.setHours(0, 0, 0, 0);
    const endOfToday = new Date(startOfToday.getTime() + 86_400_000);

    const persisted: ContextInference[] = [];
    for (const r of ruleResults) {
      // Dedupe: a DISMISSED / APPLIED row for the same type today blocks.
      const blocker = await this.prisma.contextInference.findFirst({
        where: {
          userId,
          type: r.type,
          status: { in: ['DISMISSED', 'APPLIED'] },
          createdAt: { gte: startOfToday, lt: endOfToday },
        },
        select: { id: true },
      });
      if (blocker) continue;

      const existingOpen = await this.prisma.contextInference.findFirst({
        where: {
          userId,
          type: r.type,
          status: { in: ['NEW', 'VIEWED'] },
          createdAt: { gte: startOfToday, lt: endOfToday },
        },
      });

      let row: ContextInference;
      if (existingOpen) {
        row = await this.prisma.contextInference.update({
          where: { id: existingOpen.id },
          data: {
            confidence: r.confidence,
            evidence: r.evidence as unknown as Prisma.InputJsonValue,
            suggestedAction: (r.suggestedAction ?? null) as Prisma.InputJsonValue,
          },
        });
      } else {
        row = await this.prisma.contextInference.create({
          data: {
            userId,
            type: r.type,
            confidence: r.confidence,
            evidence: r.evidence as unknown as Prisma.InputJsonValue,
            suggestedAction: (r.suggestedAction ?? null) as Prisma.InputJsonValue,
          },
        });
      }
      persisted.push(row);

      // Pin a metadata-only signal row so we have a "what triggered it"
      // breadcrumb. Best-effort; failures swallowed.
      void this.signals.pin(
        userId,
        'TASK_PENDING_LATE',
        { inferenceId: row.id, type: r.type },
        'context-inference',
        signals.now,
        r.confidence,
      );
    }

    return { inferences: persisted, signals, patterns };
  }

  async listToday(userId: string): Promise<ContextInference[]> {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    return this.prisma.contextInference.findMany({
      where: { userId, createdAt: { gte: startOfToday } },
      orderBy: [{ confidence: 'desc' }, { createdAt: 'desc' }],
    });
  }

  async listAll(userId: string, limit = 50): Promise<ContextInference[]> {
    return this.prisma.contextInference.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: Math.min(Math.max(limit, 1), 200),
    });
  }

  async updateStatus(
    userId: string,
    id: string,
    status: ContextInferenceStatus,
  ): Promise<ContextInference> {
    const row = await this.prisma.contextInference.findUnique({ where: { id } });
    if (!row) {
      throw new NotFoundException({ message: 'Inference not found', errorCode: 'NOT_FOUND' });
    }
    if (row.userId !== userId) {
      throw new ForbiddenException({ errorCode: 'FORBIDDEN' });
    }
    return this.prisma.contextInference.update({ where: { id }, data: { status } });
  }
}
