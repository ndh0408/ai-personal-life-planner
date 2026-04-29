import { Module } from '@nestjs/common';
import { ExpensesController, FinanceTimelineController } from './finance.controller';
import { FinanceService } from './finance.service';

@Module({
  controllers: [ExpensesController, FinanceTimelineController],
  providers: [FinanceService],
})
export class FinanceModule {}
