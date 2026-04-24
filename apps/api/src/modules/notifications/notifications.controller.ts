import {
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { z } from 'zod';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser, type AuthUser } from '../../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { NotificationsService } from './notifications.service';

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

const UpdateSettingsSchema = z
  .object({
    wakeReminder: z.boolean().optional(),
    sleepReminder: z.boolean().optional(),
    mealReminder: z.boolean().optional(),
    taskReminder: z.boolean().optional(),
    habitReminder: z.boolean().optional(),
    moodCheckinReminder: z.boolean().optional(),
    quietHoursStart: z.string().regex(HHMM).nullable().optional(),
    quietHoursEnd: z.string().regex(HHMM).nullable().optional(),
  })
  .strict();

const RegisterDeviceSchema = z
  .object({
    platform: z.enum(['IOS', 'ANDROID', 'WEB']),
    pushToken: z.string().min(10).max(512),
    deviceName: z.string().max(120).optional(),
  })
  .strict();

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly svc: NotificationsService) {}

  @Get('settings')
  getSettings(@CurrentUser() user: AuthUser) {
    return this.svc.getSettings(user.id);
  }

  @Put('settings')
  updateSettings(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(UpdateSettingsSchema)) body: z.infer<typeof UpdateSettingsSchema>,
  ) {
    return this.svc.updateSettings(user.id, body);
  }

  @Post('devices')
  registerDevice(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(RegisterDeviceSchema)) body: z.infer<typeof RegisterDeviceSchema>,
  ) {
    return this.svc.registerDevice(user.id, body);
  }

  @Get('devices')
  listDevices(@CurrentUser() user: AuthUser) {
    return this.svc.listDevices(user.id);
  }

  @Delete('devices/:id')
  async removeDevice(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    try {
      await this.svc.removeDevice(user.id, id);
      return { success: true };
    } catch (err) {
      const e = err as { status?: number; message?: string };
      if (e.status === 404) throw new NotFoundException(e.message ?? 'Device not found');
      throw err;
    }
  }

  @Get('logs')
  listLogs(
    @CurrentUser() user: AuthUser,
    @Query('limit') limit?: string,
  ) {
    return this.svc.listLogs(user.id, limit ? Number(limit) : 20);
  }
}
