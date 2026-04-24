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
import { z } from 'zod';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser, type AuthUser } from '../../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { ok } from '../../common/interceptors/response.interceptor';
import { HealthMetricsService } from './health-metrics.service';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const DateStr = z.string().regex(DATE_RE, 'Must be YYYY-MM-DD');

const CreateSchema = z
  .object({
    date: DateStr,
    weightKg: z.number().positive().optional(),
    waterIntakeMl: z.number().int().nonnegative().optional(),
    steps: z.number().int().nonnegative().optional(),
    exerciseMinutes: z.number().int().nonnegative().optional(),
    note: z.string().max(1000).optional(),
  })
  .strict();

const UpdateSchema = CreateSchema.partial();

const ListSchema = z
  .object({
    from: DateStr.optional(),
    to: DateStr.optional(),
  })
  .strict();

@Controller('health-metrics')
@UseGuards(JwtAuthGuard)
export class HealthMetricsController {
  constructor(private readonly svc: HealthMetricsService) {}

  @Get()
  async list(
    @CurrentUser() user: AuthUser,
    @Query(new ZodValidationPipe(ListSchema)) q: z.infer<typeof ListSchema>,
  ) {
    return ok(await this.svc.list(user.id, q.from, q.to), 'Health metrics retrieved');
  }

  @Post()
  async create(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(CreateSchema)) body: z.infer<typeof CreateSchema>,
  ) {
    return ok(await this.svc.create(user.id, body), 'Health metric created');
  }

  @Put(':id')
  async update(
    @CurrentUser() user: AuthUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(UpdateSchema)) body: z.infer<typeof UpdateSchema>,
  ) {
    return ok(await this.svc.update(user.id, id, body), 'Health metric updated');
  }

  @Delete(':id')
  async delete(@CurrentUser() user: AuthUser, @Param('id', new ParseUUIDPipe()) id: string) {
    await this.svc.delete(user.id, id);
    return ok(null, 'Health metric deleted');
  }
}
