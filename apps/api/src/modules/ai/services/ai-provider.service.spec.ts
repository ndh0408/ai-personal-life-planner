import { AiProviderService } from './ai-provider.service';
import { MockAiProvider } from '../providers/mock.provider';
import { AiTimeoutError } from '../providers/ai-provider.interface';
import { makeStubUsage } from './test-helpers';

describe('AiProviderService', () => {
  it('forwards a request and returns the provider response', async () => {
    const provider = new MockAiProvider();
    const service = new AiProviderService(provider, makeStubUsage());

    const res = await service.complete({ system: 'sys', prompt: '[task:chat] hi' });
    expect(JSON.parse(res.text).answer).toMatch(/walk/i);
    expect(res.provider).toBe('mock');
  });

  it('times out and surfaces AiTimeoutError', async () => {
    const provider = new MockAiProvider();
    provider.setHang(200);
    const service = new AiProviderService(provider, makeStubUsage());
    await expect(
      service.complete(
        { system: 'sys', prompt: 'anything' },
        { timeoutMs: 50, maxAttempts: 1 },
      ),
    ).rejects.toBeInstanceOf(AiTimeoutError);
  });

  it('retries once on timeout when maxAttempts=2', async () => {
    const provider = new MockAiProvider();
    let calls = 0;
    const original = provider.complete.bind(provider);
    provider.complete = async (req) => {
      calls++;
      if (calls === 1) {
        await new Promise((r) => setTimeout(r, 200));
      }
      return original(req);
    };
    const service = new AiProviderService(provider, makeStubUsage());
    const res = await service.complete(
      { system: 'sys', prompt: '[task:chat] retry-me' },
      { timeoutMs: 80, maxAttempts: 2, retryDelayMs: 1 },
    );
    expect(calls).toBe(2);
    expect(JSON.parse(res.text).answer).toBeTruthy();
  });
});
