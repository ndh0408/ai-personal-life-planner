import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { z } from 'zod';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser, type AuthUser } from '../../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { ok } from '../../common/interceptors/response.interceptor';
import { BudgetsService } from './budgets.service';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const DateStr = z.string().regex(DATE_RE, 'Must be YYYY-MM-DD');
const BudgetPeriodSchema = z.enum(['WEEKLY', 'MONTHLY']);

const CurrencyStr = z.string().min(2).max(8).regex(/^[A-Z]{2,8}$/i, 'Currency must be ISO 4217-like');

const CreateBudgetSchema = z
  .object({
    category: z.string().min(1).max(60),
    amount: z.number().positive().max(1e13),
    currency: CurrencyStr.optional(),
    period: BudgetPeriodSchema,
    startDate: DateStr,
    endDate: DateStr,
    alertThresholdPercent: z.number().int().min(1).max(200).optional(),
  })
  .strict();

const UpdateBudgetSchema = CreateBudgetSchema.partial();

@Controller('budgets')
@UseGuards(JwtAuthGuard)
export class BudgetsController {
  constructor(private readonly svc: BudgetsService) {}

  @Get()
  async list(@CurrentUser() user: AuthUser) {
    return ok(await this.svc.list(user.id), 'Budgets retrieved');
  }

  @Post()
  async create(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(CreateBudgetSchema)) body: z.infer<typeof CreateBudgetSchema>,
  ) {
    return ok(await this.svc.create(user.id, body), 'Budget created');
  }

  @Put(':id')
  async update(
    @CurrentUser() user: AuthUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(UpdateBudgetSchema)) body: z.infer<typeof UpdateBudgetSchema>,
  ) {
    return ok(await this.svc.update(user.id, id, body), 'Budget updated');
  }

  @Delete(':id')
  async delete(@CurrentUser() user: AuthUser, @Param('id', new ParseUUIDPipe()) id: string) {
    await this.svc.delete(user.id, id);
    return ok(null, 'Budget deleted');
  }
}
