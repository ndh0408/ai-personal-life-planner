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
import { MealLogsService } from './meal-logs.service';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const DateStr = z.string().regex(DATE_RE, 'Must be YYYY-MM-DD');
const MealTypeSchema = z.enum(['BREAKFAST', 'LUNCH', 'DINNER', 'SNACK']);

const CreateSchema = z
  .object({
    date: DateStr,
    mealType: MealTypeSchema,
    title: z.string().min(1).max(200),
    note: z.string().max(1000).optional(),
    estimatedCalories: z.number().int().nonnegative().optional(),
    cost: z.number().nonnegative().optional(),
  })
  .strict();

const UpdateSchema = CreateSchema.partial();

const ListSchema = z
  .object({
    from: DateStr.optional(),
    to: DateStr.optional(),
    mealType: MealTypeSchema.optional(),
  })
  .strict();

@Controller('meal-logs')
@UseGuards(JwtAuthGuard)
export class MealLogsController {
  constructor(private readonly svc: MealLogsService) {}

  @Get()
  async list(
    @CurrentUser() user: AuthUser,
    @Query(new ZodValidationPipe(ListSchema)) q: z.infer<typeof ListSchema>,
  ) {
    return ok(await this.svc.list(user.id, q.from, q.to, q.mealType), 'Meal logs retrieved');
  }

  @Post()
  async create(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(CreateSchema)) body: z.infer<typeof CreateSchema>,
  ) {
    return ok(await this.svc.create(user.id, body), 'Meal log created');
  }

  @Put(':id')
  async update(
    @CurrentUser() user: AuthUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(UpdateSchema)) body: z.infer<typeof UpdateSchema>,
  ) {
    return ok(await this.svc.update(user.id, id, body), 'Meal log updated');
  }

  @Delete(':id')
  async delete(@CurrentUser() user: AuthUser, @Param('id', new ParseUUIDPipe()) id: string) {
    await this.svc.delete(user.id, id);
    return ok(null, 'Meal log deleted');
  }
}
