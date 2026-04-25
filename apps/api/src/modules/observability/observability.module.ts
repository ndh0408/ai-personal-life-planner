import { Global, Module } from '@nestjs/common';
import { MetricsRegistry } from './metrics.registry';
import { MetricsInterceptor } from './metrics.interceptor';
import { MetricsController } from './metrics.controller';

/**
 * Cross-cutting observability primitives. The Prom registry + interceptor
 * are wired globally; the controller is mounted unconditionally but returns
 * 404 when METRICS_ENABLED=false (handled inside the controller).
 */
@Global()
@Module({
  controllers: [MetricsController],
  providers: [MetricsRegistry, MetricsInterceptor],
  exports: [MetricsRegistry, MetricsInterceptor],
})
export class ObservabilityModule {}
