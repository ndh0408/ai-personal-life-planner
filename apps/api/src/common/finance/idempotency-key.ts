/**
 * Sanitise an Idempotency-Key header value:
 *   - trim whitespace
 *   - reject empty / >128-char inputs (treat as "not provided")
 *   - reject anything outside [A-Za-z0-9._:-] so malicious headers can't
 *     poison the unique-index lookup.
 *
 * Returning `undefined` means "no idempotency requested"; the service
 * proceeds with non-idempotent semantics.
 */
export function sanitiseIdemKey(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  const trimmed = raw.trim();
  if (trimmed.length === 0 || trimmed.length > 128) return undefined;
  if (!/^[A-Za-z0-9._:-]+$/.test(trimmed)) return undefined;
  return trimmed;
}
