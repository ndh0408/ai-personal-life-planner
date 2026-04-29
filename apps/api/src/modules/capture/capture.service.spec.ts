import { CaptureService, MEDIUM_THRESHOLD, STRONG_THRESHOLD } from './capture.service';
import type { OpenAiParser } from './parsers/openai.parser';
import type { CorrectionsService } from './corrections.service';
import type { ParseHit } from './parsers/types';

// Replace the rule parser entry points with stubs so each test controls
// the rule outcome. The service calls runRuleParsersAll() (round 30) to
// also build the alternatives list — this mock returns a single-element
// array so existing assertions still work and the alternatives derivation
// just gets one input.
jest.mock('./parsers', () => ({
  runRuleParsers: jest.fn(),
  runRuleParsersAll: jest.fn(),
}));
import { runRuleParsers, runRuleParsersAll } from './parsers';

const TZ = 'Asia/Ho_Chi_Minh';

function expenseHit(confidence: number, source: 'RULE' | 'OPENAI' = 'RULE'): ParseHit {
  return {
    kind: 'EXPENSE',
    source,
    confidence,
    fields: { title: 'phở', amount: 60_000, currency: 'VND', category: 'food', expenseDateIso: new Date().toISOString() },
    previewText: 'phở',
  };
}

function setRuleHit(hit: ParseHit | null) {
  (runRuleParsers as jest.Mock).mockReturnValue(hit);
  (runRuleParsersAll as jest.Mock).mockReturnValue(hit ? [hit] : []);
}

function makeService(overrides?: { llmReturn?: ParseHit | null; corrections?: unknown[] }) {
  const llm = {
    tryParse: jest.fn(async () => overrides?.llmReturn ?? null),
  } as unknown as OpenAiParser;
  const corrections = {
    recentForUser: jest.fn(async () => overrides?.corrections ?? []),
  } as unknown as CorrectionsService;
  return { svc: new CaptureService(llm, corrections), llm, corrections };
}

describe('CaptureService — three-tier routing', () => {
  beforeEach(() => {
    (runRuleParsers as jest.Mock).mockReset();
    (runRuleParsersAll as jest.Mock).mockReset();
  });

  it(`tier 1 — strong rule (≥ ${STRONG_THRESHOLD}) skips LLM`, async () => {
    setRuleHit(expenseHit(0.92));
    const { svc, llm } = makeService();
    const out = await svc.parse('u1', { text: 'ăn phở 60k', tz: TZ });
    expect(out.kind).toBe('EXPENSE');
    expect(out.source).toBe('RULE');
    expect(out.needsReview).toBe(false);
    expect(llm.tryParse).not.toHaveBeenCalled();
  });

  it('tier 2 — medium rule confidence triggers LLM call', async () => {
    setRuleHit(expenseHit(0.7));
    const llmHit = expenseHit(0.85, 'OPENAI');
    const { svc, llm } = makeService({ llmReturn: llmHit });
    const out = await svc.parse('u1', { text: 'ăn phở 60k với khách', tz: TZ });
    expect(llm.tryParse).toHaveBeenCalled();
    // LLM beat rule by 0.15 (> margin 0.05) → HYBRID, picked LLM
    expect(out.source).toBe('HYBRID');
    expect(out.needsReview).toBe(false);
  });

  it('tier 2 — LLM only nudges (within margin) keeps rule', async () => {
    setRuleHit(expenseHit(0.8));
    const llmHit = expenseHit(0.82, 'OPENAI');
    const { svc } = makeService({ llmReturn: llmHit });
    const out = await svc.parse('u1', { text: 'phở 60k', tz: TZ });
    // Diff 0.02 < margin 0.05 → keep rule, but report HYBRID since LLM was consulted
    expect(out.source).toBe('HYBRID');
  });

  it('tier 2 — LLM unavailable + medium rule = needsReview', async () => {
    setRuleHit(expenseHit(0.6));
    const { svc } = makeService({ llmReturn: null });
    const out = await svc.parse('u1', { text: 'mơ hồ', tz: TZ });
    expect(out.source).toBe('RULE');
    expect(out.needsReview).toBe(true);
  });

  it(`tier 3 — rule below ${MEDIUM_THRESHOLD} and no LLM = UNKNOWN + needsReview`, async () => {
    setRuleHit(null);
    const { svc } = makeService({ llmReturn: null });
    const out = await svc.parse('u1', { text: '???', tz: TZ });
    expect(out.kind).toBe('UNKNOWN');
    expect(out.needsReview).toBe(true);
  });

  it('passes recent corrections to the LLM call', async () => {
    setRuleHit(expenseHit(0.7));
    const corrections = [{ rawText: 'trà sữa 60k', originalKind: 'MEAL', correctedKind: 'EXPENSE' }];
    const { svc, llm } = makeService({ llmReturn: expenseHit(0.85, 'OPENAI'), corrections });
    await svc.parse('u1', { text: 'trà sữa 60k', tz: TZ });
    expect(llm.tryParse).toHaveBeenCalledWith('u1', 'trà sữa 60k', expect.anything(), corrections);
  });
});

describe('CaptureService — alternatives (round 30)', () => {
  beforeEach(() => {
    (runRuleParsers as jest.Mock).mockReset();
    (runRuleParsersAll as jest.Mock).mockReset();
  });

  it('surfaces a runner-up rule hit as an alternative', async () => {
    const winner = expenseHit(0.92);
    const runnerUp: ParseHit = {
      kind: 'MEAL',
      source: 'RULE',
      confidence: 0.55,
      fields: {},
      previewText: 'phở (MEAL)',
    };
    (runRuleParsers as jest.Mock).mockReturnValue(winner);
    (runRuleParsersAll as jest.Mock).mockReturnValue([winner, runnerUp]);

    const { svc } = makeService();
    const out = await svc.parse('u1', { text: 'ăn phở 60k', tz: TZ });
    expect(out.alternatives).toHaveLength(1);
    expect(out.alternatives[0].kind).toBe('MEAL');
  });

  it('drops weak alternatives below 0.3 confidence', async () => {
    const winner = expenseHit(0.92);
    const weak: ParseHit = {
      kind: 'TASK',
      source: 'RULE',
      confidence: 0.15,
      fields: {},
      previewText: 'task?',
    };
    (runRuleParsers as jest.Mock).mockReturnValue(winner);
    (runRuleParsersAll as jest.Mock).mockReturnValue([winner, weak]);

    const { svc } = makeService();
    const out = await svc.parse('u1', { text: 'ăn phở 60k', tz: TZ });
    expect(out.alternatives).toEqual([]);
  });

  it('includes the LLM hit as an alternative when it disagrees with the rule', async () => {
    const ruleWinner = expenseHit(0.7);
    const llmHit: ParseHit = {
      kind: 'MEAL',
      source: 'OPENAI',
      confidence: 0.5,
      fields: {},
      previewText: 'phở (MEAL)',
    };
    (runRuleParsers as jest.Mock).mockReturnValue(ruleWinner);
    (runRuleParsersAll as jest.Mock).mockReturnValue([ruleWinner]);

    const { svc } = makeService({ llmReturn: llmHit });
    const out = await svc.parse('u1', { text: 'phở 60k', tz: TZ });
    // Rule wins (margin guard), LLM disagrees → its kind shows as alt.
    expect(out.alternatives.some((a) => a.kind === 'MEAL')).toBe(true);
  });
});
