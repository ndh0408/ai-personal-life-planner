import { Injectable, ExecutionContext, HttpException, HttpStatus } from '@nestjs/common';
import { ThrottlerGuard, ThrottlerException, ThrottlerLimitDetail } from '@nestjs/throttler';
import type { Request, Response } from 'express';

/**
 * Throttler guard that:
 *  1. Tracks per-user when JWT is present, falling back to per-IP for
 *     unauthenticated routes (auth/* endpoints stay per-IP).
 *  2. Translates ThrottlerException into our shared error envelope with
 *     `errorCode: RATE_LIMITED` (or `AI_RATE_LIMITED` if the route path
 *     starts with `/api/ai`) so the mobile client can branch on the code.
 *  3. Sets standard Retry-After + X-RateLimit-* headers when the request
 *     gets blocked.
 */
@Injectable()
export class UserAwareThrottlerGuard extends ThrottlerGuard {
  protected async getTracker(req: Record<string, unknown>): Promise<string> {
    const user = (req as { user?: { id?: string } }).user;
    if (user?.id) return `u:${user.id}`;
    const ip =
      (req as { ip?: string }).ip ??
      ((req as { ips?: string[] }).ips?.[0]) ??
      ((req as { connection?: { remoteAddress?: string } }).connection?.remoteAddress) ??
      'unknown';
    return `ip:${ip}`;
  }

  protected async throwThrottlingException(
    context: ExecutionContext,
    throttlerLimitDetail: ThrottlerLimitDetail,
  ): Promise<void> {
    const http = context.switchToHttp();
    const req = http.getRequest<Request>();
    const res = http.getResponse<Response>();

    const retryAfterSec = Math.max(1, Math.ceil(throttlerLimitDetail.timeToBlockExpire / 1000) || 1);
    const isAi = req.url?.startsWith('/api/ai');
    const errorCode = isAi ? 'AI_RATE_LIMITED' : 'RATE_LIMITED';

    res.setHeader('Retry-After', String(retryAfterSec));
    res.setHeader('X-RateLimit-Limit', String(throttlerLimitDetail.limit));
    res.setHeader('X-RateLimit-Remaining', '0');

    throw new HttpException(
      { message: 'Too many requests', errorCode },
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }
}

// Re-export to silence unused-import noise if a future refactor wants the
// upstream class directly.
export { ThrottlerException };
