import { Injectable, Logger } from '@nestjs/common';
import {
  FinanceAction,
  FinanceEntityType,
  type Prisma,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Append-only audit trail for every finance write. Callers pass `before`
 * + `after` snapshots; the service serialises them to plain JSON
 * (Decimal → string, Date → ISO) so the row is comparable across migrations
 * and timezone changes.
 *
 * Privacy: the JSON snapshot omits free-form text fields (`note`) by default.
 * Callers can include extra metadata via `meta` if it's audit-relevant.
 */
@Injectable()
export class FinanceAuditService {
  private readonly logger = new Logger(FinanceAuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  async record(args: {
    userId: string;
    entityType: FinanceEntityType;
    entityId: string;
    action: FinanceAction;
    before?: Record<string, unknown> | null;
    after?: Record<string, unknown> | null;
    /** Optional Prisma transaction client so the audit row is committed atomically. */
    tx?: Prisma.TransactionClient;
  }): Promise<void> {
    try {
      const client = args.tx ?? this.prisma;
      await client.financeAuditLog.create({
        data: {
          userId: args.userId,
          entityType: args.entityType,
          entityId: args.entityId,
          action: args.action,
          before: args.before ? safeJson(args.before) : undefined,
          after: args.after ? safeJson(args.after) : undefined,
        },
      });
    } catch (e) {
      // Never block a finance write on the audit row — the source of truth
      // is the entity table itself.
      const msg = e instanceof Error ? e.message : String(e);
      this.logger.warn(`finance audit write failed: ${msg}`);
    }
  }
}

const SENSITIVE_KEYS = new Set(['note']);

/**
 * Convert a Prisma row to JSON-safe primitives:
 *   - Decimal → string (preserves cents losslessly)
 *   - Date    → ISO string
 *   - excludes `note` (free-form, may contain PII)
 *   - shallow only — nested relations should not be passed in
 */
function safeJson(input: Record<string, unknown>): Prisma.InputJsonValue {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(input)) {
    if (SENSITIVE_KEYS.has(k)) continue;
    if (v === null || v === undefined) {
      out[k] = null;
      continue;
    }
    if (v instanceof Date) {
      out[k] = v.toISOString();
      continue;
    }
    if (typeof v === 'object' && v !== null && 'toFixed' in v) {
      out[k] = (v as { toFixed: (n: number) => string }).toFixed(2);
      continue;
    }
    if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') {
      out[k] = v;
      continue;
    }
    // Skip anything we can't safely serialise — better to lose the field than
    // to crash on a circular ref.
  }
  return out as Prisma.InputJsonValue;
}
