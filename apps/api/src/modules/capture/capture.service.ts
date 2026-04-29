/**
 * Capture parser orchestrator (round 21).
 *
 * Routes a raw user sentence into a structured preview using a three-tier
 * confidence policy:
 *
 *   strong rule (≥ STRONG)     → return rule, source=RULE, no LLM call
 *   medium  (MEDIUM..STRONG)   → call LLM with recent-corrections few-shot;
 *                                pick whichever scores higher; mark source
 *                                HYBRID. Falls back to weak rule if LLM unavailable.
 *   weak    (< MEDIUM)         → UNKNOWN + needsReview. The UI surfaces the
 *                                kind picker.
 *
 * The previous single-threshold layout (≥ 0.7 → keep rule, < 0.7 → ask LLM)
 * had two failure modes:
 *   1. Rule-confident-enough-not-to-ask but actually wrong (e.g. "ăn phở
 *      60k với khách" — "ăn" steers it toward MEAL but the amount makes
 *      EXPENSE more likely). Tier 1 used to swallow these silently. Tier 2
 *      now rechecks them.
 *   2. Low-confidence rule treated as truth when LLM was unavailable. The
 *      new policy returns `needsReview = true` so the UI doesn't pretend
 *      the parser is sure.
 */
import { Injectable } from '@nestjs/common';
import type { CaptureParseRequest, CaptureParseResponse, ParserSource } from '@lifeos/shared';
import { runRuleParsers } from './parsers';
import type { ParseHit } from './parsers/types';
import { OpenAiParser } from './parsers/openai.parser';
import { CorrectionsService } from './corrections.service';

/** Rule confidence above which we trust the rule outright. */
export const STRONG_THRESHOLD = 0.9;
/** Rule confidence below which the parse is too uncertain even for the LLM
 *  to disambiguate from one short sentence — UI must ask the user. */
export const MEDIUM_THRESHOLD = 0.55;
/** Margin by which the LLM must beat the rule to override it in the medium tier. */
const LLM_OVERRIDE_MARGIN = 0.05;

@Injectable()
export class CaptureService {
  constructor(
    private readonly llm: OpenAiParser,
    private readonly corrections: CorrectionsService,
  ) {}

  async parse(userId: string, input: CaptureParseRequest): Promise<CaptureParseResponse> {
    const now = input.nowIso ? new Date(input.nowIso) : new Date();
    const ctx = { now, tz: input.tz };

    const ruleHit = runRuleParsers(input.text, ctx);

    // Tier 1: strong rule wins, no LLM trip.
    if (ruleHit && ruleHit.confidence >= STRONG_THRESHOLD) {
      return toResponse(ruleHit, { source: 'RULE', needsReview: false });
    }

    // Tier 2: medium-confidence rule (or no rule but the user has said
    // something parsable). Ask the LLM with few-shot examples drawn from
    // this user's past corrections — they steer the model toward this
    // user's specific vocabulary ("trà sữa Phúc Long" was their EXPENSE,
    // not a brand-name MEAL, etc).
    const recentCorrections = await this.corrections.recentForUser(userId, 5);
    const llmHit = await this.llm.tryParse(userId, input.text, ctx, recentCorrections);

    const winner = pickWinner(ruleHit, llmHit);
    if (winner) {
      // HYBRID when both produced a hit; otherwise whichever single path won.
      const source: ParserSource =
        ruleHit && llmHit ? 'HYBRID' : winner === ruleHit ? 'RULE' : 'OPENAI';
      const needsReview =
        winner.confidence < MEDIUM_THRESHOLD || (source === 'RULE' && !llmHit && winner.confidence < STRONG_THRESHOLD);
      return toResponse(winner, { source, needsReview });
    }

    // Tier 3: nothing came back. UNKNOWN.
    return {
      kind: 'UNKNOWN',
      source: 'RULE',
      confidence: 0,
      fields: {},
      previewText: '?',
      hint: 'Mình chưa rõ ý — gõ rõ hơn hoặc chọn loại bên dưới.',
      needsReview: true,
    };
  }
}

function pickWinner(rule: ParseHit | null, llm: ParseHit | null): ParseHit | null {
  if (!rule && !llm) return null;
  if (!rule) return llm;
  if (!llm) return rule;
  // Defer to the LLM only if it beat the rule by a meaningful margin —
  // otherwise the rule's deterministic regex output is the safer pick.
  if (llm.confidence - rule.confidence >= LLM_OVERRIDE_MARGIN) return llm;
  return rule;
}

function toResponse(
  hit: ParseHit,
  meta: { source: ParserSource; needsReview: boolean },
): CaptureParseResponse {
  return {
    kind: hit.kind,
    source: meta.source,
    confidence: Number(hit.confidence.toFixed(3)),
    fields: hit.fields,
    previewText: hit.previewText,
    hint: hit.hint,
    needsReview: meta.needsReview,
  };
}
