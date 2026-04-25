import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
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
import { sanitiseIdemKey } from '../../common/finance/idempotency-key';
import { IncomesService } from './incomes.service';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const DateStr = z.string().regex(DATE_RE, 'Must be YYYY-MM-DD');
const CurrencyStr = z.string().min(2).max(8).regex(/^[A-Z]{2,8}$/i, 'Currency must be ISO 4217-like');

const CreateIncomeSchema = z
  .object({
    walletId: z.string().uuid().nullable().optional(),
    title: z.string().min(1).max(200),
    amount: z.number().positive().max(1e13),
    currency: CurrencyStr.optional(),
    category: z.string().max(60).optional(),
    source: z.string().max(120).optional(),
    incomeDate: DateStr,
    isRecurring: z.boolean().optional(),
    recurringRule: z.string().max(120).optional(),
    note: z.string().max(1000).optional(),
  })
  .strict();

const UpdateIncomeSchema = CreateIncomeSchema.partial();

const RangeQuerySchema = z
  .object({
    from: DateStr.optional(),
    to: DateStr.optional(),
    category: z.string().max(60).optional(),
    currency: CurrencyStr.optional(),
  })
  .strict();

@Controller('incomes')
@UseGuards(JwtAuthGuard)
export class IncomesController {
  constructor(private readonly svc: IncomesService) {}

  @Get()
  async list(
    @CurrentUser() user: AuthUser,
    @Query(new ZodValidationPipe(RangeQuerySchema)) q: z.infer<typeof RangeQuerySchema>,
  ) {
    return ok(await this.svc.list(user.id, q), 'Incomes retrieved');
  }

  @Post()
  async create(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(CreateIncomeSchema)) body: z.infer<typeof CreateIncomeSchema>,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    return ok(
      await this.svc.create(user.id, body, { idempotencyKey: sanitiseIdemKey(idempotencyKey) }),
      'Income created',
    );
  }

  @Put(':id')
  async update(
    @CurrentUser() user: AuthUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(UpdateIncomeSchema)) body: z.infer<typeof UpdateIncomeSchema>,
  ) {
    return ok(await this.svc.update(user.id, id, body), 'Income updated');
  }

  @Delete(':id')
  async delete(@CurrentUser() user: AuthUser, @Param('id', new ParseUUIDPipe()) id: string) {
    await this.svc.delete(user.id, id);
    return ok(null, 'Income deleted');
  }

  @Post(':id/restore')
  async restore(@CurrentUser() user: AuthUser, @Param('id', new ParseUUIDPipe()) id: string) {
    return ok(await this.svc.restore(user.id, id), 'Income restored');
  }
}
