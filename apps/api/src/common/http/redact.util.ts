/**
 * Strip secrets from values headed for the logger.
 *
 * Pino/Nest's logger doesn't know which fields are sensitive. If we let
 * exception payloads or request snapshots flow through unfiltered, an
 * Authorization header or a bcrypt hash could end up in stdout (and from
 * there, in the cloud log aggregator) — a clean OWASP A09 violation.
 *
 * This module is the single chokepoint. Any code that wants to log a
 * structured object should pass it through `redact()` first.
 */

const REDACT_KEY_PATTERNS = [
  /^authorization$/i,
  /^cookie$/i,
  /^set-cookie$/i,
  /password/i,
  /passwd/i,
  /secret/i,
  /token/i,
  /apikey/i,
  /api[_-]?key/i,
  /encrypted/i,
  /private[_-]?key/i,
  /refresh[_-]?token/i,
  /access[_-]?token/i,
];

const REDACTED = '[redacted]';
const MAX_DEPTH = 6;

function isSensitiveKey(key: string): boolean {
  return REDACT_KEY_PATTERNS.some((re) => re.test(key));
}

/**
 * Walk an arbitrary value and replace sensitive keys' values with [redacted].
 * Returns a new value — input is never mutated. Cycles are handled by depth
 * limit rather than a Set, since logger pipelines often re-pipe the result.
 */
export function redact<T>(value: T, depth = 0): T {
  if (depth > MAX_DEPTH) return REDACTED as unknown as T;
  if (value === null || value === undefined) return value;
  if (typeof value !== 'object') return value;
  if (value instanceof Error) {
    // Errors carry message/stack which are generally safe to log, but their
    // .cause and custom properties may not be. Re-build only the safe surface.
    const e = value as Error & Record<string, unknown>;
    return {
      name: e.name,
      message: e.message,
      stack: e.stack,
    } as unknown as T;
  }
  if (Array.isArray(value)) {
    return value.map((v) => redact(v, depth + 1)) as unknown as T;
  }
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (isSensitiveKey(k)) {
      out[k] = REDACTED;
    } else {
      out[k] = redact(v, depth + 1);
    }
  }
  return out as unknown as T;
}

/**
 * Strip query strings off a request URL before logging — query parameters
 * occasionally leak tokens (?access_token=…) from misbehaving clients.
 */
export function redactUrl(url: string): string {
  const q = url.indexOf('?');
  return q === -1 ? url : url.slice(0, q);
}
