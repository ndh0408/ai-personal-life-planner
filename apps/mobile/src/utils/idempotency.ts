/**
 * Stable per-mount idempotency key generator.
 *
 * Server enforces uniqueness on (userId, idempotencyKey) — replays return
 * the same row instead of double-charging the wallet. Mobile generates a
 * key once per form mount via `useRef(makeIdempotencyKey()).current`, which
 * survives mutation retries within the same form session.
 *
 * The key has no cryptographic guarantees — collision probability across
 * users for a single second is ~ 2^-40, low enough that the server-side
 * unique constraint per (userId, key) makes accidental collisions harmless.
 */
export function makeIdempotencyKey(): string {
  return `mob_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}
