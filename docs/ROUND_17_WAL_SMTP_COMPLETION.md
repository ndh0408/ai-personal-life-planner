# Round 17 — WAL Archiving + SMTP Nodemailer

**Date:** 2026-04-25
**Goal:** lift the production-tier RPO target from 24 h (logical dump only)
toward 1 h (WAL archiving) AND wire a real SMTP transport so verify-email +
forgot-password emails leave the building.

## Summary

| # | Item | Round-17 status |
|--|--|--|
| 1 | WAL archive script (`archive-wal.sh`) | **DONE** — encrypted (AES-256-CBC PBKDF2-200k), idempotent (lockfile + .ok marker), local + S3 mode |
| 2 | WAL healthcheck (`wal-archive-healthcheck.sh`) | **DONE** — three failure modes (stale / backlog / disk) with distinct exit codes |
| 3 | WAL docs (`docs/WAL_ARCHIVING.md`) | **DONE** — postgresql.conf snippet + Mode A vs Mode B explainer |
| 4 | PITR procedure (`docs/PITR_RESTORE.md`) | **DONE** — full restore-to-instant recipe |
| 5 | SMTP nodemailer transport | **DONE** — pool=1, redacted logs, fail-fast env validation |
| 6 | EmailTemplateService (vi/en) | **DONE** — verify-email, reset-password, security-alert |
| 7 | Email docs (`docs/EMAIL_DELIVERY.md`) | **DONE** — env contract, log redaction, transport-swap recipe |
| — | Physical base backup (`pg_basebackup` / managed snapshot) | **DEFERRED** — depends on production topology choice |
| — | Email send failure metric exporter | **DEFERRED** — round-18 backlog |
| — | Multi-AZ replication for enterprise tier | **DEFERRED** — separate program |

## RPO / RTO after round 17

| Tier | RPO | RTO | Status |
|--|--|--|--|
| **MVP** ≤10k MAU | 24 h | 60 min | ✅ today (round 16) |
| **Production** 10k–500k MAU | 5 min (`archive_timeout=300s`) | 15-30 min | ⚠ scripts ready, needs operator to wire base-backup tool |
| **Enterprise** 500k+ MAU | 5 min | 5 min | ❌ requires multi-AZ streaming + automated failover (own program) |

**Important honesty:** the production-tier RPO of 5 min is achievable
**only** when the operator also runs a physical base backup tool
(`pg_basebackup`, managed-Postgres snapshot, or pgBackRest). The scripts
shipped in this round handle the WAL stream; the base backup is the
operator's choice based on their DB hosting model. We do NOT claim
production-ready PITR until both halves are wired.

## Files changed

### New (api)

```
apps/api/src/modules/auth-security/email-template.service.ts
apps/api/src/modules/auth-security/email-template.service.spec.ts
apps/api/src/modules/auth-security/email-provider.spec.ts
```

### Modified (api)

```
apps/api/src/config/env.validation.ts
  + EMAIL_PROVIDER (console|smtp)
  + SMTP_HOST/PORT/SECURE/USER/PASS/FROM
  + APP_PUBLIC_URL
  + production-only fail-fast: smtp branch requires all SMTP_* + APP_PUBLIC_URL

apps/api/src/modules/auth-security/email-provider.ts
  - SmtpEmailProvider was a skeleton that threw "not implemented"
  + nodemailer transport with pool=1, 10s timeouts, redacted logs

apps/api/src/modules/auth-security/auth-security.module.ts
  - factory keyed on SMTP_HOST presence
  + factory keyed on EMAIL_PROVIDER value
  + EmailTemplateService provider + export

apps/api/src/modules/auth-security/email-verification.service.ts
  + EmailTemplateService dep + render('verify-email', ...) instead of inline string
  + try/catch around send so SMTP failure doesn't 5xx (token already persisted)

apps/api/src/modules/auth-security/password-reset.service.ts
  + same template wiring + same fail-soft on send

apps/api/src/modules/auth-security/email-verification.service.spec.ts
apps/api/src/modules/auth-security/password-reset.service.spec.ts
  + EmailTemplateService injected into mock constructor
  + userProfile.findUnique stub on prisma mock

apps/api/package.json
  + "nodemailer": "^6.10.1"
  + "@types/nodemailer": "^6.4.23" (devDep)
```

### New (scripts)

```
scripts/archive-wal.sh
scripts/wal-archive-healthcheck.sh
```

### New (docs)

```
docs/WAL_ARCHIVING.md
docs/PITR_RESTORE.md
docs/EMAIL_DELIVERY.md
docs/ROUND_17_WAL_SMTP_COMPLETION.md   (this file)
```

### Modified (docs + config)

```
docs/AUTH_SECURITY.md           — SMTP is no longer skeleton
docs/BACKUP_RESTORE_DRILL.md    — production-tier WAL paragraph updated
docs/DISASTER_RECOVERY_RUNBOOK.md — PITR section added
docs/PRODUCTION_RUNBOOK.md      — sister-doc list expanded
docs/PRODUCTION_DASHBOARDS.md   — round-17 alert table added
docs/FULL_PROJECT_COMPLETION_ENTERPRISE_AUDIT.md — round-17 patch
.env.production.example         — EMAIL_PROVIDER + SMTP_* renamed; WAL_* added
docker-compose.production.yml   — SMTP env names match nodemailer convention
```

## Quality gate

- `npm run typecheck` (api) — clean
- `npm test` (api) — **43 suites / 229 tests pass** (217 round-16 baseline +
  12 new round-17 tests covering EmailTemplateService + SmtpEmailProvider
  config validation + redactAddress)
- `bash -n` on every new shell script — clean
- `archive-wal.sh` smoke-tested with synthetic 16 MiB WAL → encrypted to
  `.enc` + `.ok` marker created; duplicate-run with a different key
  correctly skipped (idempotency works)
- `wal-archive-healthcheck.sh` exit-code paths verified:
  - exit 1 (stale) when newest .enc is 2 h old + `MAX_AGE_MINUTES=1`
  - exit 2 (backlog) when 60 .enc files lack `.ok` markers + `ALERT_BACKLOG=10`
  - exit 0 (healthy) when fresh + no backlog
- No raw token / password / SMTP_PASS / verification link logged anywhere
- Round 11 (request-id) / round 12 (queue + AI ledger) / round 13 (finance
  correctness) / round 14 (auth lockout + email verification) / round 16
  (encrypted backups + tiered retention) all unaffected

## Audit readiness updates

| Capability | Round-17 readiness |
|--|--|
| WAL archiving (docs) | ✅ shipped |
| WAL archiving (local script) | ✅ shipped + smoke-tested |
| WAL archiving (S3 skeleton) | ✅ shipped (S3 path is real code; needs operator credentials to test live) |
| WAL archiving (production-ready end-to-end PITR) | ⚠ requires operator-chosen base-backup tool |
| SMTP provider (console / dev) | ✅ shipped |
| SMTP provider (smtp / prod) | ✅ shipped (real nodemailer; needs operator SMTP credentials) |
| Email templates (vi / en) | ✅ shipped (verify-email, reset-password, security-alert) |
| Email failure metric | ❌ round-18 backlog |
| Multi-AZ replication | ❌ enterprise-tier program |

We do NOT claim enterprise readiness — that requires multi-AZ streaming
replication + automated failover + cross-region async replica, which is its
own program. Production tier (10k–500k MAU) is now reachable once the
operator wires a base-backup tool.

## How to use the new pieces (operator quickstart)

### Switch to SMTP

1. Install your SMTP provider (Postmark, SES, Mailgun, self-hosted).
2. Set in `.env.production`:
   ```
   EMAIL_PROVIDER=smtp
   SMTP_HOST=smtp.example.com
   SMTP_PORT=587
   SMTP_SECURE=false
   SMTP_USER=...
   SMTP_PASS=<secret>
   SMTP_FROM="LifeOS AI <noreply@example.com>"
   APP_PUBLIC_URL=https://app.example.com
   ```
3. `./scripts/prod-deploy.sh` — env validation refuses to start if any of
   the above is missing.

### Enable WAL archiving (Mode B)

1. Pick your base-backup tool (`pg_basebackup` / managed snapshot / pgBackRest).
2. Generate a new `BACKUP_ENCRYPTION_KEY` (or reuse — we domain-separate
   only when rotating).
3. Set in `postgresql.conf`:
   ```
   wal_level = replica
   archive_mode = on
   archive_command = '/opt/lifeos/scripts/archive-wal.sh "%p" "%f"'
   archive_timeout = 300s
   ```
4. Restart Postgres.
5. Cron the healthcheck:
   ```
   */1 * * * * lifeos /opt/lifeos/scripts/wal-archive-healthcheck.sh \
     >> /var/log/lifeos-wal-health.log 2>&1
   ```
6. Take your first base backup; document its location alongside your
   nightly logical dumps so the next on-call knows both halves exist.

## Round-18 backlog

- Email send failure metric (`lifeos_email_send_failed_total`)
- WAL archive age metric (`lifeos_wal_archive_age_seconds`)
- Backup age metric (`lifeos_backup_age_seconds`)
- pgBackRest reference setup for self-managed Mode B
- Multi-AZ streaming replica (enterprise tier — separate program)
- Email-verification banner UI in mobile (i18n keys ready since round 14)
- OTel SDK wiring (env hooks declared in round 12)
- GDPR purge admin job
- k8s manifests for worker-only deployment topology
