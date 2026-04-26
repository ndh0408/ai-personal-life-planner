import { BadRequestException, Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  CurrentUser,
  type AuthenticatedUser,
} from '../../common/decorators/current-user.decorator';
import { MealsService } from './meals.service';
import type { RangeName } from '../../common/datetime/range';

const ALLOWED: RangeName[] = ['today', 'yesterday', 'week', 'month'];

@ApiBearerAuth()
@ApiTags('meals')
@Controller('meals')
export class MealsController {
  constructor(private readonly svc: MealsService) {}

  @Get()
  list(@CurrentUser() user: AuthenticatedUser, @Query('range') range?: string) {
    if (range && !(ALLOWED as string[]).includes(range)) {
      throw new BadRequestException({
        error: { code: 'BAD_RANGE', message: `range must be one of ${ALLOWED.join(', ')}` },
      });
    }
    return this.svc.list(user.id, (range as RangeName) ?? null);
  }
}
