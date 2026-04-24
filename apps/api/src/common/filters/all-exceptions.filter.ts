import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { ThrottlerException } from '@nestjs/throttler';
import { Request, Response } from 'express';

/**
 * Map NestJS/Express exception → stable backend errorCode string.
 * The mobile app translates these to localized strings via i18n keys like
 * `errors.AUTH_INVALID_CREDENTIALS`. Never rely on `message` text for UX;
 * always branch on `errorCode`.
 */
function toErrorCode(status: number, message: string | undefined, exception: unknown): string {
  if (exception instanceof ThrottlerException) return 'RATE_LIMIT_EXCEEDED';

  const msg = (message ?? '').toLowerCase();
  switch (status) {
    case HttpStatus.BAD_REQUEST:
      if (msg.includes('validation')) return 'VALIDATION_FAILED';
      return 'BAD_REQUEST';
    case HttpStatus.UNAUTHORIZED:
      if (msg.includes('refresh')) return 'AUTH_INVALID_REFRESH_TOKEN';
      if (msg.includes('disabled')) return 'AUTH_ACCOUNT_DISABLED';
      if (msg.includes('credentials')) return 'AUTH_INVALID_CREDENTIALS';
      return 'AUTH_UNAUTHORIZED';
    case HttpStatus.FORBIDDEN:
      return 'FORBIDDEN';
    case HttpStatus.NOT_FOUND:
      return 'NOT_FOUND';
    case HttpStatus.CONFLICT:
      if (msg.includes('email')) return 'AUTH_EMAIL_TAKEN';
      return 'CONFLICT';
    case HttpStatus.UNPROCESSABLE_ENTITY:
      return 'UNPROCESSABLE';
    case HttpStatus.TOO_MANY_REQUESTS:
      return 'RATE_LIMIT_EXCEEDED';
    default:
      return status >= 500 ? 'INTERNAL_SERVER_ERROR' : 'UNKNOWN_ERROR';
  }
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);
  private readonly isProd = process.env.NODE_ENV === 'production';

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    let message = 'Internal server error';
    let issues: unknown;
    let explicitCode: string | undefined;

    if (exception instanceof HttpException) {
      const res = exception.getResponse();
      if (typeof res === 'string') {
        message = res;
      } else if (res && typeof res === 'object') {
        const r = res as Record<string, unknown>;
        message = (r.message as string) ?? exception.message;
        if (r.issues) issues = r.issues;
        if (typeof r.errorCode === 'string') explicitCode = r.errorCode;
      }
    } else if (exception instanceof Error) {
      message = exception.message;
    }

    const errorCode = explicitCode ?? toErrorCode(status, message, exception);

    if (status >= 500) {
      this.logger.error(
        `${request.method} ${request.url} → ${status} [${errorCode}]`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    // Never leak internal error messages in production for 5xx.
    const publicMessage =
      this.isProd && status >= 500 ? 'Internal server error' : message;

    response.status(status).json({
      success: false,
      data: null,
      message: publicMessage,
      errorCode,
      ...(issues ? { issues } : {}),
      statusCode: status,
      path: request.url,
      timestamp: new Date().toISOString(),
    });
  }
}
