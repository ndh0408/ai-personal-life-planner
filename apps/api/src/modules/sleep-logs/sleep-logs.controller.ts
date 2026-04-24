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
  CreateSleepLogSchema,
  UpdateSleepLogSchema,
  SleepLogsRangeQuerySchema,
  type CreateSleepLogInput,
  type UpdateSleepLogInput,
  type SleepLogsRangeQuery,
} from '@planner/shared';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser, type AuthUser } from '../../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { ok } from '../../common/interceptors/response.interceptor';
import { SleepLogsService } from './sleep-logs.service';

@Controller('sleep-logs')
@UseGuards(JwtAuthGuard)
export class SleepLogsController {
  constructor(private readonly sleep: SleepLogsService) {}

  @Get()
  async list(
    @CurrentUser() user: AuthUser,
    @Query(new ZodValidationPipe(SleepLogsRangeQuerySchema)) query: SleepLogsRangeQuery,
  ) {
    const items = await this.sleep.list(user.id, query);
    return ok(items, 'Sleep logs retrieved');
  }

  @Post()
  async create(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(CreateSleepLogSchema)) body: CreateSleepLogInput,
  ) {
    const log = await this.sleep.create(user.id, body);
    return ok(log, 'Sleep log saved');
  }

  @Put(':id')
  async update(
    @CurrentUser() user: AuthUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(UpdateSleepLogSchema)) body: UpdateSleepLogInput,
  ) {
    const log = await this.sleep.update(user.id, id, body);
    return ok(log, 'Sleep log updated');
  }

  @Delete(':id')
  async delete(@CurrentUser() user: AuthUser, @Param('id', new ParseUUIDPipe()) id: string) {
    await this.sleep.delete(user.id, id);
    return ok(null, 'Sleep log deleted');
  }
}
