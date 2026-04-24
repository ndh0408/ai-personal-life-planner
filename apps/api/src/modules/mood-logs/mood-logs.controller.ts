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
  CreateMoodLogSchema,
  UpdateMoodLogSchema,
  MoodLogsRangeQuerySchema,
  type CreateMoodLogInput,
  type UpdateMoodLogInput,
  type MoodLogsRangeQuery,
} from '@planner/shared';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser, type AuthUser } from '../../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { ok } from '../../common/interceptors/response.interceptor';
import { MoodLogsService } from './mood-logs.service';

@Controller('mood-logs')
@UseGuards(JwtAuthGuard)
export class MoodLogsController {
  constructor(private readonly mood: MoodLogsService) {}

  @Get()
  async list(
    @CurrentUser() user: AuthUser,
    @Query(new ZodValidationPipe(MoodLogsRangeQuerySchema)) query: MoodLogsRangeQuery,
  ) {
    const items = await this.mood.list(user.id, query);
    return ok(items, 'Mood logs retrieved');
  }

  @Post()
  async create(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(CreateMoodLogSchema)) body: CreateMoodLogInput,
  ) {
    const log = await this.mood.create(user.id, body);
    return ok(log, 'Mood log saved');
  }

  @Put(':id')
  async update(
    @CurrentUser() user: AuthUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(UpdateMoodLogSchema)) body: UpdateMoodLogInput,
  ) {
    const log = await this.mood.update(user.id, id, body);
    return ok(log, 'Mood log updated');
  }

  @Delete(':id')
  async delete(@CurrentUser() user: AuthUser, @Param('id', new ParseUUIDPipe()) id: string) {
    await this.mood.delete(user.id, id);
    return ok(null, 'Mood log deleted');
  }
}
