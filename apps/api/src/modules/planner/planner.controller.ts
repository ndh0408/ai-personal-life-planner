import { BadRequestException, Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser, type AuthUser } from '../../common/decorators/current-user.decorator';
import { PlannerService } from './planner.service';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

@Controller('planner')
@UseGuards(JwtAuthGuard)
export class PlannerController {
  constructor(private readonly svc: PlannerService) {}

  @Get('today')
  today(@CurrentUser() user: AuthUser, @Query('date') date?: string) {
    const d = date ?? new Date().toISOString().slice(0, 10);
    if (!DATE_RE.test(d)) {
      throw new BadRequestException({
        message: 'Query param "date" must be YYYY-MM-DD',
        errorCode: 'VALIDATION_FAILED',
      });
    }
    return this.svc.today(user.id, d);
  }
}
