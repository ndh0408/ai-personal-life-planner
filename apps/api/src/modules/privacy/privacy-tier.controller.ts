import { Body, Controller, Get, Patch, Req } from '@nestjs/common';
import type { Request } from 'express';
import { z } from 'zod';
import { PrivacyTierService } from './privacy-tier.service';
import { SetPrivacyTierRequestSchema } from '@lifeos/shared';

interface AuthedRequest extends Request {
  user?: { sub: string };
}

@Controller('privacy/tier')
export class PrivacyTierController {
  constructor(private readonly service: PrivacyTierService) {}

  @Get()
  async get(@Req() req: AuthedRequest) {
    const userId = req.user!.sub;
    return this.service.get(userId);
  }

  @Patch()
  async set(@Req() req: AuthedRequest, @Body() body: unknown) {
    const userId = req.user!.sub;
    const parsed = SetPrivacyTierRequestSchema.parse(body);
    return this.service.set(userId, parsed);
  }

  @Patch('on-device-llm')
  async setOnDeviceReady(@Req() req: AuthedRequest, @Body() body: unknown) {
    const userId = req.user!.sub;
    const parsed = z.object({ ready: z.boolean() }).parse(body);
    await this.service.markOnDeviceLlmReady(userId, parsed.ready);
    return { ok: true };
  }
}
