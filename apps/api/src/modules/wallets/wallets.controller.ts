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
import { WalletsService } from './wallets.service';

const WalletTypeSchema = z.enum(['CASH', 'BANK', 'EWALLET', 'SAVINGS', 'OTHER']);

const CreateWalletSchema = z
  .object({
    name: z.string().min(1).max(80),
    type: WalletTypeSchema,
    // Bound the opening balance to a sane range. The lower bound -1e13
    // accounts for credit-card / loan wallets recorded as negatives.
    balance: z.number().finite().min(-1e13).max(1e13).optional(),
    currency: z.string().min(1).max(10).optional(),
  })
  .strict();

// Wallet `balance` is intentionally NOT editable here. Editing it raw races
// with concurrent Income/Expense atomic decrement/increment in transactions
// and corrupts user money. Set the opening balance at create time, then
// adjust via /api/incomes (top-up) or /api/expenses (deduct) which are
// transactional. `currency` is also not editable post-create — flipping
// VND→USD without rebalance silently corrupts dashboard totals.
const UpdateWalletSchema = z
  .object({
    name: z.string().min(1).max(80).optional(),
    type: WalletTypeSchema.optional(),
    isActive: z.boolean().optional(),
  })
  .strict();

type CreateWalletBody = z.infer<typeof CreateWalletSchema>;
type UpdateWalletBody = z.infer<typeof UpdateWalletSchema>;

@Controller('wallets')
@UseGuards(JwtAuthGuard)
export class WalletsController {
  constructor(private readonly svc: WalletsService) {}

  @Get()
  async list(@CurrentUser() user: AuthUser) {
    return ok(await this.svc.list(user.id), 'Wallets retrieved');
  }

  @Post()
  async create(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(CreateWalletSchema)) body: CreateWalletBody,
  ) {
    return ok(await this.svc.create(user.id, body), 'Wallet created');
  }

  @Put(':id')
  async update(
    @CurrentUser() user: AuthUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(UpdateWalletSchema)) body: UpdateWalletBody,
  ) {
    return ok(await this.svc.update(user.id, id, body), 'Wallet updated');
  }

  @Delete(':id')
  async delete(@CurrentUser() user: AuthUser, @Param('id', new ParseUUIDPipe()) id: string) {
    await this.svc.delete(user.id, id);
    return ok(null, 'Wallet deleted');
  }
}
