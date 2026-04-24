import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { validateEnv } from './config/env.validation';
import { PrismaModule } from './prisma/prisma.module';
import { I18nModule } from './common/i18n/i18n.module';
import { HealthModule } from './modules/health/health.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { AiModule } from './modules/ai/ai.module';
import { ProfileModule } from './modules/profile/profile.module';
import { TasksModule } from './modules/tasks/tasks.module';
import { SchedulesModule } from './modules/schedules/schedules.module';
import { ScheduleItemsModule } from './modules/schedule-items/schedule-items.module';
import { HabitsModule } from './modules/habits/habits.module';
import { MealsModule } from './modules/meals/meals.module';
import { SleepLogsModule } from './modules/sleep-logs/sleep-logs.module';
import { MoodLogsModule } from './modules/mood-logs/mood-logs.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { ReportsModule } from './modules/reports/reports.module';
import { PlannerModule } from './modules/planner/planner.module';
import { FinanceModule } from './modules/finance/finance.module';
import { BudgetModule } from './modules/budget/budget.module';
import { GoalsModule } from './modules/goals/goals.module';
import { AssistantModule } from './modules/assistant/assistant.module';

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

    // Wellbeing
    MealsModule,
    SleepLogsModule,
    MoodLogsModule,

    // Upcoming (foundation stubs — see docs/PRODUCT_SCOPE.md)
    FinanceModule,
    BudgetModule,
    GoalsModule,

    // AI — AiModule is reactive (user-initiated). AssistantModule is proactive (scheduled insights).
    AiModule,
    AssistantModule,

    // Cross-cutting
    NotificationsModule,
    ReportsModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
