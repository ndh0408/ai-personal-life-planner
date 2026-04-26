import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { JwtModule } from '@nestjs/jwt';

import { validateEnv } from './config/env.schema';
import { PrismaModule } from './prisma/prisma.module';
import { RedisModule } from './redis/redis.module';
import { EncryptionModule } from './common/crypto/encryption.module';
import { ResponseEnvelopeInterceptor } from './common/http/response.interceptor';
import { AllExceptionsFilter } from './common/http/all-exceptions.filter';
import { RequestIdMiddleware } from './common/http/request-id.middleware';

import { HealthController } from './health/health.controller';
import { VersionController } from './health/version.controller';

import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { UserProfileModule } from './modules/user-profile/user-profile.module';
import { UserAiKeyModule } from './modules/user-ai-key/user-ai-key.module';
import { TasksModule } from './modules/tasks/tasks.module';
import { FinanceModule } from './modules/finance/finance.module';
import { MealsModule } from './modules/meals/meals.module';
import { SleepMoodModule } from './modules/sleep-mood/sleep-mood.module';
import { PlannerModule } from './modules/planner/planner.module';
import { AssistantModule } from './modules/assistant/assistant.module';
import { AiModule } from './modules/ai/ai.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { PrivacyModule } from './modules/privacy/privacy.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      validate: validateEnv,
    }),
    JwtModule.register({ global: true }),
    ThrottlerModule.forRootAsync({
      useFactory: () => [
        {
          ttl: Number(process.env.THROTTLE_TTL ?? 60) * 1000,
          limit: Number(process.env.THROTTLE_LIMIT ?? 100),
        },
      ],
    }),

    PrismaModule,
    RedisModule,
    EncryptionModule,

    AuthModule,
    UsersModule,
    UserProfileModule,
    UserAiKeyModule,
    TasksModule,
    FinanceModule,
    MealsModule,
    SleepMoodModule,
    PlannerModule,
    AssistantModule,
    AiModule,
    NotificationsModule,
    PrivacyModule,
  ],
  controllers: [HealthController, VersionController],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_INTERCEPTOR, useClass: ResponseEnvelopeInterceptor },
    {
      provide: APP_FILTER,
      useFactory: () => new AllExceptionsFilter(process.env.NODE_ENV === 'production'),
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestIdMiddleware).forRoutes('*');
  }
}
