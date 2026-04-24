import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  DEFAULT_LOCALE,
  normalizeLocale,
  pickFromAcceptLanguage,
  type SupportedLocale,
} from './locale.constants';

type RequestLike = {
  headers?: Record<string, string | string[] | undefined>;
  locale?: string;
};

@Injectable()
export class LocaleService {
  constructor(private readonly prisma: PrismaService) {}

  /** Resolve locale for an anonymous request — header only, fallback "vi". */
  fromRequest(req: RequestLike): SupportedLocale {
    if (req.locale) return normalizeLocale(req.locale);
    const header = req.headers?.['accept-language'];
    return pickFromAcceptLanguage(Array.isArray(header) ? header[0] : header);
  }

  /**
   * Resolve locale for an authenticated request:
   *   1. UserProfile.locale (if profile exists)
   *   2. req.locale (Accept-Language)
   *   3. "vi"
   */
  async forUser(userId: string, req: RequestLike): Promise<SupportedLocale> {
    const profile = await this.prisma.userProfile.findUnique({
      where: { userId },
      select: { locale: true },
    });
    if (profile?.locale) return normalizeLocale(profile.locale);
    return this.fromRequest(req);
  }

  get default(): SupportedLocale {
    return DEFAULT_LOCALE;
  }
}
