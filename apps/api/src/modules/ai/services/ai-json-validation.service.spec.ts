import { z } from 'zod';
import {
  AiInvalidJsonError,
  AiJsonValidationService,
} from './ai-json-validation.service';
import { AiProviderService } from './ai-provider.service';
import { MockAiProvider } from '../providers/mock.provider';

const Schema = z.object({ ok: z.boolean(), value: z.number().min(0) });

describe('AiJsonValidationService', () => {
  it('parses well-formed JSON', async () => {
    const service = new AiJsonValidationService(new AiProviderService(new MockAiProvider()));
    const out = await service.parseAndValidate('{"ok":true,"value":3}', Schema, {
      task: 'unit',
      system: 'sys',
    });
    expect(out).toEqual({ ok: true, value: 3 });
  });

  it('strips ```json fences before parsing', async () => {
    const service = new AiJsonValidationService(new AiProviderService(new MockAiProvider()));
    const raw = '```json\n{"ok":false,"value":7}\n```';
    const out = await service.parseAndValidate(raw, Schema, { task: 'unit', system: 'sys' });
    expect(out).toEqual({ ok: false, value: 7 });
  });

  it('repairs once when the first response is malformed', async () => {
    const provider = new MockAiProvider();
    // The repair call pulls from the queued response (a valid JSON).
    provider.setNextResponse('{"ok":true,"value":42}');
    const service = new AiJsonValidationService(new AiProviderService(provider));

    const out = await service.parseAndValidate('not json at all', Schema, {
      task: 'unit',
      system: 'sys',
    });
    expect(out).toEqual({ ok: true, value: 42 });
  });

  it('throws AiInvalidJsonError after a failed repair', async () => {
    const provider = new MockAiProvider();
    provider.setNextResponse('still not json');
    const service = new AiJsonValidationService(new AiProviderService(provider));

    await expect(
      service.parseAndValidate('garbage', Schema, { task: 'unit', system: 'sys' }),
    ).rejects.toBeInstanceOf(AiInvalidJsonError);
  });
});
