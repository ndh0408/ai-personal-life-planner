import { BadRequestException, Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  CurrentUser,
  type AuthenticatedUser,
} from '../../common/decorators/current-user.decorator';
import { FinanceService } from './finance.service';
import type { RangeName } from '../../common/datetime/range';

const ALLOWED: RangeName[] = ['today', 'yesterday', 'week', 'month'];

function parseRange(raw: string | undefined): RangeName | null {
  if (!raw) return null;
  if ((ALLOWED as string[]).includes(raw)) return raw as RangeName;
  throw new BadRequestException({
    error: { code: 'BAD_RANGE', message: `range must be one of ${ALLOWED.join(', ')}` },
  });
}

@ApiBearerAuth()
@ApiTags('finance')
@Controller('expenses')
export class ExpensesController {
  constructor(private readonly svc: FinanceService) {}

  @Get()
  list(@CurrentUser() user: AuthenticatedUser, @Query('range') range?: string) {
    return this.svc.list(user.id, parseRange(range));
  }

  @Get('summary')
  summary(@CurrentUser() user: AuthenticatedUser) {
    return this.svc.summary(user.id);
  }
}
