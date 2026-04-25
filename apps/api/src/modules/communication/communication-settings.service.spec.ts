import { BadRequestException } from '@nestjs/common';
import { CommunicationSettingsService } from './communication-settings.service';

function makePrisma() {
  const settings = new Map<string, any>();
  const consents = new Map<string, any>();
  return {
    api: {
      communicationSetting: {
        findUnique: jest.fn(async ({ where }: any) => settings.get(where.userId) ?? null),
        upsert: jest.fn(async ({ where, create, update }: any) => {
          const existing = settings.get(where.userId);
          const next = existing
            ? { ...existing, ...update, updatedAt: new Date() }
            : {
                id: `s-${settings.size + 1}`,
                ...create,
                createdAt: new Date(),
                updatedAt: new Date(),
              };
          settings.set(where.userId, next);
          return next;
        }),
      },
      memoryConsent: {
        findUnique: jest.fn(async ({ where }: any) => consents.get(where.userId) ?? null),
        upsert: jest.fn(async ({ where, create, update }: any) => {
          const existing = consents.get(where.userId);
          const next = existing
            ? { ...existing, ...update, updatedAt: new Date() }
            : {
                id: `c-${consents.size + 1}`,
                ...create,
                createdAt: new Date(),
                updatedAt: new Date(),
              };
          consents.set(where.userId, next);
          return next;
        }),
      },
    },
  };
}

describe('CommunicationSettingsService', () => {
  it('returns conservative defaults when no row exists', async () => {
    const { api } = makePrisma();
    const svc = new CommunicationSettingsService(api as never);
    const s = await svc.getSettings('u1');
    expect(s.emailAssistantEnabled).toBe(false);
    expect(s.emailMetadataSync).toBe(true);
    expect(s.emailSnippetSync).toBe(false);
    expect(s.emailFullContentAnalysis).toBe(false);
    expect(s.androidNotificationImportEnabled).toBe(false);
    expect(s.aiMemoryEnabled).toBe(true);
    expect(api.communicationSetting.upsert).not.toHaveBeenCalled();
  });

  it('rejects snippet without metadata', async () => {
    const { api } = makePrisma();
    const svc = new CommunicationSettingsService(api as never);
    await expect(
      svc.updateSettings('u1', { emailMetadataSync: false, emailSnippetSync: true }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects full-content without snippet', async () => {
    const { api } = makePrisma();
    const svc = new CommunicationSettingsService(api as never);
    await expect(
      svc.updateSettings('u1', { emailFullContentAnalysis: true }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('accepts the metadata→snippet→full-content ladder when applied in order', async () => {
    const { api } = makePrisma();
    const svc = new CommunicationSettingsService(api as never);
    await svc.updateSettings('u1', { emailSnippetSync: true });
    const r = await svc.updateSettings('u1', { emailFullContentAnalysis: true });
    expect(r.emailFullContentAnalysis).toBe(true);
    expect(r.emailSnippetSync).toBe(true);
    expect(r.emailMetadataSync).toBe(true);
  });

  it('memory consent defaults: allowMemory ON, AI-feeding flags OFF', async () => {
    const { api } = makePrisma();
    const svc = new CommunicationSettingsService(api as never);
    const c = await svc.getMemoryConsent('u1');
    expect(c.allowMemory).toBe(true);
    expect(c.allowEmailForAI).toBe(false);
    expect(c.allowCommunicationContextForAI).toBe(false);
    expect(c.allowVoiceNotesForAI).toBe(false);
  });
});
