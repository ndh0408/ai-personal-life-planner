import { Injectable } from '@nestjs/common';
import { registry, type AnyPrompt, type PromptId } from '@lifeos/prompts';

/**
 * Thin Nest wrapper around the @lifeos/prompts registry. Exists so
 * controllers / other services depend on the Nest provider rather than
 * importing the singleton directly — easier to mock in unit tests and to
 * extend with telemetry (cost/latency per prompt id) in Phase 2.
 */
@Injectable()
export class PromptRegistryService {
  resolve(id: PromptId, version?: string): AnyPrompt {
    return registry.resolve(id, version);
  }

  list(): AnyPrompt[] {
    return registry.list();
  }

  /**
   * Convenience: render a prompt with provided input. Returns the system /
   * user message pair plus model + temp metadata so the LLM caller can
   * make a single fetch and stamp `provenance.promptVersion` from `version`.
   */
  render<TIn>(id: PromptId, input: TIn, version?: string) {
    const prompt = this.resolve(id, version);
    prompt.inputSchema.parse(input); // throws on bad input — fail loud
    const rendered = prompt.render(input);
    return {
      ...rendered,
      promptId: prompt.id,
      promptVersion: prompt.version,
      defaultModel: prompt.defaultModel,
      temperature: prompt.temperature,
      outputSchema: prompt.outputSchema,
    };
  }
}
