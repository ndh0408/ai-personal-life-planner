import { Module } from '@nestjs/common';
import { ExpensesController } from './finance.controller';
import { FinanceService } from './finance.service';

@Module({
  controllers: [ExpensesController],
  providers: [FinanceService],
})
export class FinanceModule {}
