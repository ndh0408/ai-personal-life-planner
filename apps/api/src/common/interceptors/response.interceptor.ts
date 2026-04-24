import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

/** Marker an envelope-aware controller/service may return to set a custom message. */
export const ENVELOPE = Symbol.for('planner.envelope');

export type EnvelopeBox<T> = {
  [ENVELOPE]: true;
  data: T;
  message: string;
};

export function ok<T>(data: T, message = 'OK'): EnvelopeBox<T> {
  return { [ENVELOPE]: true, data, message };
}

/**
 * Canonical success envelope. The shape mirrors the error envelope produced by
 * {@link AllExceptionsFilter} — both always contain the same four keys
 * (`success`, `data`, `message`, `errorCode`) — so mobile clients can parse
 * every response with a single type.
 */
export type ApiResponse<T = unknown> = {
  success: true;
  data: T;
  message: string;
  errorCode: null;
};

@Injectable()
export class ResponseInterceptor<T> implements NestInterceptor<T, ApiResponse<T>> {
  intercept(_ctx: ExecutionContext, next: CallHandler<T>): Observable<ApiResponse<T>> {
    return next.handle().pipe(
      map((value) => {
        if (value && typeof value === 'object' && (value as { [ENVELOPE]?: true })[ENVELOPE]) {
          const box = value as unknown as EnvelopeBox<T>;
          return { success: true, data: box.data, message: box.message, errorCode: null };
        }
        return {
          success: true,
          data: (value ?? null) as T,
          message: 'OK',
          errorCode: null,
        };
      }),
    );
  }
}
