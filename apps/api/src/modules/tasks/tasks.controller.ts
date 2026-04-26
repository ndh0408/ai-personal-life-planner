import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import {
  CurrentUser,
  type AuthenticatedUser,
} from '../../common/decorators/current-user.decorator';
import { TasksService } from './tasks.service';
import type { RangeName } from '../../common/datetime/range';

const ALLOWED_RANGES: RangeName[] = ['today', 'yesterday', 'week', 'month'];

const CreateTaskSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(2000).nullable().optional(),
  dueAt: z.string().datetime().nullable().optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH']).optional(),
});

const UpdateTaskSchema = CreateTaskSchema.partial().extend({
  status: z.enum(['TODO', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']).optional(),
});

function parseRange(raw: string | undefined): RangeName | null {
  if (!raw) return null;
  if ((ALLOWED_RANGES as string[]).includes(raw)) return raw as RangeName;
  throw new BadRequestException({
    error: { code: 'BAD_RANGE', message: `range must be one of ${ALLOWED_RANGES.join(', ')}` },
  });
}

function parseBody<T>(
  schema: { safeParse: (v: unknown) => { success: boolean; data?: T; error?: { issues: unknown[] } } },
  body: unknown,
): T {
  const r = schema.safeParse(body);
  if (!r.success) {
    throw new BadRequestException({
      error: {
        code: 'VALIDATION_FAILED',
        message: 'Dữ liệu không hợp lệ.',
        issues: r.error?.issues,
      },
    });
  }
  return r.data as T;
}

@ApiBearerAuth()
@ApiTags('tasks')
@Controller('tasks')
export class TasksController {
  constructor(private readonly svc: TasksService) {}

  @Get()
  list(@CurrentUser() user: AuthenticatedUser, @Query('range') range?: string) {
    return this.svc.list(user.id, parseRange(range));
  }

  @Post()
  create(@CurrentUser() user: AuthenticatedUser, @Body() body: unknown) {
    return this.svc.create(user.id, parseBody(CreateTaskSchema, body));
  }

  @Patch(':id/complete')
  complete(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.svc.complete(user.id, id);
  }

  @Put(':id')
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    return this.svc.update(user.id, id, parseBody(UpdateTaskSchema, body));
  }

  @Delete(':id')
  remove(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.svc.softDelete(user.id, id);
  }
}
