import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable, map } from 'rxjs';
import { ok, type Envelope, type SuccessEnvelope } from './response-envelope';

/**
 * Wraps every controller return value in the success envelope unless the
 * controller already returns one (allowing rare endpoints to override message
 * or shape, e.g. health, version).
 */
@Injectable()
export class ResponseEnvelopeInterceptor implements NestInterceptor {
  intercept(_ctx: ExecutionContext, next: CallHandler): Observable<Envelope<unknown>> {
    return next.handle().pipe(
      map((value) => {
        if (
          value !== null &&
          typeof value === 'object' &&
          'success' in (value as Record<string, unknown>) &&
          'errorCode' in (value as Record<string, unknown>)
        ) {
          return value as Envelope<unknown>;
        }
        return ok(value) as SuccessEnvelope<unknown>;
      }),
    );
  }
}
