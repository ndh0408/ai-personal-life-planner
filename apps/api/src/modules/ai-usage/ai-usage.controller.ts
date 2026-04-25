import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser, type AuthUser } from '../../common/decorators/current-user.decorator';
import { AiUsageService } from './ai-usage.service';

@Controller('ai/usage')
@UseGuards(JwtAuthGuard)
export class AiUsageController {
  constructor(private readonly svc: AiUsageService) {}

  @Get('today')
  today(@CurrentUser() user: AuthUser) {
    return this.svc.getToday(user.id);
  }

  @Get('history')
  history(
    @CurrentUser() user: AuthUser,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.svc.getHistory(user.id, from, to);
  }
}
