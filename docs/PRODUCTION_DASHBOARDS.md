# Production Dashboards

Suggested Grafana panels backed by the Round-12 metrics. Each panel below
maps to a Prometheus query you can drop into Grafana.

## Service health overview

| Panel | Query |
|--|--|
| Request rate | `sum by (route) (rate(lifeos_http_requests_total[5m]))` |
| 5xx rate | `sum(rate(lifeos_http_requests_total{status_class="5xx"}[5m]))` |
| 4xx rate (excl 401/429) | `sum(rate(lifeos_http_requests_total{status_class="4xx"}[5m]))` |
| p95 latency by route | `histogram_quantile(0.95, sum by (le, route) (rate(lifeos_http_request_duration_seconds_bucket[5m])))` |
| In-flight requests | `sum(lifeos_node_process_active_handles)` |

Alert suggestions:

- **PageOnSustained5xx**: `sum(rate(lifeos_http_requests_total{status_class="5xx"}[5m])) > 1` for 10m
- **WarnOnP95Latency**: `histogram_quantile(0.95, sum by (le) (rate(lifeos_http_request_duration_seconds_bucket[5m]))) > 1.5` for 15m

## AI panel

| Panel | Query |
|--|--|
| AI calls / min by feature | `sum by (feature) (rate(lifeos_ai_calls_total[5m]))` |
| AI failure ratio | `sum(rate(lifeos_ai_calls_total{outcome="error"}[10m])) / sum(rate(lifeos_ai_calls_total[10m]))` |
| AI p95 latency by provider | `histogram_quantile(0.95, sum by (le, provider) (rate(lifeos_ai_call_duration_seconds_bucket[5m])))` |
| Per-user daily quota burn | (queries to ai_usage_logs in the API DB; build a Postgres data source) |

Alerts:

- **AIPlatformDegraded**: `sum(rate(lifeos_ai_calls_total{outcome="error"}[5m])) / sum(rate(lifeos_ai_calls_total[5m])) > 0.2` for 10m

## Notification panel

| Panel | Query |
|--|--|
| Notification outcomes | `sum by (outcome) (rate(lifeos_notifications_total[5m]))` |
| Notification queue depth | `lifeos_queue_jobs_total{queue="notification-queue"}` (for BullMQ scrape see below) |

## Queue panel

`/health/ready` snapshots queue depth; for time-series use the BullMQ
exporter or a Prometheus push from a tiny scraper that calls
`QueueService.getCounts()`. Round 12 ships the data plumbing; the exporter
itself is a 1-day follow-up.

## Database / Redis

Use the official postgres-exporter + redis-exporter sidecars; no custom
queries required.

## Round-17 alert suggestions (WAL + email + backup)

Round 17 doesn't ship the metrics exporters yet — the data lives in
Postgres / log files / `wal-archive-healthcheck.sh` exit codes. Below is
the operator's checklist of alerts to wire into PagerDuty / Slack:

| Alert name | Trigger | Source |
|--|--|--|
| `WALArchiveStale` | `scripts/wal-archive-healthcheck.sh` exits 1 (no fresh WAL in N min) | cron stderr → alerting |
| `WALArchiveBacklog` | healthcheck exits 2 (segments without `.ok` markers) | cron stderr |
| `WALSpoolDiskPressure` | healthcheck exits 3 (mount above DISK_WARN_PERCENT) | cron stderr |
| `BackupFailed` | `scripts/backup-db-encrypted.sh` non-zero exit in cron log | `/var/log/lifeos-backup.log` |
| `RestoreVerifyFailed` | `scripts/restore-verify.sh` exit non-zero on quarterly drill | manual + drill log |
| `SmtpFailureSpike` | grep `[SmtpEmailProvider] smtp send FAILED` rate > 5/min | docker logs lifeos-api |
| `EmailQueueBacklog` | (round-18) when notification queue depth grows unbounded | metrics + queue probe |
| `DBDiskNearFull` | postgres-exporter `pg_database_size_bytes / pg_settings_data_directory_size > 0.85` | postgres-exporter |
| `RedisDown` | `redis_up == 0` from redis-exporter OR `/api/health/ready` reports redis down | redis-exporter / probe |
| `AIProviderFailureHigh` | `lifeos_ai_calls_total{outcome="error"} / lifeos_ai_calls_total > 0.2` | already in §AI panel |
| `NotificationFailureHigh` | `lifeos_notifications_total{outcome!="ok"} / total > 0.1` | round-12 metrics |

Round-18 backlog: ship `lifeos_email_send_failed_total`,
`lifeos_wal_archive_age_seconds`, `lifeos_backup_age_seconds` so the
operator stops scraping log files for these.

## On-call runbook hooks

- A spike in `AI_DAILY_LIMIT_REACHED` errors → suggests a UX bug (looping
  client) or someone trying to abuse a free account.
- A spike in `AI_PROVIDER_FAILED` errors → check the upstream provider
  status page; the orchestrator already retries twice.
- A queue with rising `failed` count → check the BullMQ failed-jobs list
  (`Queue.getFailed()`) for the error message.
- `[SmtpEmailProvider] smtp send FAILED` log lines → check the SMTP
  provider's status page; tokens are persisted before send so users can
  hit "resend" once the transport recovers.
- `[wal-archive] ERROR …` in `/var/log/lifeos-backup.log` → the WAL
  healthcheck will already have alerted; investigate `archive_command`
  exit codes via `pg_stat_archiver` or the Postgres log.
