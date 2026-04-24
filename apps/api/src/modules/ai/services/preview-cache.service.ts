import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';

interface Entry<T> {
  userId: string;
  value: T;
  expiresAt: number;
}

/**
 * Tiny in-process TTL cache for "preview then apply" flows.
 * For multi-instance deployments swap with Redis. Keyed by random previewId
 * and scoped to userId — entries are unreadable by other users.
 */
@Injectable()
export class PreviewCacheService {
  private readonly store = new Map<string, Entry<unknown>>();
  private readonly defaultTtlMs = 15 * 60 * 1000;

  put<T>(userId: string, value: T, ttlMs = this.defaultTtlMs): string {
    this.gc();
    const id = randomUUID();
    this.store.set(id, { userId, value, expiresAt: Date.now() + ttlMs });
    return id;
  }

  get<T>(userId: string, previewId: string): T | null {
    const entry = this.store.get(previewId) as Entry<T> | undefined;
    if (!entry) return null;
    if (entry.userId !== userId || entry.expiresAt < Date.now()) {
      this.store.delete(previewId);
      return null;
    }
    return entry.value;
  }

  delete(previewId: string): void {
    this.store.delete(previewId);
  }

  private gc(): void {
    if (this.store.size < 256) return;
    const now = Date.now();
    for (const [k, v] of this.store) {
      if (v.expiresAt < now) this.store.delete(k);
    }
  }
}
