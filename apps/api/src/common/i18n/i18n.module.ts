import { Global, MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { LocaleMiddleware } from './locale.middleware';
import { LocaleService } from './locale.service';

@Global()
@Module({
  providers: [LocaleService],
  exports: [LocaleService],
})
export class I18nModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(LocaleMiddleware).forRoutes('*');
  }
}
