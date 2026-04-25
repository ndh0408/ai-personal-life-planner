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

## On-call runbook hooks

- A spike in `AI_DAILY_LIMIT_REACHED` errors → suggests a UX bug (looping
  client) or someone trying to abuse a free account.
- A spike in `AI_PROVIDER_FAILED` errors → check the upstream provider
  status page; the orchestrator already retries twice.
- A queue with rising `failed` count → check the BullMQ failed-jobs list
  (`Queue.getFailed()`) for the error message.
