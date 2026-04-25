import { ConflictException, Injectable } from '@nestjs/common';
import { type Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Per-user finance idempotency keys.
 *
 * Usage from a finance service:
 *
 *   await idempotency.consumeOrThrow({ userId, scope: 'expense:create', key, tx })
 *
 * - Throws 409 IDEMPOTENCY_KEY_REUSED when the key was already used (caller
 *   should treat the original entity as the canonical answer).
 * - Otherwise inserts a row inside the same transaction so it commits with
 *   the entity. If the transaction rolls back, the key is freed.
 */
@Injectable()
export class FinanceIdempotencyService {
  constructor(private readonly prisma: PrismaService) {}

  /** Returns the existing entityId if the key was used; otherwise null. */
  async lookup(userId: string, scope: string, key: string): Promise<{ entityId: string } | null> {
    const row = await this.prisma.financeIdempotencyKey.findUnique({
      where: { userId_scope_key: { userId, scope, key } },
      select: { entityId: true },
    });
    return row ? { entityId: row.entityId } : null;
  }

  /**
   * Records a key inside the given transaction. Throws ConflictException
   * with errorCode `IDEMPOTENCY_KEY_REUSED` on duplicate.
   *
   * Pass the resulting entityId once it's known — the row is created lazily,
   * so callers should call this AFTER inserting the entity within the same tx.
   */
  async record(args: {
    userId: string;
    scope: string;
    key: string;
    entityType: Parameters<PrismaService['financeIdempotencyKey']['create']>[0]['data']['entityType'];
    entityId: string;
    tx: Prisma.TransactionClient;
  }): Promise<void> {
    try {
      await args.tx.financeIdempotencyKey.create({
        data: {
          userId: args.userId,
          scope: args.scope,
          key: args.key,
          entityType: args.entityType,
          entityId: args.entityId,
        },
      });
    } catch (e: unknown) {
      const code = (e as { code?: string })?.code;
      if (code === 'P2002') {
        throw new ConflictException({
          message: 'Idempotency key already used',
          errorCode: 'IDEMPOTENCY_KEY_REUSED',
        });
      }
      throw e;
    }
  }
}
