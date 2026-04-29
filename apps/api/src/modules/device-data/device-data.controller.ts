import { Body, Controller, Get, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { DeviceDataSyncRequestSchema, type DeviceDataSyncRequest } from '@lifeos/shared';
import {
  CurrentUser,
  type AuthenticatedUser,
} from '../../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { DeviceDataService } from './device-data.service';
import { SleepInferenceService } from './sleep-inference.service';

@ApiBearerAuth()
@ApiTags('device-data')
@Controller('device-data')
export class DeviceDataController {
  constructor(
    private readonly deviceData: DeviceDataService,
    private readonly inference: SleepInferenceService,
  ) {}

  /**
   * Mobile pushes batches here. Throttled to 12 syncs/min (the phone
   * itself only schedules one per app foreground + one per BG fetch).
   */
  @Throttle({ default: { ttl: 60_000, limit: 12 } })
  @Post('sync')
  @HttpCode(HttpStatus.OK)
  async sync(@CurrentUser() user: AuthenticatedUser, @Body() body: unknown) {
    const parsed = new ZodValidationPipe(DeviceDataSyncRequestSchema).transform(
      body,
    ) as DeviceDataSyncRequest;
    return this.deviceData.sync(user.id, parsed);
  }

  /** Used by Settings / DevPanel to show recent samples + their source. */
  @Throttle({ default: { ttl: 60_000, limit: 30 } })
  @Get('recent')
  recent(@CurrentUser() user: AuthenticatedUser) {
    return this.deviceData.getRecent(user.id);
  }

  /**
   * Manual inference trigger — useful from DevPanel and from the daily
   * cron (R36). Restricted to the calling user's own data.
   */
  @Throttle({ default: { ttl: 60_000, limit: 6 } })
  @Post('infer-sleep')
  @HttpCode(HttpStatus.OK)
  async infer(@CurrentUser() user: AuthenticatedUser) {
    const id = await this.inference.inferForUser(user.id);
    return { sleepLogId: id, inferred: !!id };
  }
}
