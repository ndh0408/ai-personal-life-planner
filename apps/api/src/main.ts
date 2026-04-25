import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { ValidationPipe, Logger } from '@nestjs/common';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  const config = app.get(ConfigService);
  const logger = new Logger('Bootstrap');

  app.use(helmet());

  const isProd = config.get<string>('NODE_ENV') === 'production';
  const corsOriginRaw = (config.get<string>('CORS_ORIGIN') ?? '').trim();
  if (isProd && (!corsOriginRaw || corsOriginRaw === '*')) {
    throw new Error(
      'CORS_ORIGIN must be set to a concrete origin list in production (no "*").',
    );
  }
  const corsOrigins = corsOriginRaw === '' || corsOriginRaw === '*'
    ? true
    : corsOriginRaw.split(',').map((s) => s.trim()).filter(Boolean);
  app.enableCors({
    origin: corsOrigins,
    // Per CORS spec, "*" + credentials is invalid. Only enable credentials
    // when origins are concrete so we never reflect arbitrary origins with
    // credentials.
    credentials: corsOrigins !== true,
  });

  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalInterceptors(new ResponseInterceptor());

  const port = Number(config.get('PORT', 3000));
  await app.listen(port);
  logger.log(`API listening on http://localhost:${port}/api`);
}

bootstrap().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('Fatal bootstrap error', err);
  process.exit(1);
});
