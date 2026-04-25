import {
  Controller,
  ForbiddenException,
  Get,
  Headers,
  NotFoundException,
  Res,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Response } from 'express';
import { MetricsRegistry } from './metrics.registry';

/**
 * Prometheus scrape endpoint. Disabled by default (returns 404 when
 * METRICS_ENABLED=false) so it never accidentally exposes metrics in a
 * misconfigured pilot. When enabled and METRICS_BEARER_TOKEN is set, requires
 * `Authorization: Bearer <token>`.
 */
@Controller()
export class MetricsController {
  constructor(
    private readonly metrics: MetricsRegistry,
    private readonly config: ConfigService,
  ) {}

  @Get('metrics')
  async scrape(@Res() res: Response, @Headers('authorization') auth?: string): Promise<void> {
    const enabled = this.config.get<boolean>('METRICS_ENABLED');
    if (!enabled) throw new NotFoundException();
    const expected = this.config.get<string>('METRICS_BEARER_TOKEN');
    if (expected) {
      const provided = auth?.replace(/^Bearer\s+/i, '').trim();
      if (provided !== expected) throw new ForbiddenException();
    }
    res.setHeader('Content-Type', this.metrics.registry.contentType);
    res.send(await this.metrics.registry.metrics());
  }
}
