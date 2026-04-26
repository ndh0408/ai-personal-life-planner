import { Injectable } from '@nestjs/common';
import type { CaptureParseRequest, CaptureParseResponse } from '@lifeos/shared';
import { runRuleParsers } from './parsers';
import { OpenAiParser } from './parsers/openai.parser';

const RULE_CONFIDENCE_THRESHOLD = 0.7;

@Injectable()
export class CaptureService {
  constructor(private readonly llm: OpenAiParser) {}

  async parse(userId: string, input: CaptureParseRequest): Promise<CaptureParseResponse> {
    const now = input.nowIso ? new Date(input.nowIso) : new Date();
    const ctx = { now, tz: input.tz };

    // Pass 1: rule parsers — cheap, no AI cost.
    const ruleHit = runRuleParsers(input.text, ctx);

    if (ruleHit && ruleHit.confidence >= RULE_CONFIDENCE_THRESHOLD) {
      return toResponse(ruleHit);
    }

    // Pass 2: ask the LLM. If the user has no key or the call fails, return
    // either the weak rule hit or UNKNOWN — never throw.
    const llmHit = await this.llm.tryParse(userId, input.text, ctx);

    const best = pickHigherConfidence(ruleHit, llmHit);
    if (best) return toResponse(best);

    return {
      kind: 'UNKNOWN',
      source: 'RULE',
      confidence: 0,
      fields: {},
      previewText: '?',
      hint: 'Mình chưa rõ ý — gõ rõ hơn hoặc chọn loại bên dưới.',
    };
  }
}

function pickHigherConfidence<T extends { confidence: number } | null>(a: T, b: T): T {
  if (!a) return b;
  if (!b) return a;
  return a.confidence >= b.confidence ? a : b;
}

function toResponse(hit: NonNullable<ReturnType<typeof runRuleParsers>>): CaptureParseResponse {
  return {
    kind: hit.kind,
    source: hit.source,
    confidence: Number(hit.confidence.toFixed(3)),
    fields: hit.fields,
    previewText: hit.previewText,
    hint: hit.hint,
  };
}
