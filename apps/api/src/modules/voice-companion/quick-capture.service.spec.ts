import { QuickCaptureService } from './quick-capture.service';
import type { AiProviderResolverService } from '../ai/services/ai-provider-resolver.service';
import { AiPromptTemplateService } from '../ai/services/ai-prompt-template.service';
import { AiJsonValidationService } from '../ai/services/ai-json-validation.service';
import { AiProviderService } from '../ai/services/ai-provider.service';
import { MockAiProvider } from '../ai/providers/mock.provider';
import { makeStubUsage } from '../ai/services/test-helpers';
import type { LocaleService } from '../../common/i18n/locale.service';

function makePrisma() {
  const captures: any[] = [];
  const actions: any[] = [];
  return {
    captures,
    actions,
    api: {
      voiceCapture: {
        create: jest.fn(async ({ data }: any) => {
          const r = { id: `vc-${captures.length + 1}`, ...data, createdAt: new Date() };
          captures.push(r);
          return r;
        }),
        update: jest.fn(async ({ where, data }: any) => {
          const cur = captures.find((c) => c.id === where.id);
          Object.assign(cur, data);
          return cur;
        }),
      },
      suggestedAction: {
        create: jest.fn(async ({ data }: any) => {
          const r = {
            id: `sa-${actions.length + 1}`,
            ...data,
            status: 'PENDING',
            createdAt: new Date(),
          };
          actions.push(r);
          return r;
        }),
        findUnique: jest.fn(async ({ where }: any) => actions.find((a) => a.id === where.id) ?? null),
        update: jest.fn(async ({ where, data }: any) => {
          const r = actions.find((a) => a.id === where.id);
          Object.assign(r, data);
          return r;
        }),
        updateMany: jest.fn(async () => ({ count: 0 })),
        findMany: jest.fn(async ({ where }: any) =>
          actions.filter((a) => a.userId === where.userId && a.status === where.status),
        ),
      },
    },
  };
}

function makeResolverWith(text: string): AiProviderResolverService {
  return {
    completeForUser: async () => ({ text, provider: 'mock', model: 'mock', usage: {}, usedFallback: false, userScope: 'global' as const }),
  } as unknown as AiProviderResolverService;
}

function localeStub(): LocaleService {
  return { forUser: async () => 'vi' } as unknown as LocaleService;
}

describe('QuickCaptureService', () => {
  it('parses valid JSON into PENDING SuggestedAction rows + returns followup when confidence is low', async () => {
    const { api, actions } = makePrisma();
    const resolver = makeResolverWith(
      JSON.stringify({
        followupQuestion: null,
        actions: [
          { type: 'ADD_MEAL_LOG', title: 'Bánh mì trứng', confidence: 0.4, payload: { mealType: 'BREAKFAST', estimatedCost: 25000 } },
        ],
      }),
    );
    const orchestrator = new AiProviderService(new MockAiProvider(), makeStubUsage());
    const json = new AiJsonValidationService(orchestrator);
    const svc = new QuickCaptureService(api as never, resolver, new AiPromptTemplateService(), json, localeStub());

    const r = await svc.parse('u1', { transcript: 'Tôi vừa ăn bánh mì trứng 25k', source: 'TEXT_FALLBACK' });
    expect(r.actions).toHaveLength(1);
    // Persisted as PENDING — never CONFIRMED on parse.
    expect(actions[0].status).toBe('PENDING');
    // Low max confidence triggers a followup question even though the AI
    // returned null.
    expect(r.followupQuestion).toBeTruthy();
  });

  it('falls back deterministically + sets usedFallback when AI returns invalid JSON', async () => {
    const { api } = makePrisma();
    const resolver = makeResolverWith('not-json');
    const orchestrator = new AiProviderService(new MockAiProvider(), makeStubUsage());
    const json = new AiJsonValidationService(orchestrator);
    const svc = new QuickCaptureService(api as never, resolver, new AiPromptTemplateService(), json, localeStub());

    const r = await svc.parse('u1', { transcript: 'gì đó', source: 'PUSH_TO_TALK' });
    expect(r.usedFallback).toBe(true);
    expect(r.actions).toHaveLength(0);
    expect(r.followupQuestion).toBeTruthy();
  });

  it('reject() refuses cross-user', async () => {
    const { api, actions } = makePrisma();
    actions.push({
      id: 'sa-x',
      userId: 'u1',
      status: 'PENDING',
      type: 'ADD_TASK',
      title: 'x',
      locale: 'vi',
      confidence: 0.5,
      payload: {},
      voiceCaptureId: null,
      expiresAt: null,
      createdAt: new Date(),
    });
    const orchestrator = new AiProviderService(new MockAiProvider(), makeStubUsage());
    const json = new AiJsonValidationService(orchestrator);
    const svc = new QuickCaptureService(
      api as never,
      makeResolverWith('{}'),
      new AiPromptTemplateService(),
      json,
      localeStub(),
    );
    await expect(svc.reject('u2', 'sa-x')).rejects.toThrow();
    await expect(svc.reject('u1', 'sa-x')).resolves.toMatchObject({ status: 'REJECTED' });
  });
});
