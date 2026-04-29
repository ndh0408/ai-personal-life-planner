/**
 * Per-account brute-force defence (round 19).
 *
 * IP throttling is already in place via `@nestjs/throttler` at the controller
 * layer, but credential stuffing / password spraying campaigns rotate IPs.
 * To make those attacks expensive we also count failures on the User row:
 * after MAX_FAILS bad passwords, the account is locked for LOCK_MINUTES.
 *
 * The thresholds are conservative — high enough that a typo'd password
 * doesn't lock you out, low enough that an automated attacker has to wait.
 *
 * Per OWASP: a successful login resets the counter. Failures stand even
 * across "successful login from another IP" because once compromised, the
 * attacker may be the one who succeeds — so we don't reset until the
 * legitimate session shows positive auth.
 */
import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

export const MAX_FAILS = 5;
export const LOCK_MINUTES = 15;

@Injectable()
export class AccountLockoutService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Returns the remaining lockout, or null if the account is unlocked.
   * The DB is the source of truth; we re-read inside login() so we can race
   * against a concurrent unlock without holding a lock for the full request.
   */
  isLocked(user: { lockUntil: Date | null }): { until: Date } | null {
    if (user.lockUntil && user.lockUntil.getTime() > Date.now()) {
      return { until: user.lockUntil };
    }
    return null;
  }

  /**
   * Record a bad password attempt. Increments the counter; once at threshold,
   * stamps lockUntil = now + LOCK_MINUTES and the next login() call rejects
   * with ACCOUNT_LOCKED until the timestamp passes.
   */
  async recordFailure(
    userId: string,
    db: Prisma.TransactionClient | PrismaService = this.prisma,
  ): Promise<{ count: number; lockedUntil: Date | null }> {
    const updated = await db.user.update({
      where: { id: userId },
      data: {
        failedLoginCount: { increment: 1 },
        lastFailedLoginAt: new Date(),
      },
      select: { failedLoginCount: true },
    });

    if (updated.failedLoginCount >= MAX_FAILS) {
      const lockUntil = new Date(Date.now() + LOCK_MINUTES * 60_000);
      await db.user.update({
        where: { id: userId },
        data: { lockUntil },
      });
      return { count: updated.failedLoginCount, lockedUntil: lockUntil };
    }
    return { count: updated.failedLoginCount, lockedUntil: null };
  }

  /**
   * Successful auth: clear failure state. Called *after* the password check
   * and the active-status check pass, before tokens are issued.
   */
  async recordSuccess(
    userId: string,
    db: Prisma.TransactionClient | PrismaService = this.prisma,
  ): Promise<void> {
    await db.user.update({
      where: { id: userId },
      data: {
        failedLoginCount: 0,
        lockUntil: null,
        lastLoginAt: new Date(),
      },
    });
  }
}
