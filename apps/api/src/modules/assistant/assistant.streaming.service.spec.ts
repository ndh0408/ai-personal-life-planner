import { AssistantStreamingService } from './assistant.streaming.service';
import type { PrismaService } from '../../prisma/prisma.service';
import type { UserContextService } from '../intelligence/user-context.service';
import type { LlmService } from '../../common/llm/llm.service';
import type { LlmStreamEvent } from '../../common/llm/llm.types';
import type { ActionSuggesterService } from './action-suggester.service';

function fakeActions(): ActionSuggesterService {
  return { suggest: jest.fn(() => []) } as unknown as ActionSuggesterService;
}

/** Build a fake LlmService that yields a fixed series of stream events. */
function fakeLlm(opts: { events: LlmStreamEvent[] }): LlmService {
  return {
    async *responsesStream() {
      for (const ev of opts.events) yield ev;
    },
  } as unknown as LlmService;
}

function fakePrisma() {
  return {
    aIMessage: {
      findMany: jest.fn(async () => []),
      create: jest.fn(async () => ({ id: 'msg-final' })),
    },
    aIConversation: {
      update: jest.fn(async () => undefined),
    },
  } as unknown as PrismaService;
}

function fakeUserCtx() {
  return {
    build: jest.fn(async () => ({
      profile: {
        preferredName: 'Nam',
        locale: 'vi',
        mainGoals: [],
        usualWakeTime: null,
        usualSleepTime: null,
        dislikes: [],
        allergies: [],
        monthlyGoal: null,
        workPattern: null,
        budgetMonthly: null,
      },
      now: '2026-04-29T09:00:00.000Z',
      tz: 'Asia/Ho_Chi_Minh',
      lastSleepMinutes: null,
      lastMood: null,
      todaySpendVnd: null,
      monthSpendVnd: null,
      openHighPriorityTaskCount: null,
      memories: [],
      privacy: {
        personalizationEnabled: true,
        useFinanceForAI: true,
        useHealthForAI: true,
        useMealsForAI: true,
        useTasksForAI: true,
        aiMemoryEnabled: true,
      },
    })),
  } as unknown as UserContextService;
}

describe('AssistantStreamingService', () => {
  it('emits started → progress(reading_snapshot) → progress(calling_llm) → delta × N → completed', async () => {
    const events: LlmStreamEvent[] = [
      { type: 'delta', delta: 'Sáng nay' },
      { type: 'delta', delta: ' bạn nên' },
      { type: 'delta', delta: ' ưu tiên' },
      { type: 'done', finalText: 'Sáng nay bạn nên ưu tiên' },
    ];
    const svc = new AssistantStreamingService(
      fakePrisma(),
      fakeUserCtx(),
      fakeLlm({ events }),
      fakeActions(),
    );

    const out = [];
    for await (const ev of svc.run({
      userId: 'u1',
      threadId: 'thr1',
      messageId: 'msg1',
      conversationId: 'thr1',
      userText: 'hôm nay tôi nên làm gì?',
    })) {
      out.push(ev);
    }

    expect(out[0].type).toBe('assistant.stream.started');
    expect(out[1].type).toBe('assistant.stream.progress');
    expect((out[1] as { stage: string }).stage).toBe('reading_snapshot');
    expect(out[2].type).toBe('assistant.stream.progress');
    expect((out[2] as { stage: string }).stage).toBe('calling_llm');
    expect(out[3].type).toBe('assistant.stream.delta');
    expect((out[3] as { delta: string }).delta).toBe('Sáng nay');
    expect(out.at(-1)!.type).toBe('assistant.stream.completed');
    expect((out.at(-1) as { finalText: string }).finalText).toBe('Sáng nay bạn nên ưu tiên');
  });

  it('seq is monotonically increasing and 0-based', async () => {
    const events: LlmStreamEvent[] = [
      { type: 'delta', delta: 'A' },
      { type: 'delta', delta: 'B' },
      { type: 'done', finalText: 'AB' },
    ];
    const svc = new AssistantStreamingService(
      fakePrisma(),
      fakeUserCtx(),
      fakeLlm({ events }),
      fakeActions(),
    );
    const seqs: number[] = [];
    for await (const ev of svc.run({
      userId: 'u1',
      threadId: 'thr1',
      messageId: 'msg1',
      conversationId: 'thr1',
      userText: 'x',
    })) {
      seqs.push(ev.seq);
    }
    expect(seqs[0]).toBe(0);
    for (let i = 1; i < seqs.length; i++) expect(seqs[i]).toBe(seqs[i - 1] + 1);
  });

  it('forwards LlmService error events as assistant.stream.error', async () => {
    const events: LlmStreamEvent[] = [
      { type: 'error', code: 'AI_KEY_MISSING', message: 'No key' },
    ];
    const svc = new AssistantStreamingService(
      fakePrisma(),
      fakeUserCtx(),
      fakeLlm({ events }),
      fakeActions(),
    );
    const out = [];
    for await (const ev of svc.run({
      userId: 'u1',
      threadId: 'thr1',
      messageId: 'msg1',
      conversationId: 'thr1',
      userText: 'x',
    })) {
      out.push(ev);
    }
    const err = out.find((e) => e.type === 'assistant.stream.error');
    expect(err).toBeDefined();
    expect((err as { code: string }).code).toBe('AI_KEY_MISSING');
  });
});
