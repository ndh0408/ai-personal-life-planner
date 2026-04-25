import { Injectable, OnModuleInit } from '@nestjs/common';
import { Counter, Gauge, Histogram, Registry, collectDefaultMetrics } from 'prom-client';

/**
 * Prometheus metrics registry. One instance per process; exposed via
 * MetricsController behind METRICS_ENABLED + optional bearer auth.
 *
 * Naming follows Prometheus conventions:
 *   - `<namespace>_<unit_or_subject>`
 *   - counters end with `_total`
 *   - histograms include unit (`_seconds`)
 *   - gauges named with the metric they represent (e.g. `..._age_seconds`)
 *
 * Cardinality discipline (round-18 audit promise):
 *   - NEVER include userId, email, raw token, API key, or finance amount
 *     in a label.
 *   - Routes use the matched Express path (`req.route.path`) so id-bearing
 *     paths don't explode the time-series.
 *   - Free-form fields (template name, error class) are bounded by a
 *     small enum at the call site.
 */
@Injectable()
export class MetricsRegistry implements OnModuleInit {
  readonly registry = new Registry();

  // ---- HTTP (round 12) ------------------------------------------------------
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

  // ---- AI (round 12) --------------------------------------------------------
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

  /** Round 18: incremented when AiUsageService denies a call (quota cap). */
  readonly aiQuotaBlockTotal = new Counter({
    name: 'lifeos_ai_quota_block_total',
    help: 'AI quota refusals by feature',
    labelNames: ['feature'] as const,
    registers: [this.registry],
  });

  // ---- Notifications (round 12) --------------------------------------------
  readonly notificationDelivered = new Counter({
    name: 'lifeos_notifications_total',
    help: 'Notification delivery outcomes',
    labelNames: ['outcome'] as const,
    registers: [this.registry],
  });

  // ---- Queue (round 12) ----------------------------------------------------
  readonly queueDepth = new Counter({
    name: 'lifeos_queue_jobs_total',
    help: 'BullMQ jobs by queue and outcome',
    labelNames: ['queue', 'outcome'] as const,
    registers: [this.registry],
  });

  /** Round 18: snapshot of waiting/active/failed counts per queue. */
  readonly queueDepthGauge = new Gauge({
    name: 'lifeos_queue_depth',
    help: 'BullMQ live depth by queue + state',
    labelNames: ['queue', 'state'] as const,
    registers: [this.registry],
  });

  // ---- Email (round 18) -----------------------------------------------------
  readonly emailSendTotal = new Counter({
    name: 'lifeos_email_send_total',
    help: 'Email send attempts by provider + status + template + locale',
    // status ∈ ok|failed
    labelNames: ['provider', 'status', 'template', 'locale'] as const,
    registers: [this.registry],
  });

  readonly emailSendFailureTotal = new Counter({
    name: 'lifeos_email_send_failure_total',
    help: 'Email send failures by provider + bounded reason class',
    // reason: bounded enum (timeout|auth|invalid_address|provider_5xx|other)
    labelNames: ['provider', 'reason'] as const,
    registers: [this.registry],
  });

  readonly emailSendLatency = new Histogram({
    name: 'lifeos_email_send_duration_seconds',
    help: 'Email transport send latency',
    labelNames: ['provider', 'template'] as const,
    buckets: [0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10, 30],
    registers: [this.registry],
  });

  readonly emailTemplateRenderTotal = new Counter({
    name: 'lifeos_email_template_render_total',
    help: 'EmailTemplateService render calls by template + locale + status',
    labelNames: ['template', 'locale', 'status'] as const,
    registers: [this.registry],
  });

  // ---- Backup + WAL (round 18) ---------------------------------------------
  /**
   * Round-18 design: the Node process does NOT itself read backup spool
   * files (the API user shouldn't have write access to /var/lib/lifeos).
   * Instead, `scripts/backup-metrics-exporter.sh` reads marker files left
   * by the cron jobs and writes a Prometheus textfile that node-exporter
   * picks up. The gauges below ARE registered here so a future in-process
   * collector (e.g. when we run the exporter as a NestJS background task)
   * has somewhere to publish; today they're set only when the operator
   * wires one up.
   */
  readonly walArchiveLastSuccess = new Gauge({
    name: 'lifeos_wal_archive_last_success_timestamp_seconds',
    help: 'Unix epoch of the last successful WAL archive segment',
    registers: [this.registry],
  });

  readonly walArchiveStaleSeconds = new Gauge({
    name: 'lifeos_wal_archive_stale_seconds',
    help: 'Seconds since the most recent WAL archive segment',
    registers: [this.registry],
  });

  readonly walArchiveBacklogCount = new Gauge({
    name: 'lifeos_wal_archive_backlog_count',
    help: 'WAL segments encrypted but not yet flagged .ok (upload pending/failed)',
    registers: [this.registry],
  });

  readonly backupLastSuccess = new Gauge({
    name: 'lifeos_backup_last_success_timestamp_seconds',
    help: 'Unix epoch of the last successful logical encrypted backup',
    registers: [this.registry],
  });

  readonly backupAgeSeconds = new Gauge({
    name: 'lifeos_backup_age_seconds',
    help: 'Seconds since the most recent successful backup',
    registers: [this.registry],
  });

  readonly backupVerifyLastSuccess = new Gauge({
    name: 'lifeos_backup_verify_last_success_timestamp_seconds',
    help: 'Unix epoch of the last successful restore-verify drill',
    registers: [this.registry],
  });

  readonly backupVerifyAgeSeconds = new Gauge({
    name: 'lifeos_backup_verify_age_seconds',
    help: 'Seconds since the most recent restore-verify drill',
    registers: [this.registry],
  });

  readonly backupPruneLastSuccess = new Gauge({
    name: 'lifeos_backup_prune_last_success_timestamp_seconds',
    help: 'Unix epoch of the last successful tiered prune run',
    registers: [this.registry],
  });

  onModuleInit(): void {
    // Skip default Node.js metrics in jest — prom-client schedules a setInterval
    // for event-loop / GC stats which jest reports as a leaked timer.
    if (process.env.NODE_ENV === 'test') return;
    collectDefaultMetrics({ register: this.registry, prefix: 'lifeos_node_' });
  }
}

/**
 * Bound the `reason` label cardinality on email failures. Anything we don't
 * recognise becomes 'other' so a flaky upstream can't blow up the time-series.
 */
export function classifyEmailFailure(err: unknown): string {
  if (!(err instanceof Error)) return 'other';
  const msg = (err.message || '').toLowerCase();
  if (msg.includes('timeout') || msg.includes('etimedout')) return 'timeout';
  if (msg.includes('auth') || msg.includes('535') || msg.includes('530')) return 'auth';
  if (msg.includes('invalid') && msg.includes('address')) return 'invalid_address';
  if (msg.includes('5.') || msg.includes('421') || msg.includes('connection')) return 'provider_5xx';
  return 'other';
}
