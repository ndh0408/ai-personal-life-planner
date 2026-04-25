import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import type { Request, Response } from 'express';
import { MetricsRegistry } from './metrics.registry';

/**
 * Records request count + latency on every HTTP call. Routes are reduced to
 * a low-cardinality bucket using the matched Express path (`req.route?.path`)
 * so /api/expenses/:id doesn't explode into one label per uuid.
 */
@Injectable()
export class MetricsInterceptor implements NestInterceptor {
  constructor(private readonly metrics: MetricsRegistry) {}

  intercept(ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (ctx.getType() !== 'http') return next.handle();
    const http = ctx.switchToHttp();
    const req = http.getRequest<Request & { route?: { path?: string } }>();
    const res = http.getResponse<Response>();
    const started = process.hrtime.bigint();

    const finish = (status: number) => {
      const elapsedSec = Number(process.hrtime.bigint() - started) / 1e9;
      const route = req.route?.path ?? req.path ?? 'unknown';
      const labels = {
        method: req.method,
        route,
        status_class: `${Math.floor(status / 100)}xx`,
      };
      this.metrics.httpRequests.inc(labels);
      this.metrics.httpLatency.observe(labels, elapsedSec);
    };

    return next.handle().pipe(
      tap({
        next: () => finish(res.statusCode || 200),
        error: () => finish(res.statusCode && res.statusCode >= 400 ? res.statusCode : 500),
      }),
    );
  }
}
