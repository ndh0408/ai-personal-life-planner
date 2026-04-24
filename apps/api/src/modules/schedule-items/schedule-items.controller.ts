import {
  Body,
  Controller,
  Delete,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import {
  CreateScheduleItemSchema,
  UpdateScheduleItemSchema,
  PatchScheduleItemStatusSchema,
  ReorderScheduleItemsSchema,
  type CreateScheduleItemInput,
  type UpdateScheduleItemInput,
  type PatchScheduleItemStatusInput,
  type ReorderScheduleItemsInput,
} from '@planner/shared';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser, type AuthUser } from '../../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { ok } from '../../common/interceptors/response.interceptor';
import { ScheduleItemsService } from './schedule-items.service';

@Controller('schedules/:scheduleId/items')
@UseGuards(JwtAuthGuard)
export class NestedScheduleItemsController {
  constructor(private readonly items: ScheduleItemsService) {}

  @Post()
  async create(
    @CurrentUser() user: AuthUser,
    @Param('scheduleId', new ParseUUIDPipe()) scheduleId: string,
    @Body(new ZodValidationPipe(CreateScheduleItemSchema)) body: CreateScheduleItemInput,
  ) {
    const item = await this.items.create(user.id, scheduleId, body);
    return ok(item, 'Schedule item created');
  }
}

@Controller('schedule-items')
@UseGuards(JwtAuthGuard)
export class ScheduleItemsController {
  constructor(private readonly items: ScheduleItemsService) {}

  // NOTE: declared BEFORE :id routes so "reorder" isn't matched as an id param.
  @Patch('reorder')
  async reorder(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(ReorderScheduleItemsSchema)) body: ReorderScheduleItemsInput,
  ) {
    const items = await this.items.reorder(user.id, body);
    return ok(items, 'Schedule items reordered');
  }

  @Put(':id')
  async update(
    @CurrentUser() user: AuthUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(UpdateScheduleItemSchema)) body: UpdateScheduleItemInput,
  ) {
    const item = await this.items.update(user.id, id, body);
    return ok(item, 'Schedule item updated');
  }

  @Patch(':id/status')
  async patchStatus(
    @CurrentUser() user: AuthUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(PatchScheduleItemStatusSchema)) body: PatchScheduleItemStatusInput,
  ) {
    const item = await this.items.patchStatus(user.id, id, body);
    return ok(item, 'Schedule item status updated');
  }

  @Delete(':id')
  async delete(@CurrentUser() user: AuthUser, @Param('id', new ParseUUIDPipe()) id: string) {
    await this.items.delete(user.id, id);
    return ok(null, 'Schedule item deleted');
  }
}
