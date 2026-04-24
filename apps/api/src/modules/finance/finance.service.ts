import { Injectable } from '@nestjs/common';

@Injectable()
export class FinanceService {
  /**
   * Placeholder — once the finance Prisma sub-schema lands we'll return the
   * caller's wallets, monthly summary, and budget alerts here.
   */
  async overview(_userId: string) {
    return {
      currency: 'VND',
      wallets: [],
      monthlySummary: { income: 0, expense: 0, net: 0, budgetUsagePct: 0 },
      alerts: [],
      notImplemented: true,
    };
  }
}
