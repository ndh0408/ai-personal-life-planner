import { BadRequestException, Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser, type AuthUser } from '../../common/decorators/current-user.decorator';
import { ok } from '../../common/interceptors/response.interceptor';
import { ReportsService } from './reports.service';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MONTH_RE = /^\d{4}-\d{2}$/;

function assertDate(value: string | undefined, field: string): string {
  if (!value || !DATE_RE.test(value)) {
    throw new BadRequestException({
      message: `Query param "${field}" must be YYYY-MM-DD`,
      errorCode: 'VALIDATION_FAILED',
    });
  }
  return value;
}

function assertMonth(value: string | undefined, field: string): string {
  if (!value || !MONTH_RE.test(value)) {
    throw new BadRequestException({
      message: `Query param "${field}" must be YYYY-MM`,
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
  async daily(@CurrentUser() user: AuthUser, @Query('date') date?: string) {
    return ok(await this.svc.daily(user.id, assertDate(date, 'date')), 'Daily report ready');
  }

  @Get('weekly')
  async weekly(
    @CurrentUser() user: AuthUser,
    @Query('weekStart') weekStart?: string,
    // Legacy support: callers still passing `from` get mapped to weekStart.
    @Query('from') legacyFrom?: string,
  ) {
    const start = weekStart ?? legacyFrom;
    return ok(
      await this.svc.weekly(user.id, assertDate(start, 'weekStart')),
      'Weekly report ready',
    );
  }

  @Get('monthly-finance')
  async monthlyFinance(
    @CurrentUser() user: AuthUser,
    @Query('month') month?: string,
  ) {
    return ok(
      await this.svc.monthlyFinance(user.id, assertMonth(month, 'month')),
      'Monthly finance report ready',
    );
  }

  @Get('goal-progress')
  async goalProgress(@CurrentUser() user: AuthUser) {
    return ok(await this.svc.goalProgress(user.id), 'Goal progress report ready');
  }
}
