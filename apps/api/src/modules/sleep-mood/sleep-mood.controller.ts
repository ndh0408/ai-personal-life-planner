import { BadRequestException, Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import {
  CurrentUser,
  type AuthenticatedUser,
} from '../../common/decorators/current-user.decorator';
import { SleepMoodService } from './sleep-mood.service';
import type { RangeName } from '../../common/datetime/range';

const ALLOWED: RangeName[] = ['today', 'yesterday', 'week', 'month'];

const CreateSleepSchema = z
  .object({
    sleepAtIso: z.string().datetime(),
    wakeAtIso: z.string().datetime(),
    quality: z.enum(['BAD', 'OK', 'GOOD']).nullable().optional(),
    note: z.string().max(2000).nullable().optional(),
  })
  .refine((d) => new Date(d.wakeAtIso).getTime() > new Date(d.sleepAtIso).getTime(), {
    message: 'wakeAt phải sau sleepAt',
    path: ['wakeAtIso'],
  });

const CreateMoodSchema = z.object({
  mood: z.enum(['GREAT', 'GOOD', 'OK', 'TIRED', 'STRESSED', 'SAD']),
  energy: z.enum(['LOW', 'MEDIUM', 'HIGH']),
  loggedAtIso: z.string().datetime(),
  note: z.string().max(2000).nullable().optional(),
});

function parseRange(range?: string): RangeName | null {
  if (!range) return null;
  if (!(ALLOWED as string[]).includes(range)) {
    throw new BadRequestException({
      error: { code: 'BAD_RANGE', message: `range must be one of ${ALLOWED.join(', ')}` },
    });
  }
  return range as RangeName;
}

function parseBody<T>(
  schema: { safeParse: (v: unknown) => { success: boolean; data?: T; error?: { issues: unknown[] } } },
  body: unknown,
): T {
  const r = schema.safeParse(body);
  if (!r.success) {
    throw new BadRequestException({
      error: {
        code: 'VALIDATION_FAILED',
        message: 'Dữ liệu không hợp lệ.',
        issues: r.error?.issues,
      },
    });
  }
  return r.data as T;
}

@ApiBearerAuth()
@ApiTags('sleep-mood')
@Controller()
export class SleepMoodController {
  constructor(private readonly svc: SleepMoodService) {}

  @Get('sleep/latest')
  sleep(@CurrentUser() user: AuthenticatedUser) {
    return this.svc.latestSleep(user.id);
  }

  @Get('mood/latest')
  mood(@CurrentUser() user: AuthenticatedUser) {
    return this.svc.latestMood(user.id);
  }

  @Get('sleep-logs')
  listSleep(@CurrentUser() user: AuthenticatedUser, @Query('range') range?: string) {
    return this.svc.listSleep(user.id, parseRange(range));
  }

  @Post('sleep-logs')
  createSleep(@CurrentUser() user: AuthenticatedUser, @Body() body: unknown) {
    return this.svc.createSleep(user.id, parseBody(CreateSleepSchema, body));
  }

  @Get('mood-logs')
  listMood(@CurrentUser() user: AuthenticatedUser, @Query('range') range?: string) {
    return this.svc.listMood(user.id, parseRange(range));
  }

  @Post('mood-logs')
  createMood(@CurrentUser() user: AuthenticatedUser, @Body() body: unknown) {
    return this.svc.createMood(user.id, parseBody(CreateMoodSchema, body));
  }
}
