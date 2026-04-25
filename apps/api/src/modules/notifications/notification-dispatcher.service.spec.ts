import { NotificationDispatcherService } from './notification-dispatcher.service';
import type { PrismaService } from '../../prisma/prisma.service';
import type { QueueService } from '../queue/queue.service';

function makePrisma() {
  const rows: any[] = [];
  return {
    rows,
    api: {
      notificationLog: {
        create: jest.fn(async ({ data }: any) => {
          if (data.idempotencyKey) {
            const dup = rows.find(
              (r) => r.userId === data.userId && r.idempotencyKey === data.idempotencyKey,
            );
            if (dup) {
              const err: any = new Error('unique violation');
              err.code = 'P2002';
              throw err;
            }
          }
          const row = { id: `log-${rows.length + 1}`, ...data };
          rows.push(row);
          return row;
        }),
        findFirst: jest.fn(async ({ where }: any) =>
          rows.find(
            (r) => r.userId === where.userId && r.idempotencyKey === where.idempotencyKey,
          ) ?? null,
        ),
      },
    } as unknown as PrismaService,
  };
}

function makeQueue(): { svc: QueueService; calls: any[] } {
  const calls: any[] = [];
  return {
    calls,
    svc: {
      enqueue: jest.fn(async (...args: any[]) => {
        calls.push(args);
        return { id: 'job-1' };
      }),
    } as unknown as QueueService,
  };
}

describe('NotificationDispatcherService', () => {
  it('writes a PENDING log row and enqueues a send job', async () => {
    const { rows, api } = makePrisma();
    const { svc: queue, calls } = makeQueue();
    const sut = new NotificationDispatcherService(api, queue);

    const r = await sut.dispatch({
      userId: 'u1',
      type: 'reminder.task',
      title: 'Take meds',
    });

    expect(r.deduped).toBe(false);
    expect(rows[0].status).toBe('PENDING');
    expect(rows[0].userId).toBe('u1');
    expect(calls).toHaveLength(1);
    expect(calls[0][2]).toEqual({ logId: rows[0].id });
  });

  it('dedupes when called twice with the same idempotencyKey', async () => {
    const { rows, api } = makePrisma();
    const { svc: queue, calls } = makeQueue();
    const sut = new NotificationDispatcherService(api, queue);

    const a = await sut.dispatch({
      userId: 'u1',
      type: 'recommendation.high',
      title: 'X',
      idempotencyKey: 'recX',
    });
    const b = await sut.dispatch({
      userId: 'u1',
      type: 'recommendation.high',
      title: 'X',
      idempotencyKey: 'recX',
    });

    expect(a.deduped).toBe(false);
    expect(b.deduped).toBe(true);
    expect(b.id).toBe(a.id);
    expect(rows).toHaveLength(1);
    expect(calls).toHaveLength(1);
  });

  it('does NOT enqueue when queue layer is disabled (returns null) — log row still written', async () => {
    const { rows, api } = makePrisma();
    const queue = { enqueue: jest.fn(async () => null) } as unknown as QueueService;
    const sut = new NotificationDispatcherService(api, queue);

    await sut.dispatch({ userId: 'u1', type: 'generic', title: 'hi' });
    expect(rows).toHaveLength(1);
  });
});
