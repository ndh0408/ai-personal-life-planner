# Observability

Round 12 added the foundations for production observability: Prometheus
metrics, structured logging, request correlation, and (optional) OpenTelemetry
hooks.

## Request correlation (Round 11 + Round 12)

- `requestIdMiddleware` (apps/api/src/common/middleware/request-id.middleware.ts)
  generates a uuid for every request (or trusts `x-request-id` capped at
  64 chars). Echoed on the response.
- `AllExceptionsFilter` includes `requestId` in:
  - the structured 5xx log line: `[req=...] METHOD url → status [errorCode]`
  - the JSON error body returned to the client.

The mobile client logs the request id alongside any user-visible error so
that tickets carry a server-side correlation token.

## Metrics

`apps/api/src/modules/observability/metrics.registry.ts` exposes the
following Prometheus series via `prom-client`:

| Metric | Type | Labels | What |
|--|--|--|--|
| `lifeos_http_requests_total` | counter | method, route, status_class | API request count |
| `lifeos_http_request_duration_seconds` | histogram | method, route, status_class | API latency |
| `lifeos_ai_calls_total` | counter | feature, provider, outcome | AI provider calls |
| `lifeos_ai_call_duration_seconds` | histogram | feature, provider | AI latency |
| `lifeos_notifications_total` | counter | outcome | Notification deliveries |
| `lifeos_queue_jobs_total` | counter | queue, outcome | BullMQ job outcomes |
| `lifeos_node_*` | various | — | Default Node.js metrics (event loop, GC, heap) |

### Cardinality

Routes are reduced to the matched Express path (`req.route.path`) so
`/api/expenses/:id` doesn't explode into one label per uuid.

### Endpoint

```
GET /metrics
```

Disabled by default — the controller returns 404 unless
`METRICS_ENABLED=true`. When enabled, set `METRICS_BEARER_TOKEN` to require
`Authorization: Bearer <token>`. Without the bearer token, the endpoint is
open and should only be exposed on a private network (Prometheus scraping
inside the VPC, never at the public ingress).

## Logging

- Logger: NestJS `Logger`. Severity is honoured via `LOG_LEVEL` env (one of
  `error | warn | log | debug | verbose`).
- Never logs: API keys, tokens, refresh tokens, prompt bodies, response
  bodies, finance amounts, health metrics. Audit grep:
  `grep -rn "console\.\|logger\.log.*\(token\|password\|prompt\)" apps/api/src`.
- 5xx log lines carry `[req=<id>] METHOD url → 500 [ERRCODE]` + stack.

## OpenTelemetry (skeleton)

`OTEL_ENABLED=true` + `OTEL_EXPORTER_OTLP_ENDPOINT=https://…/v1/traces`
turns on OTel-compatible export (no SDK packaged yet — the env gate fails
production validation when enabled, signaling the operator to wire the SDK
of their choice). Wiring the SDK itself is left for a v1.4 round once the
exporter target is selected.

## Health checks

- `GET /health` → liveness; cheap process ping (no I/O)
- `GET /health/ready` → readiness; reports DB + Redis + queue depth.

Use `/health` for k8s livenessProbe, `/health/ready` for readinessProbe.

## Local debugging

```bash
QUEUE_ENABLED=true REDIS_URL=redis://localhost:6379 \
METRICS_ENABLED=true \
LOG_LEVEL=debug \
npm --workspace apps/api run start:dev

curl http://localhost:3000/metrics    # Prometheus exposition
curl http://localhost:3000/health/ready
```
