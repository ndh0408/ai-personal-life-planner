import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';

/**
 * Lightweight request-id middleware. If the client (mobile / nginx / lb) sent
 * an `x-request-id` header, we trust it; otherwise generate a uuid. The id
 * is echoed back on the response so the mobile client can log/report it
 * during error reports, and read by `AllExceptionsFilter` to tag the 5xx
 * server-side log line.
 *
 * Lives at the express level so it runs before any Nest interceptor.
 */
export function requestIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  const incoming = (req.headers['x-request-id'] as string | undefined)?.trim();
  // Cap incoming ids at 64 chars to neutralise log-injection / forged
  // long-string headers — generated uuids are 36 chars.
  const id = incoming && incoming.length > 0 && incoming.length <= 64 ? incoming : randomUUID();
  (req as Request & { requestId?: string }).requestId = id;
  res.setHeader('x-request-id', id);
  next();
}
