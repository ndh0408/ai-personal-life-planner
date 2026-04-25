import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import type { EmailItem, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CommunicationSettingsService } from './communication-settings.service';
import type {
  EmailAnalysisDto,
  ListEmailsQuery,
  UpdateEmailStatusInput,
} from '@planner/shared';

/**
 * Email storage + read endpoints. The actual mailbox sync (Gmail/Outlook
 * fetch) lives behind ConnectedAccountsService and lands in v1.3 along
 * with the OAuth wiring; v1.2 covers list + get + status patch + a stub
 * `syncFor()` that no-ops with `notImplemented: true`.
 *
 * Snippet visibility is gated on CommunicationSetting.emailSnippetSync —
 * even if the row has a snippet stored, we strip it before returning when
 * the user has the snippet toggle off.
 */
@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: CommunicationSettingsService,
  ) {}

  async list(userId: string, q: ListEmailsQuery): Promise<{
    items: EmailItem[];
    total: number;
    page: number;
    limit: number;
  }> {
    const where: Prisma.EmailItemWhereInput = { userId };
    if (q.category) where.category = q.category;
    if (q.needsReply !== undefined) where.needsReply = q.needsReply;
    if (q.isImportant !== undefined) where.isImportant = q.isImportant;
    if (q.hasDeadline !== undefined) where.hasDeadline = q.hasDeadline;

    const [rawItems, total, settings] = await Promise.all([
      this.prisma.emailItem.findMany({
        where,
        orderBy: { receivedAt: 'desc' },
        skip: (q.page - 1) * q.limit,
        take: q.limit,
      }),
      this.prisma.emailItem.count({ where }),
      this.settings.getSettings(userId),
    ]);

    // Snippet redaction at the boundary, even if persisted.
    const items = settings.emailSnippetSync
      ? rawItems
      : rawItems.map((i) => ({ ...i, snippet: null }));

    return { items, total, page: q.page, limit: q.limit };
  }

  async getById(userId: string, id: string): Promise<EmailItem> {
    const row = await this.prisma.emailItem.findUnique({ where: { id } });
    if (!row) {
      throw new NotFoundException({ message: 'Email not found', errorCode: 'NOT_FOUND' });
    }
    if (row.userId !== userId) {
      throw new ForbiddenException({ errorCode: 'FORBIDDEN' });
    }
    const settings = await this.settings.getSettings(userId);
    return settings.emailSnippetSync ? row : { ...row, snippet: null };
  }

  async updateStatus(
    userId: string,
    id: string,
    input: UpdateEmailStatusInput,
  ): Promise<EmailItem> {
    await this.getById(userId, id);
    return this.prisma.emailItem.update({ where: { id }, data: input });
  }

  /** Persist the AI analysis result back onto the row. */
  async applyAnalysis(
    userId: string,
    id: string,
    analysis: EmailAnalysisDto,
  ): Promise<EmailItem> {
    await this.getById(userId, id);
    return this.prisma.emailItem.update({
      where: { id },
      data: {
        isImportant: analysis.isImportant,
        needsReply: analysis.needsReply,
        hasDeadline: analysis.hasDeadline,
        detectedDeadlineAt: analysis.detectedDeadlineAt
          ? new Date(analysis.detectedDeadlineAt)
          : null,
        category: analysis.category,
        aiSummary: analysis.summary.slice(0, 1000),
      },
    });
  }

  /**
   * Stub — the actual Gmail/Outlook fetch + Prisma upserts land in v1.3
   * with the OAuth wiring. Called by POST /api/emails/sync. Returns
   * `notImplemented: true` so the mobile shows a "coming soon" toast
   * instead of pretending the sync ran.
   */
  async syncFor(userId: string): Promise<{ accountsSynced: number; notImplemented: boolean }> {
    const accounts = await this.prisma.connectedAccount.count({
      where: { userId, isActive: true },
    });
    this.logger.log(`syncFor user=${userId} activeAccounts=${accounts} (stub)`);
    return { accountsSynced: 0, notImplemented: true };
  }
}
