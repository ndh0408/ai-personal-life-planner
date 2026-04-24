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
  UseGuards,
} from '@nestjs/common';
import { z } from 'zod';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser, type AuthUser } from '../../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { ok } from '../../common/interceptors/response.interceptor';
import { SavingGoalsService } from './saving-goals.service';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const DateStr = z.string().regex(DATE_RE, 'Must be YYYY-MM-DD');
const PrioritySchema = z.enum(['LOW', 'MEDIUM', 'HIGH']);
const StatusSchema = z.enum(['ACTIVE', 'COMPLETED', 'CANCELLED']);

const CreateSchema = z
  .object({
    title: z.string().min(1).max(200),
    targetAmount: z.number().positive(),
    currentAmount: z.number().nonnegative().optional(),
    targetDate: DateStr.optional(),
    priority: PrioritySchema.optional(),
    note: z.string().max(1000).optional(),
  })
  .strict();

const UpdateSchema = CreateSchema.partial().extend({
  status: StatusSchema.optional(),
});

const ContributeSchema = z.object({ amount: z.number().positive() }).strict();

@Controller('saving-goals')
@UseGuards(JwtAuthGuard)
export class SavingGoalsController {
  constructor(private readonly svc: SavingGoalsService) {}

  @Get()
  async list(@CurrentUser() user: AuthUser) {
    return ok(await this.svc.list(user.id), 'Saving goals retrieved');
  }

  @Post()
  async create(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(CreateSchema)) body: z.infer<typeof CreateSchema>,
  ) {
    return ok(await this.svc.create(user.id, body), 'Saving goal created');
  }

  @Put(':id')
  async update(
    @CurrentUser() user: AuthUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(UpdateSchema)) body: z.infer<typeof UpdateSchema>,
  ) {
    return ok(await this.svc.update(user.id, id, body), 'Saving goal updated');
  }

  @Patch(':id/contribute')
  async contribute(
    @CurrentUser() user: AuthUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(ContributeSchema)) body: z.infer<typeof ContributeSchema>,
  ) {
    return ok(await this.svc.contribute(user.id, id, body.amount), 'Contribution recorded');
  }

  @Delete(':id')
  async delete(@CurrentUser() user: AuthUser, @Param('id', new ParseUUIDPipe()) id: string) {
    await this.svc.delete(user.id, id);
    return ok(null, 'Saving goal deleted');
  }
}
