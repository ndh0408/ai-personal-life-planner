import { BadRequestException, Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser, type AuthUser } from '../../common/decorators/current-user.decorator';
import { DashboardService } from './dashboard.service';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

@Controller('dashboard')
@UseGuards(JwtAuthGuard)
export class DashboardController {
  constructor(private readonly svc: DashboardService) {}

  /**
   * GET /api/dashboard/summary?date=YYYY-MM-DD
   *
   * One-shot home-screen payload. Defaults to today when `date` is omitted.
   * Read-only; never creates recommendations or notifications.
   */
  @Get('summary')
  summary(
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
    @Query('date') date?: string,
  ) {
    const d = date ?? new Date().toISOString().slice(0, 10);
    if (!DATE_RE.test(d)) {
      throw new BadRequestException({
        message: 'Query param "date" must be YYYY-MM-DD',
        errorCode: 'VALIDATION_FAILED',
      });
    }
    return this.svc.summary(user.id, d, req);
  }
}
