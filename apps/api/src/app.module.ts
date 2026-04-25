import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { validateEnv } from './config/env.validation';
import { PrismaModule } from './prisma/prisma.module';
import { I18nModule } from './common/i18n/i18n.module';
import { EncryptionModule } from './common/crypto/encryption.module';
import { RedisService } from './modules/queue/redis.service';
import { RedisThrottlerStorage } from './modules/queue/redis-throttler.storage';
import { UserAwareThrottlerGuard } from './common/guards/user-aware-throttler.guard';
import { MetricsInterceptor } from './modules/observability/metrics.interceptor';

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
import { PrivacyModule } from './modules/privacy/privacy.module';
import { CommunicationModule } from './modules/communication/communication.module';
import { VoiceCompanionModule } from './modules/voice-companion/voice-companion.module';
import { ContextInferenceModule } from './modules/context-inference/context-inference.module';
import { WidgetsModule } from './modules/widgets/widgets.module';

// Cross-cutting
import { NotificationsModule } from './modules/notifications/notifications.module';
import { ReportsModule } from './modules/reports/reports.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';

// Round 12: infrastructure
import { QueueModule } from './modules/queue/queue.module';
import { ObservabilityModule } from './modules/observability/observability.module';
import { AiUsageModule } from './modules/ai-usage/ai-usage.module';

// Round 13: finance correctness primitives
import { FinanceCoreModule } from './modules/finance-core/finance-core.module';

// Round 14: auth security (lockout, email verification, password reset)
import { AuthSecurityModule } from './modules/auth-security/auth-security.module';

// Round 18: admin-only ops (GDPR purge today)
import { AdminModule } from './modules/admin/admin.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      validate: validateEnv,
    }),
    ThrottlerModule.forRootAsync({
      inject: [RedisService],
      useFactory: (redis: RedisService) => ({
        throttlers: [
          {
            ttl: Number(process.env.THROTTLE_TTL ?? 60) * 1000,
            limit: Number(process.env.THROTTLE_LIMIT ?? 120),
          },
        ],
        storage: new RedisThrottlerStorage(redis),
      }),
    }),
    PrismaModule,
    I18nModule,
    EncryptionModule,
    QueueModule,
    ObservabilityModule,
    AiUsageModule,
    FinanceCoreModule,
    AuthSecurityModule,
    AdminModule,

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
    PrivacyModule,
    CommunicationModule,
    VoiceCompanionModule,
    ContextInferenceModule,
    WidgetsModule,

    // Cross-cutting
    NotificationsModule,
    ReportsModule,
    DashboardModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: UserAwareThrottlerGuard,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: MetricsInterceptor,
    },
  ],
})
export class AppModule {}
