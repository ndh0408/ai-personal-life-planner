import { BadRequestException, Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import {
  CurrentUser,
  type AuthenticatedUser,
} from '../../common/decorators/current-user.decorator';
import { MealsService } from './meals.service';
import type { RangeName } from '../../common/datetime/range';

const ALLOWED: RangeName[] = ['today', 'yesterday', 'week', 'month'];

const CreateMealSchema = z.object({
  title: z.string().min(1).max(200),
  mealType: z.enum(['BREAKFAST', 'LUNCH', 'DINNER', 'SNACK']),
  cost: z.number().min(0).max(1e12).nullable().optional(),
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

function parseCreate(body: unknown) {
  const r = CreateMealSchema.safeParse(body);
  if (!r.success) {
    throw new BadRequestException({
      error: {
        code: 'VALIDATION_FAILED',
        message: 'Dữ liệu bữa ăn không hợp lệ.',
        issues: r.error.issues,
      },
    });
  }
  return r.data;
}

@ApiBearerAuth()
@ApiTags('meals')
@Controller('meals')
export class MealsController {
  constructor(private readonly svc: MealsService) {}

  @Get()
  list(@CurrentUser() user: AuthenticatedUser, @Query('range') range?: string) {
    return this.svc.list(user.id, parseRange(range));
  }
}

/**
 * Spec-aligned alias at /api/meal-logs (the round-15 surface). Old /api/meals
 * stays alive for backward compatibility with already-shipped clients.
 */
@ApiBearerAuth()
@ApiTags('meals')
@Controller('meal-logs')
export class MealLogsController {
  constructor(private readonly svc: MealsService) {}

  @Get()
  list(@CurrentUser() user: AuthenticatedUser, @Query('range') range?: string) {
    return this.svc.list(user.id, parseRange(range));
  }

  @Post()
  create(@CurrentUser() user: AuthenticatedUser, @Body() body: unknown) {
    return this.svc.create(user.id, parseCreate(body));
  }
}
