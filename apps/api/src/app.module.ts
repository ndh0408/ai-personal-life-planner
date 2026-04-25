import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { validateEnv } from './config/env.validation';
import { PrismaModule } from './prisma/prisma.module';
import { I18nModule } from './common/i18n/i18n.module';
import { EncryptionModule } from './common/crypto/encryption.module';

// Foundation
import { HealthModule } from './modules/health/health.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { ProfileModule } from './modules/profile/profile.module';

// Daily planning
import { PlannerModule } from './modules/planner/planner.module';
import { TasksModule } from './modules/tasks/tasks.module';
import { SchedulesModule } from './modules/schedules/schedules.module';
import { ScheduleItemsModule } from './modules/schedule-items/schedule-items.module';
import { HabitsModule } from './modules/habits/habits.module';

// Food + wellbeing
import { MealsModule } from './modules/meals/meals.module';
import { MealLogsModule } from './modules/meal-logs/meal-logs.module';
import { SleepLogsModule } from './modules/sleep-logs/sleep-logs.module';
import { MoodLogsModule } from './modules/mood-logs/mood-logs.module';
import { HealthMetricsModule } from './modules/health-metrics/health-metrics.module';

// Finance
import { WalletsModule } from './modules/wallets/wallets.module';
import { IncomesModule } from './modules/incomes/incomes.module';
import { ExpensesModule } from './modules/expenses/expenses.module';
import { BudgetsModule } from './modules/budgets/budgets.module';
import { DebtsModule } from './modules/debts/debts.module';
import { SavingGoalsModule } from './modules/saving-goals/saving-goals.module';

// Goals
import { GoalsModule } from './modules/goals/goals.module';

// AI
import { AiModule } from './modules/ai/ai.module';
import { AssistantModule } from './modules/assistant/assistant.module';
import { UserAiProvidersModule } from './modules/user-ai-providers/user-ai-providers.module';

// Cross-cutting
import { NotificationsModule } from './modules/notifications/notifications.module';
import { ReportsModule } from './modules/reports/reports.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      validate: validateEnv,
    }),
    ThrottlerModule.forRootAsync({
      useFactory: () => [
        {
          ttl: Number(process.env.THROTTLE_TTL ?? 60) * 1000,
          limit: Number(process.env.THROTTLE_LIMIT ?? 120),
        },
      ],
    }),
    PrismaModule,
    I18nModule,
    EncryptionModule,

    // Foundation
    HealthModule,
    AuthModule,
    UsersModule,
    ProfileModule,

    // Daily planning
    PlannerModule,
    TasksModule,
    SchedulesModule,
    ScheduleItemsModule,
    HabitsModule,

    // Food + wellbeing
    MealsModule,
    MealLogsModule,
    SleepLogsModule,
    MoodLogsModule,
    HealthMetricsModule,

    // Finance
    WalletsModule,
    IncomesModule,
    ExpensesModule,
    BudgetsModule,
    DebtsModule,
    SavingGoalsModule,

    // Goals
    GoalsModule,

    // AI — AiModule is reactive (user-initiated); AssistantModule is proactive (scheduled insights).
    AiModule,
    AssistantModule,
    UserAiProvidersModule,

    // Cross-cutting
    NotificationsModule,
    ReportsModule,
    DashboardModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
