import { BadRequestException, Injectable } from '@nestjs/common';
import type { CommunicationSetting, MemoryConsent } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type {
  UpdateCommunicationSettingsInput,
  UpdateMemoryConsentInput,
} from '@planner/shared';

const SETTING_DEFAULTS = {
  emailAssistantEnabled: false,
  emailMetadataSync: true,
  emailSnippetSync: false,
  emailFullContentAnalysis: false,
  followUpRemindersEnabled: true,
  messageReminderEnabled: true,
  androidNotificationImportEnabled: false,
  aiMemoryEnabled: true,
};

const CONSENT_DEFAULTS = {
  allowMemory: true,
  allowEmailForAI: false,
  allowCommunicationContextForAI: false,
  allowVoiceNotesForAI: false,
};

/**
 * Owns CommunicationSetting + MemoryConsent. Both rows are LAZY: we return
 * in-memory defaults until the user explicitly hits PUT, so reads never
 * write.
 *
 * Settings enforce a strict ladder: snippet REQUIRES metadata, full-content
 * analysis REQUIRES snippet. The mobile UI mirrors this with disabled
 * toggles, but the backend is the source of truth.
 */
@Injectable()
export class CommunicationSettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async getSettings(userId: string): Promise<CommunicationSetting> {
    const found = await this.prisma.communicationSetting.findUnique({ where: { userId } });
    if (found) return found;
    return {
      id: '',
      userId,
      ...SETTING_DEFAULTS,
      createdAt: new Date(0),
      updatedAt: new Date(0),
    } as CommunicationSetting;
  }

  async updateSettings(
    userId: string,
    input: UpdateCommunicationSettingsInput,
  ): Promise<CommunicationSetting> {
    const current = await this.getSettings(userId);
    const next = { ...SETTING_DEFAULTS, ...current, ...input };

    // Ladder: snippet requires metadata; full-content requires snippet.
    if (next.emailSnippetSync && !next.emailMetadataSync) {
      throw new BadRequestException({
        message: 'emailSnippetSync requires emailMetadataSync',
        errorCode: 'INVALID_PROVIDER_CONFIG',
      });
    }
    if (next.emailFullContentAnalysis && !next.emailSnippetSync) {
      throw new BadRequestException({
        message: 'emailFullContentAnalysis requires emailSnippetSync',
        errorCode: 'INVALID_PROVIDER_CONFIG',
      });
    }

    return this.prisma.communicationSetting.upsert({
      where: { userId },
      create: { userId, ...SETTING_DEFAULTS, ...input },
      update: { ...input },
    });
  }

  async getMemoryConsent(userId: string): Promise<MemoryConsent> {
    const found = await this.prisma.memoryConsent.findUnique({ where: { userId } });
    if (found) return found;
    return {
      id: '',
      userId,
      ...CONSENT_DEFAULTS,
      createdAt: new Date(0),
      updatedAt: new Date(0),
    } as MemoryConsent;
  }

  async updateMemoryConsent(
    userId: string,
    input: UpdateMemoryConsentInput,
  ): Promise<MemoryConsent> {
    return this.prisma.memoryConsent.upsert({
      where: { userId },
      create: { userId, ...CONSENT_DEFAULTS, ...input },
      update: { ...input },
    });
  }
}
