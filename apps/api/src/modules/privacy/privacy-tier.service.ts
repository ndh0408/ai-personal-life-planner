import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  PrivacyTierSchema,
  type PrivacyTier,
} from '@lifeos/taxonomy';
import type { PrivacyTierSetting, SetPrivacyTierRequest } from '@lifeos/shared';

/**
 * Round 40: macro privacy tier. Three tiers (CLOUD / HYBRID / LOCAL) gate
 * whether server-side LLM calls and memory writes are permitted for this
 * user. The per-feature flags on PrivacySetting remain as the *micro*
 * controls inside the cloud-allowed tiers.
 *
 * The check method `cloudAiAllowed` is the single hot-path gate every LLM
 * caller should consult — see LlmService integration in a follow-up round.
 */
@Injectable()
export class PrivacyTierService {
  constructor(private readonly prisma: PrismaService) {}

  async get(userId: string): Promise<PrivacyTierSetting> {
    const row = await this.prisma.privacySetting.upsert({
      where: { userId },
      update: {},
      create: { userId },
    });
    return {
      tier: row.tier as PrivacyTier,
      e2eeKeyFingerprint: row.e2eeKeyFingerprint,
      onDeviceLlmReady: row.onDeviceLlmReady,
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  async set(userId: string, body: SetPrivacyTierRequest): Promise<PrivacyTierSetting> {
    const tier = PrivacyTierSchema.parse(body.tier);

    if (tier !== 'CLOUD' && body.e2eeKeyFingerprint == null) {
      // HYBRID and LOCAL both require client-managed E2EE keys; without a
      // fingerprint on file, the server can't verify recovery later.
      throw new BadRequestException('E2EE fingerprint required for HYBRID/LOCAL tier');
    }

    const row = await this.prisma.privacySetting.upsert({
      where: { userId },
      update: {
        tier,
        ...(body.e2eeKeyFingerprint !== undefined
          ? { e2eeKeyFingerprint: body.e2eeKeyFingerprint }
          : {}),
      },
      create: {
        userId,
        tier,
        e2eeKeyFingerprint: body.e2eeKeyFingerprint ?? null,
      },
    });

    return {
      tier: row.tier as PrivacyTier,
      e2eeKeyFingerprint: row.e2eeKeyFingerprint,
      onDeviceLlmReady: row.onDeviceLlmReady,
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  async cloudAiAllowed(userId: string): Promise<boolean> {
    const row = await this.prisma.privacySetting.findUnique({ where: { userId } });
    // Default-deny is wrong here — never-set users are CLOUD by default per
    // spec. Default-allow is the intentional choice; LOCAL is opt-in.
    if (!row) return true;
    return (row.tier as PrivacyTier) !== 'LOCAL';
  }

  async markOnDeviceLlmReady(userId: string, ready: boolean): Promise<void> {
    await this.prisma.privacySetting.upsert({
      where: { userId },
      update: { onDeviceLlmReady: ready },
      create: { userId, onDeviceLlmReady: ready },
    });
  }
}
