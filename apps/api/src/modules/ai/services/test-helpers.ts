import type { AiCompletionRequest } from '../providers/ai-provider.interface';
import type { AiProviderService, OrchestratorOptions } from './ai-provider.service';
import type { AiProviderResolverService, AiTask } from './ai-provider-resolver.service';

/**
 * Build a thin resolver stub for unit tests — no Prisma, no encryption.
 * Always routes through the global `AiProviderService`, so existing AI service
 * tests can keep constructing a `MockAiProvider` and exercising fallback paths
 * without needing a UserAiProvider DB row.
 *
 * Production code uses the real {@link AiProviderResolverService}.
 */
export function makeStubResolver(provider: AiProviderService): AiProviderResolverService {
  return {
    completeForUser: async (
      _userId: string,
      _task: AiTask,
      req: AiCompletionRequest,
      opts: OrchestratorOptions = {},
    ) => {
      const r = await provider.complete(req, opts);
      return { ...r, usedFallback: false, userScope: 'global' as const };
    },
  } as unknown as AiProviderResolverService;
}
