import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
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
import { sanitiseIdemKey } from '../../common/finance/idempotency-key';
import { DebtsService } from './debts.service';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const DateStr = z.string().regex(DATE_RE, 'Must be YYYY-MM-DD');
const DebtTypeSchema = z.enum(['I_OWE', 'OWED_TO_ME']);
const DebtStatusSchema = z.enum(['ACTIVE', 'PAID', 'CANCELLED']);

const CurrencyStr = z.string().min(2).max(8).regex(/^[A-Z]{2,8}$/i, 'Currency must be ISO 4217-like');

const CreateDebtSchema = z
  .object({
    type: DebtTypeSchema,
    personName: z.string().max(120).optional(),
    title: z.string().min(1).max(200),
    totalAmount: z.number().positive().max(1e13),
    paidAmount: z.number().nonnegative().max(1e13).optional(),
    currency: CurrencyStr.optional(),
    dueDate: DateStr.optional(),
    note: z.string().max(1000).optional(),
  })
  .strict();

const UpdateDebtSchema = CreateDebtSchema.partial().extend({
  status: DebtStatusSchema.optional(),
});

const PaymentSchema = z
  .object({
    amount: z.number().positive().max(1e13),
    markPaid: z.boolean().optional(),
  })
  .strict();

@Controller('debts')
@UseGuards(JwtAuthGuard)
export class DebtsController {
  constructor(private readonly svc: DebtsService) {}

  @Get()
  async list(@CurrentUser() user: AuthUser) {
    return ok(await this.svc.list(user.id), 'Debts retrieved');
  }

  @Post()
  async create(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(CreateDebtSchema)) body: z.infer<typeof CreateDebtSchema>,
  ) {
    return ok(await this.svc.create(user.id, body), 'Debt created');
  }

  @Put(':id')
  async update(
    @CurrentUser() user: AuthUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(UpdateDebtSchema)) body: z.infer<typeof UpdateDebtSchema>,
  ) {
    return ok(await this.svc.update(user.id, id, body), 'Debt updated');
  }

  @Patch(':id/payment')
  async addPayment(
    @CurrentUser() user: AuthUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(PaymentSchema)) body: z.infer<typeof PaymentSchema>,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    return ok(
      await this.svc.addPayment(user.id, id, body.amount, {
        markPaid: body.markPaid,
        idempotencyKey: sanitiseIdemKey(idempotencyKey),
      }),
      'Payment recorded',
    );
  }

  @Delete(':id')
  async delete(@CurrentUser() user: AuthUser, @Param('id', new ParseUUIDPipe()) id: string) {
    await this.svc.delete(user.id, id);
    return ok(null, 'Debt deleted');
  }
}
