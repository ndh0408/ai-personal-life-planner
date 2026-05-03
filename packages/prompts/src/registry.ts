import { z } from 'zod';

/**
 * A prompt is a typed function: (input) → string. Versioned at module level
 * (`captureClassifier.v3`), not inside the body, so eval suites can pin a
 * specific version while production rolls forward.
 *
 * Why a registry instead of inline strings:
 *   - One place to audit every text the LLM ever sees.
 *   - Eval harness imports by id, asserts accuracy ≥ baseline before merge.
 *   - Version metadata travels with `provenance.promptVersion` to the client
 *     ("Why this?" sheet), so users see which brain produced an answer.
 */

export type PromptId = string;

export interface PromptDefinition<TInput, TOutputShape extends z.ZodTypeAny> {
  /** Stable id, e.g. "capture-classifier". */
  id: PromptId;
  /** Semver-ish. Bump major when output schema changes. */
  version: string;
  /** Input zod — runtime-validates, prevents prompt injection via shape. */
  inputSchema: z.ZodTypeAny;
  /** Output zod — used with structured outputs / function calling. */
  outputSchema: TOutputShape;
  /** Render — pure function, no side effects, no fetch. */
  render: (input: TInput) => { system: string; user: string };
  /** Default model id; consumers can override. */
  defaultModel: string;
  /** Default temperature. Most prompts want low. */
  temperature: number;
}

export type AnyPrompt = PromptDefinition<unknown, z.ZodTypeAny>;

class PromptRegistry {
  private readonly map = new Map<string, AnyPrompt>();

  register<I, O extends z.ZodTypeAny>(prompt: PromptDefinition<I, O>): void {
    const key = `${prompt.id}@${prompt.version}`;
    if (this.map.has(key)) {
      throw new Error(`Prompt already registered: ${key}`);
    }
    this.map.set(key, prompt as unknown as AnyPrompt);
  }

  /** Resolve by id; returns the highest-registered version unless pinned. */
  resolve(id: PromptId, version?: string): AnyPrompt {
    if (version) {
      const pinned = this.map.get(`${id}@${version}`);
      if (!pinned) throw new Error(`Prompt not found: ${id}@${version}`);
      return pinned;
    }
    const candidates = [...this.map.values()].filter((p) => p.id === id);
    if (candidates.length === 0) throw new Error(`Prompt not found: ${id}`);
    return candidates.sort((a, b) => semverCompare(b.version, a.version))[0];
  }

  list(): AnyPrompt[] {
    return [...this.map.values()];
  }
}

function semverCompare(a: string, b: string): number {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    const da = pa[i] ?? 0;
    const db = pb[i] ?? 0;
    if (da !== db) return da - db;
  }
  return 0;
}

/** Singleton — every prompt module self-registers on import. */
export const registry = new PromptRegistry();
