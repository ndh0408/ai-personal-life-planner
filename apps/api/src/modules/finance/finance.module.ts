import { Module } from '@nestjs/common';
import { FinanceController } from './finance.controller';
import { FinanceService } from './finance.service';

/**
 * Personal finance foundation module.
 *
 * Scope for this iteration is *foundation only* — routes are wired but return
 * placeholder payloads. The full feature set (wallets, transactions, budgets,
 * debts, savings, financial goals, allocation suggestions, overspending alerts)
 * is modeled in docs/PRODUCT_SCOPE.md and will land with a dedicated Prisma
 * sub-schema (`finance_*` tables) in a follow-up iteration.
 */
@Module({
  controllers: [FinanceController],
  providers: [FinanceService],
  exports: [FinanceService],
})
export class FinanceModule {}
