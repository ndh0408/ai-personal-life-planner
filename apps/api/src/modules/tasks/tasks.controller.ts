import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  CreateTaskSchema,
  UpdateTaskSchema,
  ListTasksQuerySchema,
  PatchTaskStatusSchema,
  type CreateTaskInput,
  type UpdateTaskInput,
  type ListTasksQuery,
  type PatchTaskStatusInput,
} from '@planner/shared';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser, type AuthUser } from '../../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { ok } from '../../common/interceptors/response.interceptor';
import { TasksService } from './tasks.service';

@Controller('tasks')
@UseGuards(JwtAuthGuard)
export class TasksController {
  constructor(private readonly tasks: TasksService) {}

  @Get()
  async list(
    @CurrentUser() user: AuthUser,
    @Query(new ZodValidationPipe(ListTasksQuerySchema)) query: ListTasksQuery,
  ) {
    const result = await this.tasks.list(user.id, query);
    return ok(result, 'Tasks retrieved');
  }

  @Get(':id')
  async getById(@CurrentUser() user: AuthUser, @Param('id', new ParseUUIDPipe()) id: string) {
    const task = await this.tasks.getById(user.id, id);
    return ok(task, 'Task retrieved');
  }

  @Post()
  async create(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(CreateTaskSchema)) body: CreateTaskInput,
  ) {
    const task = await this.tasks.create(user.id, body);
    return ok(task, 'Task created');
  }

  @Put(':id')
  async update(
    @CurrentUser() user: AuthUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(UpdateTaskSchema)) body: UpdateTaskInput,
  ) {
    const task = await this.tasks.update(user.id, id, body);
    return ok(task, 'Task updated');
  }

  @Patch(':id/status')
  async patchStatus(
    @CurrentUser() user: AuthUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(PatchTaskStatusSchema)) body: PatchTaskStatusInput,
  ) {
    const task = await this.tasks.patchStatus(user.id, id, body);
    return ok(task, 'Task status updated');
  }

  @Delete(':id')
  async delete(@CurrentUser() user: AuthUser, @Param('id', new ParseUUIDPipe()) id: string) {
    await this.tasks.delete(user.id, id);
    return ok(null, 'Task deleted');
  }
}
