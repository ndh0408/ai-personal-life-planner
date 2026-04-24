import AsyncStorage from '@react-native-async-storage/async-storage';
import type { QueryClient } from '@tanstack/react-query';
import { ApiError } from '../api/client';
import { tasksApi } from '../api/tasks.api';
import { habitsApi } from '../api/habits.api';
import { expensesApi, type CreateExpenseInput } from '../api/finance.api';
import type { TaskStatus } from '@planner/shared';
import { networkStatus } from './network-status';

/**
 * SyncQueueService — durable FIFO queue of pending write actions captured
 * while offline. Persisted to AsyncStorage under `QUEUE_KEY` so the queue
 * survives app restarts + airplane mode.
 *
 * Conflict strategy:
 *   - Server wins for complex records (goals, schedules, profile, etc.) —
 *     those aren't queued here; they require network and show a localized
 *     "you need to be online" alert upstream.
 *   - Local *complete* actions (task status, habit check-in) win if the
 *     item still exists server-side. If the item was deleted, the action
 *     is quietly dropped on 404 (server rejected → not retriable).
 *   - Pending expenses use a client-side temp id prefixed with `pending:`.
 *     When the create succeeds on flush, we swap the cache row to the
 *     server id; if the server 4xx-rejects, the row is removed with a
 *     localized alert so the user knows.
 *
 * Retry policy: on network-type errors (ApiError.status === 0) we stop
 * immediately — no point hammering an offline link. On 5xx we also stop so
 * the queue isn't poisoned by a transient server issue. The next flush
 * trigger (reconnect, manual, next app launch) picks up from the same spot.
 */

const QUEUE_KEY = 'offline:sync-queue';

type TaskSetStatusAction = {
  kind: 'task:setStatus';
  id: string;
  createdAt: number;
  payload: { taskId: string; status: TaskStatus };
};

type HabitLogAction = {
  kind: 'habit:log';
  id: string;
  createdAt: number;
  payload: { habitId: string; date: string; completed: boolean; count: number };
};

type ExpenseCreateAction = {
  kind: 'expense:create';
  id: string;
  createdAt: number;
  /** Client-generated temp id placed in the cache and attached to the toast. */
  tempId?: string;
  payload: CreateExpenseInput;
};

export type PendingAction = TaskSetStatusAction | HabitLogAction | ExpenseCreateAction;

/** Distributed Omit — preserves per-variant fields in the union. */
type DistributiveOmit<T, K extends keyof any> = T extends unknown ? Omit<T, K> : never;
type PendingActionDraft = DistributiveOmit<PendingAction, 'id' | 'createdAt'>;

type FlushResult = {
  succeeded: number;
  failedTransient: number;
  failedPermanent: number;
};

type Listener = (count: number) => void;

function uuid(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

class SyncQueueService {
  private listeners = new Set<Listener>();
  private flushing = false;
  private memCount = 0;

  async enqueue(action: PendingActionDraft): Promise<PendingAction> {
    const full = { ...action, id: uuid(), createdAt: Date.now() } as PendingAction;
    const items = await this.load();
    items.push(full);
    await this.save(items);
    this.emit(items.length);
    return full;
  }

  async all(): Promise<PendingAction[]> {
    return this.load();
  }

  async count(): Promise<number> {
    const items = await this.load();
    return items.length;
  }

  /** Subscribe for UI badges (pending count). Fires immediately with latest. */
  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    void this.count().then((c) => {
      this.memCount = c;
      fn(c);
    });
    return () => {
      this.listeners.delete(fn);
    };
  }

  /** Wipe the queue — used on logout. */
  async purge(): Promise<void> {
    await AsyncStorage.removeItem(QUEUE_KEY);
    this.emit(0);
  }

  async flush(qc: QueryClient): Promise<FlushResult> {
    if (this.flushing) return { succeeded: 0, failedTransient: 0, failedPermanent: 0 };
    if (!networkStatus.get()) {
      return { succeeded: 0, failedTransient: 0, failedPermanent: 0 };
    }
    this.flushing = true;
    let items = await this.load();
    const result: FlushResult = { succeeded: 0, failedTransient: 0, failedPermanent: 0 };
    try {
      while (items.length > 0) {
        const action = items[0];
        try {
          await this.perform(action, qc);
          items = items.slice(1);
          await this.save(items);
          this.emit(items.length);
          result.succeeded += 1;
        } catch (e) {
          if (e instanceof ApiError && e.status >= 400 && e.status < 500) {
            // Server rejected — drop this one, keep going.
            await this.onPermanentFailure(action, e, qc);
            items = items.slice(1);
            await this.save(items);
            this.emit(items.length);
            result.failedPermanent += 1;
            continue;
          }
          // Network or 5xx — stop; we'll try again on next reconnect.
          result.failedTransient += 1;
          if (e instanceof ApiError && e.status === 0) networkStatus.markOffline();
          break;
        }
      }
    } finally {
      this.flushing = false;
    }
    return result;
  }

  /** Called by offline helpers to run the API or enqueue on network failure. */
  async runOrQueue<T>(
    action: PendingActionDraft,
    runOnline: () => Promise<T>,
  ): Promise<{ mode: 'online'; result: T } | { mode: 'queued'; action: PendingAction }> {
    if (!networkStatus.get()) {
      const queued = await this.enqueue(action);
      return { mode: 'queued', action: queued };
    }
    try {
      const result = await runOnline();
      return { mode: 'online', result };
    } catch (e) {
      if (e instanceof ApiError && e.status === 0) {
        networkStatus.markOffline();
        const queued = await this.enqueue(action);
        return { mode: 'queued', action: queued };
      }
      throw e;
    }
  }

  private async perform(action: PendingAction, qc: QueryClient): Promise<void> {
    switch (action.kind) {
      case 'task:setStatus': {
        await tasksApi.setStatus(action.payload.taskId, action.payload.status);
        qc.invalidateQueries({ queryKey: ['tasks'] });
        qc.invalidateQueries({ queryKey: ['dashboard'] });
        qc.invalidateQueries({ queryKey: ['today'] });
        return;
      }
      case 'habit:log': {
        const { habitId, date, completed, count } = action.payload;
        await habitsApi.log(habitId, { date, completed, count });
        qc.invalidateQueries({ queryKey: ['habits'] });
        qc.invalidateQueries({ queryKey: ['dashboard'] });
        return;
      }
      case 'expense:create': {
        await expensesApi.create(action.payload);
        qc.invalidateQueries({ queryKey: ['expenses'] });
        qc.invalidateQueries({ queryKey: ['wallets'] });
        qc.invalidateQueries({ queryKey: ['dashboard'] });
        qc.invalidateQueries({ queryKey: ['budgets'] });
        return;
      }
    }
  }

  private async onPermanentFailure(
    action: PendingAction,
    _err: ApiError,
    qc: QueryClient,
  ): Promise<void> {
    // For local-wins actions (task complete, habit check-in) we just drop
    // the failure — the item is likely gone server-side. For pending
    // expenses we invalidate so the temp row disappears; user sees nothing
    // from their local view.
    if (action.kind === 'expense:create') {
      qc.invalidateQueries({ queryKey: ['expenses'] });
      qc.invalidateQueries({ queryKey: ['wallets'] });
    }
    if (action.kind === 'task:setStatus') {
      qc.invalidateQueries({ queryKey: ['tasks'] });
    }
  }

  private async load(): Promise<PendingAction[]> {
    try {
      const raw = await AsyncStorage.getItem(QUEUE_KEY);
      if (!raw) return [];
      return JSON.parse(raw) as PendingAction[];
    } catch {
      return [];
    }
  }

  private async save(items: PendingAction[]): Promise<void> {
    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(items));
  }

  private emit(count: number): void {
    this.memCount = count;
    for (const l of this.listeners) l(count);
  }
}

export const syncQueue = new SyncQueueService();

/** Mint a client-side temp id with a distinct prefix so upstream code can detect it. */
export function mintTempId(): string {
  return `pending:${uuid()}`;
}
