import { Injectable, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
import { pickFromAcceptLanguage } from './locale.constants';

/**
 * Populates `req.locale` from the `Accept-Language` header with fallback "vi".
 * For authenticated endpoints, a later step may override it with the locale stored
 * on the user's profile — see {@link LocaleService.forUser}.
 */
@Injectable()
export class LocaleMiddleware implements NestMiddleware {
  use(req: Request, _res: Response, next: NextFunction): void {
    const header = req.headers['accept-language'];
    (req as Request & { locale?: string }).locale = pickFromAcceptLanguage(
      typeof header === 'string' ? header : undefined,
    );
    next();
  }
}
