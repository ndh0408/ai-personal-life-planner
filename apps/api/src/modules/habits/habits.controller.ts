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
  CreateHabitSchema,
  UpdateHabitSchema,
  LogHabitSchema,
  HabitLogsQuerySchema,
  type CreateHabitInput,
  type UpdateHabitInput,
  type LogHabitInput,
  type HabitLogsQuery,
} from '@planner/shared';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser, type AuthUser } from '../../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { ok } from '../../common/interceptors/response.interceptor';
import { HabitsService } from './habits.service';

@Controller('habits')
@UseGuards(JwtAuthGuard)
export class HabitsController {
  constructor(private readonly habits: HabitsService) {}

  @Get()
  async list(@CurrentUser() user: AuthUser) {
    const items = await this.habits.list(user.id);
    return ok(items, 'Habits retrieved');
  }

  @Get('logs')
  async listLogs(
    @CurrentUser() user: AuthUser,
    @Query(new ZodValidationPipe(HabitLogsQuerySchema)) query: HabitLogsQuery,
  ) {
    const items = await this.habits.listLogs(user.id, query);
    return ok(items, 'Habit logs retrieved');
  }

  @Post()
  async create(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(CreateHabitSchema)) body: CreateHabitInput,
  ) {
    const habit = await this.habits.create(user.id, body);
    return ok(habit, 'Habit created');
  }

  @Put(':id')
  async update(
    @CurrentUser() user: AuthUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(UpdateHabitSchema)) body: UpdateHabitInput,
  ) {
    const habit = await this.habits.update(user.id, id, body);
    return ok(habit, 'Habit updated');
  }

  @Delete(':id')
  async delete(@CurrentUser() user: AuthUser, @Param('id', new ParseUUIDPipe()) id: string) {
    await this.habits.delete(user.id, id);
    return ok(null, 'Habit deleted');
  }

  @Post(':id/log')
  async log(
    @CurrentUser() user: AuthUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(LogHabitSchema)) body: LogHabitInput,
  ) {
    const log = await this.habits.log(user.id, id, body);
    return ok(log, 'Habit logged');
  }
}
