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
  UpdateRecommendationStatusRequestSchema,
  type UpdateRecommendationStatusRequest,
} from '@lifeos/shared';
import {
  CurrentUser,
  type AuthenticatedUser,
} from '../../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { RecommendationsService } from './recommendations.service';

@ApiBearerAuth()
@ApiTags('recommendations')
@Controller('recommendations')
export class RecommendationsController {
  constructor(private readonly svc: RecommendationsService) {}

  @Get()
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.svc.list(user.id);
  }

  @Throttle({ default: { ttl: 60_000, limit: 6 } })
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  refresh(@CurrentUser() user: AuthenticatedUser) {
    return this.svc.refresh(user.id);
  }

  @Patch(':id/status')
  @HttpCode(HttpStatus.OK)
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UpdateRecommendationStatusRequestSchema))
    body: UpdateRecommendationStatusRequest,
  ) {
    return this.svc.updateStatus(user.id, id, body.status);
  }
}
