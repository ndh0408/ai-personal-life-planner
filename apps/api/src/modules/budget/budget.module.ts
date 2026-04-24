import { Module } from '@nestjs/common';
import { BudgetController } from './budget.controller';
import { BudgetService } from './budget.service';

/**
 * Budget foundation module — subset of the finance domain scoped to monthly
 * allocations + overspending alerts. Kept separate from FinanceModule so each
 * has a focused surface area.
 *
 * Scope for this iteration is *foundation only*; the full Prisma sub-schema
 * (`budgets`, `budget_categories`, `budget_alerts`) lands with the finance
 * iteration. See docs/PRODUCT_SCOPE.md.
 */
@Module({
  controllers: [BudgetController],
  providers: [BudgetService],
  exports: [BudgetService],
})
export class BudgetModule {}
