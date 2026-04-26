import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  UpdatePlanItemStatusRequestSchema,
  type UpdatePlanItemStatusRequest,
} from '@lifeos/shared';
import {
  CurrentUser,
  type AuthenticatedUser,
} from '../../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { PlannerService } from './planner.service';

@ApiBearerAuth()
@ApiTags('planner')
@Controller('daily-plan')
export class PlannerController {
  constructor(private readonly svc: PlannerService) {}

  @Get('today')
  today(@CurrentUser() user: AuthenticatedUser) {
    return this.svc.getToday(user.id);
  }

  @Throttle({ default: { ttl: 60_000, limit: 6 } })
  @Post('today/generate')
  @HttpCode(HttpStatus.OK)
  generate(@CurrentUser() user: AuthenticatedUser) {
    return this.svc.generateToday(user.id);
  }

  @Patch('items/:id/status')
  @HttpCode(HttpStatus.OK)
  updateItemStatus(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UpdatePlanItemStatusRequestSchema))
    body: UpdatePlanItemStatusRequest,
  ) {
    return this.svc.updateItemStatus(user.id, id, body.status);
  }
}
