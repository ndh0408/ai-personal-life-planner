import { BadRequestException, Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  CurrentUser,
  type AuthenticatedUser,
} from '../../common/decorators/current-user.decorator';
import { TasksService } from './tasks.service';
import type { RangeName } from '../../common/datetime/range';

const ALLOWED_RANGES: RangeName[] = ['today', 'yesterday', 'week', 'month'];

function parseRange(raw: string | undefined): RangeName | null {
  if (!raw) return null;
  if ((ALLOWED_RANGES as string[]).includes(raw)) return raw as RangeName;
  throw new BadRequestException({
    error: { code: 'BAD_RANGE', message: `range must be one of ${ALLOWED_RANGES.join(', ')}` },
  });
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
}
