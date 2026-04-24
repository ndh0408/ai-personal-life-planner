import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { DEFAULT_LOCALE, normalizeLocale, type SupportedLocale } from './locale.constants';

/**
 * Resolves the active locale for the request.
 *
 * Order of precedence:
 *   1. `req.locale` set by {@link LocaleMiddleware} (Accept-Language header)
 *   2. Fallback: "vi"
 *
 * Services that need to read a signed-in user's stored locale (from UserProfile)
 * should call {@link LocaleService.forUser} instead — a decorator cannot run async.
 */
export const Locale = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): SupportedLocale => {
    const req = ctx.switchToHttp().getRequest<{ locale?: string }>();
    return normalizeLocale(req.locale ?? DEFAULT_LOCALE);
  },
);
