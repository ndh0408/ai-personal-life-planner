import { Injectable } from '@nestjs/common';

@Injectable()
export class BudgetService {
  async summary(_userId: string) {
    return {
      month: new Date().toISOString().slice(0, 7),
      categories: [],
      totalBudget: 0,
      totalSpent: 0,
      remaining: 0,
      alerts: [],
      notImplemented: true,
    };
  }
}
