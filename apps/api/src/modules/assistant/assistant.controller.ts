import { Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser, type AuthUser } from '../../common/decorators/current-user.decorator';
import { AssistantService } from './assistant.service';

@Controller('assistant')
@UseGuards(JwtAuthGuard)
export class AssistantController {
  constructor(private readonly svc: AssistantService) {}

  @Get('insights')
  insights(@CurrentUser() user: AuthUser, @Query('limit') limit?: string) {
    return this.svc.insights(user.id, limit ? Number(limit) : 20);
  }

  @Post('insights/:id/dismiss')
  dismiss(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.svc.dismiss(user.id, id);
  }
}
