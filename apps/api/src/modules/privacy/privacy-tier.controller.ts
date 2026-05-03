import { Body, Controller, Get, Patch } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { SetPrivacyTierRequestSchema } from '@lifeos/shared';
import { CurrentUser, type AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { PrivacyTierService } from './privacy-tier.service';

@ApiTags('privacy')
@ApiBearerAuth()
@Controller('privacy/tier')
export class PrivacyTierController {
  constructor(private readonly service: PrivacyTierService) {}

  @Get()
  get(@CurrentUser() user: AuthenticatedUser) {
    return this.service.get(user.id);
  }

  @Patch()
  set(@CurrentUser() user: AuthenticatedUser, @Body() body: unknown) {
    const parsed = SetPrivacyTierRequestSchema.parse(body);
    return this.service.set(user.id, parsed);
  }

  @Patch('on-device-llm')
  async setOnDeviceReady(@CurrentUser() user: AuthenticatedUser, @Body() body: unknown) {
    const parsed = z.object({ ready: z.boolean() }).parse(body);
    await this.service.markOnDeviceLlmReady(user.id, parsed.ready);
    return { ok: true };
  }
}
