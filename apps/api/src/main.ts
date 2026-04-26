import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module';
import type { Env } from './config/env.schema';
import { redactEnvForLogging } from './config/config.printer';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
    // Only show stack traces in non-production. In production we still log
    // them server-side; this just controls Nest's own console output.
    abortOnError: process.env.NODE_ENV !== 'production',
  });
  const logger = new Logger('bootstrap');
  const config = app.get(ConfigService<Env, true>);
  const isProduction = config.get('NODE_ENV', { infer: true }) === 'production';

  app.use(
    helmet({
      contentSecurityPolicy: isProduction ? undefined : false,
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );
  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const corsOrigins = config
    .get('CORS_ORIGINS', { infer: true })
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  app.enableCors({
    origin: corsOrigins.length > 0 ? corsOrigins : false,
    credentials: true,
    exposedHeaders: ['x-request-id'],
  });

  // Swagger only when explicitly enabled AND not in production.
  const swaggerEnabled = config.get('SWAGGER_ENABLED', { infer: true }) && !isProduction;
  if (swaggerEnabled) {
    const swaggerCfg = new DocumentBuilder()
      .setTitle('LifeOS AI API')
      .setVersion('0.1.0')
      .addBearerAuth()
      .build();
    const doc = SwaggerModule.createDocument(app, swaggerCfg);
    SwaggerModule.setup('api/docs', app, doc, {
      swaggerOptions: { persistAuthorization: true },
    });
    logger.log('Swagger UI mounted at /api/docs');
  }

  const port = config.get('PORT', { infer: true });
  await app.listen(port);

  logger.log(`LifeOS API listening on http://localhost:${port}/api`);
  if (!isProduction) {
    const safe = redactEnvForLogging({
      NODE_ENV: config.get('NODE_ENV', { infer: true }),
      PORT: config.get('PORT', { infer: true }),
      DATABASE_URL: config.get('DATABASE_URL', { infer: true }),
      REDIS_URL: config.get('REDIS_URL', { infer: true }),
      JWT_ACCESS_SECRET: config.get('JWT_ACCESS_SECRET', { infer: true }),
      JWT_REFRESH_SECRET: config.get('JWT_REFRESH_SECRET', { infer: true }),
      JWT_ACCESS_TTL: config.get('JWT_ACCESS_TTL', { infer: true }),
      JWT_REFRESH_TTL: config.get('JWT_REFRESH_TTL', { infer: true }),
      USER_AI_KEY_ENCRYPTION_KEY: config.get('USER_AI_KEY_ENCRYPTION_KEY', { infer: true }),
      OPENAI_BASE_URL: config.get('OPENAI_BASE_URL', { infer: true }),
      OPENAI_DEFAULT_MODEL: config.get('OPENAI_DEFAULT_MODEL', { infer: true }),
      CORS_ORIGINS: config.get('CORS_ORIGINS', { infer: true }),
      THROTTLE_TTL: config.get('THROTTLE_TTL', { infer: true }),
      THROTTLE_LIMIT: config.get('THROTTLE_LIMIT', { infer: true }),
      SWAGGER_ENABLED: config.get('SWAGGER_ENABLED', { infer: true }),
    });
    logger.debug(`env: ${JSON.stringify(safe)}`);
  }
}

bootstrap().catch((err) => {
  // No Logger here — bootstrap may have failed before Logger flushed.
  // eslint-disable-next-line no-console
  console.error('Fatal bootstrap error:', err instanceof Error ? err.message : err);
  process.exit(1);
});
