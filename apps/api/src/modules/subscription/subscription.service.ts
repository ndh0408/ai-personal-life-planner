import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  ENTITLEMENTS,
  type BillingTier,
  type Entitlements,
} from '@lifeos/taxonomy';
import type { SubscriptionPublic, SubscriptionResponse } from '@lifeos/shared';

/**
 * Source of truth for "what is this user allowed to do?". Reads the
 * Subscription row, joins with the static ENTITLEMENTS map, and returns
 * the bag the client gates UI on.
 *
 * For Round 41 the row is created lazily as FREE/NONE if missing — that
 * keeps the test surface minimal. Real provisioning happens via webhook
 * handlers (Stripe, App Store Server Notifications, Google RTDN).
 */
@Injectable()
export class SubscriptionService {
  constructor(private readonly prisma: PrismaService) {}

  async get(userId: string): Promise<SubscriptionResponse> {
    const row = await this.prisma.subscription.upsert({
      where: { userId },
      update: {},
      create: { userId },
    });
    const tier = row.tier as BillingTier;
    return {
      subscription: this.toPublic(row, tier),
      entitlements: this.entitlementsFor(tier),
    };
  }

  /**
   * Ground-truth gate consulted by feature code. Falls back to FREE
   * entitlements if no row exists yet — the lazy-create above prevents
   * that case for /subscription, but inner services may call this
   * before any read of the public endpoint.
   */
  async entitlements(userId: string): Promise<Entitlements> {
    const row = await this.prisma.subscription.findUnique({ where: { userId } });
    const tier = (row?.tier as BillingTier) ?? 'FREE';
    return this.entitlementsFor(tier);
  }

  /** Test seam — also used by webhook handlers in Round 42+. */
  async setTier(
    userId: string,
    tier: BillingTier,
    opts: {
      status?: 'NONE' | 'TRIAL' | 'ACTIVE' | 'GRACE' | 'EXPIRED' | 'CANCELLED';
      provider?: 'appstore' | 'playstore' | 'stripe' | 'promo' | 'lifetime' | 'none';
      currentPeriodEnd?: Date | null;
      autoRenew?: boolean;
      providerCustomerId?: string | null;
      providerSubscriptionId?: string | null;
      lifetimePurchasedAt?: Date | null;
    } = {},
  ): Promise<SubscriptionResponse> {
    const row = await this.prisma.subscription.upsert({
      where: { userId },
      update: {
        tier,
        status: opts.status ?? (tier === 'FREE' ? 'NONE' : 'ACTIVE'),
        ...(opts.provider !== undefined ? { provider: opts.provider } : {}),
        ...(opts.currentPeriodEnd !== undefined
          ? { currentPeriodEnd: opts.currentPeriodEnd }
          : {}),
        ...(opts.autoRenew !== undefined ? { autoRenew: opts.autoRenew } : {}),
        ...(opts.providerCustomerId !== undefined
          ? { providerCustomerId: opts.providerCustomerId }
          : {}),
        ...(opts.providerSubscriptionId !== undefined
          ? { providerSubscriptionId: opts.providerSubscriptionId }
          : {}),
        ...(opts.lifetimePurchasedAt !== undefined
          ? { lifetimePurchasedAt: opts.lifetimePurchasedAt }
          : tier === 'LIFETIME' && opts.lifetimePurchasedAt === undefined
          ? { lifetimePurchasedAt: new Date() }
          : {}),
      },
      create: {
        userId,
        tier,
        status: opts.status ?? (tier === 'FREE' ? 'NONE' : 'ACTIVE'),
        provider: opts.provider ?? (tier === 'LIFETIME' ? 'lifetime' : 'none'),
        currentPeriodEnd: opts.currentPeriodEnd ?? null,
        autoRenew: opts.autoRenew ?? false,
        providerCustomerId: opts.providerCustomerId ?? null,
        providerSubscriptionId: opts.providerSubscriptionId ?? null,
        lifetimePurchasedAt:
          opts.lifetimePurchasedAt ?? (tier === 'LIFETIME' ? new Date() : null),
      },
    });

    return {
      subscription: this.toPublic(row, tier),
      entitlements: this.entitlementsFor(tier),
    };
  }

  private entitlementsFor(tier: BillingTier): Entitlements {
    return ENTITLEMENTS[tier];
  }

  private toPublic(
    row: {
      tier: string;
      status: string;
      provider: string;
      currentPeriodEnd: Date | null;
      autoRenew: boolean;
      lifetimePurchasedAt: Date | null;
    },
    tier: BillingTier,
  ): SubscriptionPublic {
    return {
      tier,
      status: row.status as SubscriptionPublic['status'],
      provider: row.provider as SubscriptionPublic['provider'],
      currentPeriodEnd: row.currentPeriodEnd
        ? row.currentPeriodEnd.toISOString()
        : null,
      autoRenew: row.autoRenew,
      lifetimePurchasedAt: row.lifetimePurchasedAt
        ? row.lifetimePurchasedAt.toISOString()
        : null,
    };
  }
}
