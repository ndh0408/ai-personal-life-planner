import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  CreateScheduleSchema,
  UpdateScheduleSchema,
  GetScheduleQuerySchema,
  type CreateScheduleInput,
  type UpdateScheduleInput,
  type GetScheduleQuery,
} from '@planner/shared';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser, type AuthUser } from '../../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { ok } from '../../common/interceptors/response.interceptor';
import { SchedulesService } from './schedules.service';

@Controller('schedules')
@UseGuards(JwtAuthGuard)
export class SchedulesController {
  constructor(private readonly schedules: SchedulesService) {}

  @Get()
  async getByDate(
    @CurrentUser() user: AuthUser,
    @Query(new ZodValidationPipe(GetScheduleQuerySchema)) query: GetScheduleQuery,
  ) {
    const schedule = await this.schedules.getByDate(user.id, query.date);
    return ok(schedule, schedule ? 'Schedule retrieved' : 'No schedule for this date');
  }

  @Post()
  async create(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(CreateScheduleSchema)) body: CreateScheduleInput,
  ) {
    const schedule = await this.schedules.create(user.id, body);
    return ok(schedule, 'Schedule created');
  }

  @Put(':id')
  async update(
    @CurrentUser() user: AuthUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(UpdateScheduleSchema)) body: UpdateScheduleInput,
  ) {
    const schedule = await this.schedules.update(user.id, id, body);
    return ok(schedule, 'Schedule updated');
  }

  @Delete(':id')
  async delete(@CurrentUser() user: AuthUser, @Param('id', new ParseUUIDPipe()) id: string) {
    await this.schedules.delete(user.id, id);
    return ok(null, 'Schedule deleted');
  }
}
