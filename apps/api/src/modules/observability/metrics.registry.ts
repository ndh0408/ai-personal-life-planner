import { Injectable, OnModuleInit } from '@nestjs/common';
import { Counter, Histogram, Registry, collectDefaultMetrics } from 'prom-client';

/**
 * Prometheus metrics registry. One instance per process; exposed via
 * MetricsController behind METRICS_ENABLED + optional bearer auth.
 *
 * Naming follows Prometheus conventions:
 *   - <namespace>_<unit_or_subject>
 *   - counters end with `_total`
 *   - histograms include unit (`_seconds`)
 */
@Injectable()
export class MetricsRegistry implements OnModuleInit {
  readonly registry = new Registry();

  readonly httpRequests = new Counter({
    name: 'lifeos_http_requests_total',
    help: 'HTTP request count by route + method + status_code class',
    labelNames: ['method', 'route', 'status_class'] as const,
    registers: [this.registry],
  });

  readonly httpLatency = new Histogram({
    name: 'lifeos_http_request_duration_seconds',
    help: 'HTTP request latency in seconds',
    labelNames: ['method', 'route', 'status_class'] as const,
    buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
    registers: [this.registry],
  });

  readonly aiCallTotal = new Counter({
    name: 'lifeos_ai_calls_total',
    help: 'AI provider calls by feature + provider + outcome',
    labelNames: ['feature', 'provider', 'outcome'] as const,
    registers: [this.registry],
  });

  readonly aiCallLatency = new Histogram({
    name: 'lifeos_ai_call_duration_seconds',
    help: 'AI provider call latency',
    labelNames: ['feature', 'provider'] as const,
    buckets: [0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10, 25],
    registers: [this.registry],
  });

  readonly notificationDelivered = new Counter({
    name: 'lifeos_notifications_total',
    help: 'Notification delivery outcomes',
    labelNames: ['outcome'] as const,
    registers: [this.registry],
  });

  readonly queueDepth = new Counter({
    name: 'lifeos_queue_jobs_total',
    help: 'BullMQ jobs by queue and outcome',
    labelNames: ['queue', 'outcome'] as const,
    registers: [this.registry],
  });

  onModuleInit(): void {
    // Skip default Node.js metrics in jest — prom-client schedules a setInterval
    // for event-loop / GC stats which jest reports as a leaked timer.
    if (process.env.NODE_ENV === 'test') return;
    collectDefaultMetrics({ register: this.registry, prefix: 'lifeos_node_' });
  }
}
