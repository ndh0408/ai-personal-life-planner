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
import { ExpensesService } from './expenses.service';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const DateStr = z.string().regex(DATE_RE, 'Must be YYYY-MM-DD');
const NeedLevelSchema = z.enum(['NEED', 'WANT', 'WASTE', 'INVESTMENT', 'SAVING']);
const CurrencyStr = z.string().min(2).max(8).regex(/^[A-Z]{2,8}$/i, 'Currency must be ISO 4217-like');

const CreateExpenseSchema = z
  .object({
    walletId: z.string().uuid().nullable().optional(),
    title: z.string().min(1).max(200),
    amount: z.number().positive().max(1e13),
    currency: CurrencyStr.optional(),
    category: z.string().min(1).max(60),
    expenseDate: DateStr,
    paymentMethod: z.string().max(60).optional(),
    needLevel: NeedLevelSchema.optional(),
    note: z.string().max(1000).optional(),
  })
  .strict();

const UpdateExpenseSchema = CreateExpenseSchema.partial();

const ListQuerySchema = z
  .object({
    from: DateStr.optional(),
    to: DateStr.optional(),
    category: z.string().max(60).optional(),
    needLevel: NeedLevelSchema.optional(),
    currency: CurrencyStr.optional(),
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(20),
  })
  .strict();

@Controller('expenses')
@UseGuards(JwtAuthGuard)
export class ExpensesController {
  constructor(private readonly svc: ExpensesService) {}

  @Get()
  async list(
    @CurrentUser() user: AuthUser,
    @Query(new ZodValidationPipe(ListQuerySchema)) q: z.infer<typeof ListQuerySchema>,
  ) {
    return ok(await this.svc.list(user.id, q), 'Expenses retrieved');
  }

  @Post()
  async create(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(CreateExpenseSchema)) body: z.infer<typeof CreateExpenseSchema>,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    return ok(
      await this.svc.create(user.id, body, { idempotencyKey: sanitiseIdemKey(idempotencyKey) }),
      'Expense created',
    );
  }

  @Put(':id')
  async update(
    @CurrentUser() user: AuthUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(UpdateExpenseSchema)) body: z.infer<typeof UpdateExpenseSchema>,
  ) {
    return ok(await this.svc.update(user.id, id, body), 'Expense updated');
  }

  @Delete(':id')
  async delete(@CurrentUser() user: AuthUser, @Param('id', new ParseUUIDPipe()) id: string) {
    await this.svc.delete(user.id, id);
    return ok(null, 'Expense deleted');
  }
}
