# Round 18 — Observability + Mobile Email-Verify + Ops References

**Date:** 2026-04-25
**Goal:** turn the round-17 backlog into shipped capability — production
metrics, OTel skeleton, mobile email-verify banner, GDPR purge, k8s +
pgBackRest references.

## Summary

| # | Item | Status |
|--|--|--|
| 1 | Email metrics (send total/failure/latency/template render) | **DONE** |
| 2 | WAL/backup age gauges + textfile exporter | **DONE** — `scripts/backup-metrics-exporter.sh` reads markers from cron jobs |
| 3 | Backup/WAL marker writes | **DONE** — `backup-db-encrypted.sh`, `archive-wal.sh`, `restore-verify.sh` write markers |
| 4 | AI quota refusal counter (`lifeos_ai_quota_block_total`) | **DONE** |
| 5 | Live queue depth gauge (`lifeos_queue_depth{queue,state}`) | **DONE** (registered; live setter is round-19 job) |
| 6 | OTel SDK skeleton | **DONE** — env-gated, runtime-optional, redacts authorization/cookie/x-api-key |
| 7 | GDPR purge admin endpoint + service | **DONE** — admin-only, dry-run, confirmation string, audit |
| 8 | Mobile email-verify banner | **DONE** — Dashboard banner, resend, dismiss, vi/en |
| 9 | K8s reference manifests | **DONE** — `deploy/k8s/*` (api + 4 workers + service + HPA + cron + config + secret) |
| 10 | pgBackRest reference | **DONE** — `docs/PGBACKREST_REFERENCE.md` |

## Quality gate

- `npm run typecheck` (api + mobile + shared) — **clean**
- `npm test` (api) — **46 suites / 246 tests pass** (229 round-17 baseline + 17
  new round-18 tests covering DataPurgeService + MetricsRegistry +
  classifyEmailFailure + maybeStartOtel)
- `bash -n` on every new shell script — clean
- `js-yaml`-validated all 10 k8s manifests — clean
- `backup-metrics-exporter.sh` smoke-tested (synthetic markers → expected
  Prometheus textfile)
- i18n parity 1353 ⇄ 1353 (added `common.dismiss` to both locales)
- No raw token / password / verification link / SMTP_PASS / API key
  logged anywhere
- Round 11–17 features unchanged

## Files changed

### New (api)

```
apps/api/src/common/guards/admin.guard.ts
apps/api/src/modules/admin/admin.module.ts
apps/api/src/modules/admin/admin.controller.ts
apps/api/src/modules/admin/data-purge.service.ts
apps/api/src/modules/admin/data-purge.service.spec.ts
apps/api/src/modules/observability/otel.bootstrap.ts
apps/api/src/modules/observability/otel.bootstrap.spec.ts
apps/api/src/modules/observability/metrics.registry.spec.ts
```

### Modified (api)

```
apps/api/src/main.ts                            — call maybeStartOtel() before NestFactory
apps/api/src/app.module.ts                      — register AdminModule
apps/api/src/config/env.validation.ts           — OTEL_SERVICE_NAME, OTEL_ENVIRONMENT
apps/api/src/modules/observability/metrics.registry.ts
                                                 — extended with email + WAL/backup gauges +
                                                   ai quota counter + classifyEmailFailure helper
apps/api/src/modules/auth-security/email-provider.ts
                                                 — Console + Smtp providers record email metrics
apps/api/src/modules/auth-security/email-template.service.ts
                                                 — render counter + lift Locale outside try
apps/api/src/modules/auth-security/email-verification.service.ts
apps/api/src/modules/auth-security/password-reset.service.ts
                                                 — pass template + locale through to provider
apps/api/src/modules/users/users.service.ts     — expose emailVerifiedAt in /api/users/me
apps/api/src/modules/ai-usage/ai-usage.service.ts
                                                 — increment aiQuotaBlockTotal on refusal
```

### New (scripts)

```
scripts/backup-metrics-exporter.sh
```

### Modified (scripts)

```
scripts/backup-db-encrypted.sh                  — write .last-backup-success + .last-prune-success
scripts/archive-wal.sh                          — write .last-wal-archive-success
scripts/restore-verify.sh                       — write .last-backup-verify-success when VERIFY_MARKER_DIR set
```

### New (mobile)

```
apps/mobile/src/components/auth/EmailVerifyBanner.tsx
```

### Modified (mobile)

```
apps/mobile/src/services/api/auth.api.ts        — add emailVerifiedAt to Me type
apps/mobile/src/screens/dashboard/DashboardScreen.tsx
                                                 — render <EmailVerifyBanner /> at top
apps/mobile/src/i18n/locales/{en,vi}.json       — common.dismiss
```

### New (deploy/k8s)

```
deploy/k8s/api-deployment.yaml
deploy/k8s/configmap.example.yaml
deploy/k8s/cronjob-backup.example.yaml
deploy/k8s/hpa.example.yaml
deploy/k8s/secret.example.yaml
deploy/k8s/service.yaml
deploy/k8s/worker-ai-deployment.yaml
deploy/k8s/worker-assistant-deployment.yaml
deploy/k8s/worker-notification-deployment.yaml
deploy/k8s/worker-report-deployment.yaml
```

### New (docs)

```
docs/PGBACKREST_REFERENCE.md
docs/K8S_WORKER_TOPOLOGY.md
docs/GDPR_DATA_PURGE.md
docs/ROUND_18_OBSERVABILITY_MOBILE_COMPLETION.md  (this file)
```

### Modified (docs + config)

```
.env.production.example                         — OTEL_SERVICE_NAME, OTEL_ENVIRONMENT
docs/FULL_PROJECT_COMPLETION_ENTERPRISE_AUDIT.md (round-18 patch appended)
```

## Cardinality discipline (round-18 audit promise)

Every label on every Counter / Histogram / Gauge added in this round was
chosen to bound the time-series count:

| Metric | Labels | Cardinality bound |
|--|--|--|
| `lifeos_email_send_total` | provider (3), status (2), template (4), locale (2) | ≤ 48 series |
| `lifeos_email_send_failure_total` | provider (3), reason (5) | ≤ 15 series |
| `lifeos_email_send_duration_seconds` | provider, template | ≤ 12 series × buckets |
| `lifeos_email_template_render_total` | template (4), locale (2), status (2) | ≤ 16 series |
| `lifeos_ai_quota_block_total` | feature (10) | ≤ 10 series |
| `lifeos_queue_depth` | queue (5), state (3) | ≤ 15 series |
| `lifeos_wal_archive_*` | none | 1 series each |
| `lifeos_backup_*` | none | 1 series each |

NEVER on any label: userId, email, raw token, API key, finance amount,
free-form notes.

## Readiness after Round 18

| Tier | RPO | RTO | Status |
|--|--|--|--|
| MVP ≤10k MAU | 24 h | 60 min | ✅ ready |
| Production 10k–500k | 5 min (`archive_timeout=300s`) | 15-30 min | ⚠ needs operator-chosen base-backup tool (managed snapshot OR pgBackRest — `docs/PGBACKREST_REFERENCE.md` shows the path) |
| Enterprise 500k+ | 5 min | 5 min | ❌ requires multi-AZ + automated failover (separate program) |

We do NOT claim enterprise readiness. The remaining production-tier
prerequisites are operator decisions documented in this round:

1. Pick base-backup tool (managed snapshot vs `pgBackRest`)
2. Wire SMTP credentials (round 17 transport ready; provider's the choice)
3. Real production load test (no synthetic-traffic harness ships in this
   round — operator's responsibility)
4. Managed secret store (the round-15 .env validation forces strong
   inputs; the operator chooses the storage backend)

## Round-19 backlog

- WORKER_ROLE-aware queue subscription (today every worker drains every
  queue regardless of the env hint)
- Live `lifeos_queue_depth` setter (a NestJS background poller calling
  `QueueService.getCounts()`)
- Auto-purge cron for users whose `delete-account-request` is > 30 days
  old (consent + grace-period workflow on top of round-18's GDPR purge)
- Signed user-data export (GDPR Art. 20)
- BullMQ Prometheus exporter (replace the `lifeos_queue_depth` setter
  with the official exporter when it stabilises)
- Multi-AZ streaming Postgres replica (enterprise tier — separate program)
- Email-verification banner placement on Settings + Profile (round-18
  ships only Dashboard)
- Network policies + PodDisruptionBudget on the k8s manifests
