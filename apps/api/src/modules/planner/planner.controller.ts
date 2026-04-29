import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Put,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import {
  UpdatePlanItemStatusRequestSchema,
  type UpdatePlanItemStatusRequest,
} from '@lifeos/shared';

const UpdatePlanItemSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  startAtIso: z.string().datetime().nullable().optional(),
  endAtIso: z.string().datetime().nullable().optional(),
});
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

  @Put('items/:id')
  @HttpCode(HttpStatus.OK)
  updateItem(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    const r = UpdatePlanItemSchema.safeParse(body);
    if (!r.success) {
      throw new BadRequestException({
        error: { code: 'VALIDATION_FAILED', message: 'Dữ liệu không hợp lệ.', issues: r.error.issues },
      });
    }
    return this.svc.updateItem(user.id, id, r.data);
  }
}
