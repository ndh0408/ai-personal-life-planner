import { AssistantStreamingService } from './assistant.streaming.service';
import type { PrismaService } from '../../prisma/prisma.service';
import type { EncryptionService } from '../../common/crypto/encryption.service';
import type { ConfigService } from '@nestjs/config';
import type { UserContextService } from '../intelligence/user-context.service';
import OpenAI from 'openai';

jest.mock('openai');

interface FakeChunk {
  choices: { delta: { content?: string } }[];
}

function fakeOpenAiStream(chunks: string[]): AsyncIterable<FakeChunk> {
  return {
    [Symbol.asyncIterator]() {
      let i = 0;
      return {
        next(): Promise<IteratorResult<FakeChunk>> {
          if (i >= chunks.length) return Promise.resolve({ value: undefined as unknown as FakeChunk, done: true });
          const chunk: FakeChunk = { choices: [{ delta: { content: chunks[i++] } }] };
          return Promise.resolve({ value: chunk, done: false });
        },
        return() {
          return Promise.resolve({ value: undefined as unknown as FakeChunk, done: true });
        },
      };
    },
  };
}

function makeService(opts: { llmChunks?: string[]; haveKey?: boolean }) {
  const prisma = {
    aIMessage: {
      findMany: jest.fn(async () => []),
      create: jest.fn(async () => ({ id: 'msg-final' })),
    },
    aIConversation: {
      update: jest.fn(async () => undefined),
    },
    userAiKey: {
      findUnique: jest.fn(async () =>
        opts.haveKey === false
          ? null
          : { encryptedApiKey: 'iv:ct:tag', isActive: true, baseUrl: 'https://api.openai.com/v1', defaultModel: 'gpt-4o-mini' },
      ),
    },
  } as unknown as PrismaService;

  const enc = { open: jest.fn(() => 'sk-test') } as unknown as EncryptionService;
  const config = { get: jest.fn(() => 'gpt-4o-mini') } as unknown as ConfigService;
  const userCtx = {
    build: jest.fn(async () => ({
      profile: { preferredName: 'Nam', locale: 'vi', mainGoals: [], usualWakeTime: null, usualSleepTime: null, dislikes: [], allergies: [], monthlyGoal: null, workPattern: null, budgetMonthly: null },
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

  // Mock OpenAI client constructor to return a stub with chat.completions.create
  // returning the desired stream.
  (OpenAI as unknown as jest.Mock).mockImplementation(() => ({
    chat: {
      completions: {
        create: jest.fn(async () => fakeOpenAiStream(opts.llmChunks ?? ['Hello', ' world'])),
      },
    },
  }));

  return new AssistantStreamingService(prisma, enc, config, userCtx);
}

describe('AssistantStreamingService', () => {
  it('emits started → progress(reading_snapshot) → progress(calling_llm) → delta × N → completed', async () => {
    const svc = makeService({ llmChunks: ['Sáng nay', ' bạn nên', ' ưu tiên'] });
    const events = [];
    for await (const ev of svc.run({
      userId: 'u1',
      threadId: 'thr1',
      messageId: 'msg1',
      conversationId: 'thr1',
      userText: 'hôm nay tôi nên làm gì?',
    })) {
      events.push(ev);
    }

    expect(events[0].type).toBe('assistant.stream.started');
    expect(events[1].type).toBe('assistant.stream.progress');
    expect((events[1] as { stage: string }).stage).toBe('reading_snapshot');
    expect(events[2].type).toBe('assistant.stream.progress');
    expect((events[2] as { stage: string }).stage).toBe('calling_llm');
    expect(events[3].type).toBe('assistant.stream.delta');
    expect((events[3] as { delta: string }).delta).toBe('Sáng nay');
    expect(events.at(-1)!.type).toBe('assistant.stream.completed');
    expect((events.at(-1) as { finalText: string }).finalText).toBe('Sáng nay bạn nên ưu tiên');
  });

  it('seq is monotonically increasing and 0-based', async () => {
    const svc = makeService({ llmChunks: ['A', 'B'] });
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

  it('emits an error event when the user has no AI key', async () => {
    const svc = makeService({ haveKey: false });
    const events = [];
    for await (const ev of svc.run({
      userId: 'u1',
      threadId: 'thr1',
      messageId: 'msg1',
      conversationId: 'thr1',
      userText: 'x',
    })) {
      events.push(ev);
    }
    const errorEv = events.find((e) => e.type === 'assistant.stream.error');
    expect(errorEv).toBeDefined();
  });
});
