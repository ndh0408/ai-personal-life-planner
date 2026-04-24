import { BadRequestException, Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser, type AuthUser } from '../../common/decorators/current-user.decorator';
import { ReportsService } from './reports.service';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function assertDate(value: string | undefined, field: string): string {
  if (!value || !DATE_RE.test(value)) {
    throw new BadRequestException({
      message: `Query param "${field}" must be YYYY-MM-DD`,
      errorCode: 'VALIDATION_FAILED',
    });
  }
  return value;
}

@Controller('reports')
@UseGuards(JwtAuthGuard)
export class ReportsController {
  constructor(private readonly svc: ReportsService) {}

  @Get('daily')
  daily(@CurrentUser() user: AuthUser, @Query('date') date?: string) {
    const safe = assertDate(date, 'date');
    return this.svc.daily(user.id, safe);
  }

  @Get('weekly')
  weekly(
    @CurrentUser() user: AuthUser,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.svc.weekly(user.id, assertDate(from, 'from'), assertDate(to, 'to'));
  }
}
