import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { err } from './response-envelope';

interface NestErrorBody {
  error?: { code?: string; message?: string };
  message?: string | string[];
  statusCode?: number;
}

const STATUS_TO_CODE: Record<number, string> = {
  400: 'BAD_REQUEST',
  401: 'UNAUTHENTICATED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  409: 'CONFLICT',
  422: 'UNPROCESSABLE',
  429: 'RATE_LIMITED',
  500: 'INTERNAL_ERROR',
  502: 'UPSTREAM_ERROR',
  503: 'UNAVAILABLE',
};

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('ExceptionFilter');

  constructor(private readonly isProduction: boolean) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const req = ctx.getRequest<Request & { id?: string }>();
    const res = ctx.getResponse<Response>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let errorCode = 'INTERNAL_ERROR';
    let message = 'Internal server error';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const body = exception.getResponse();
      if (typeof body === 'string') {
        message = body;
      } else if (body && typeof body === 'object') {
        const b = body as NestErrorBody;
        if (b.error?.code) errorCode = b.error.code;
        if (b.error?.message) {
          message = b.error.message;
        } else if (Array.isArray(b.message)) {
          message = b.message.join('; ');
        } else if (typeof b.message === 'string') {
          message = b.message;
        }
      }
      if (errorCode === 'INTERNAL_ERROR') {
        errorCode = STATUS_TO_CODE[status] ?? 'BAD_REQUEST';
      }
    } else {
      // Unknown error — log full detail server-side, send opaque message in prod.
      const detail =
        exception instanceof Error
          ? { name: exception.name, message: exception.message, stack: exception.stack }
          : { value: String(exception) };
      this.logger.error(
        `Unhandled exception on ${req.method} ${req.url} (rid=${req.id ?? 'none'})`,
        detail,
      );
      if (!this.isProduction && exception instanceof Error) {
        message = exception.message;
      }
    }

    if (this.isProduction && status >= 500) {
      // Production: don't leak internal messages on 5xx.
      message = 'Internal server error';
    }

    if (status >= 500) {
      this.logger.error(
        `${req.method} ${req.url} → ${status} ${errorCode} (rid=${req.id ?? 'none'}): ${message}`,
      );
    } else {
      this.logger.warn(
        `${req.method} ${req.url} → ${status} ${errorCode} (rid=${req.id ?? 'none'}): ${message}`,
      );
    }

    res.status(status).json(err(errorCode, message, req.id));
  }
}
