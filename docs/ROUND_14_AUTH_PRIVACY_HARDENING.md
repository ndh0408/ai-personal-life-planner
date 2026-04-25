# Round 14 — Auth + Privacy + Backup Hardening

**Date:** 2026-04-25
**Goal:** close the round-13 backlog (per-account lockout, email verification,
forgot-password, encrypted off-box backups, soft delete on finance + tasks +
habits + goals, timezone-aware daily report bounds).

## Summary

| # | Item | Status |
|--|--|--|
| 1 | Per-account login lockout | **DONE** — 5 failures in 15min ⇒ 15min lock; AUDIT events; no-enumeration bcrypt timing |
| 2 | Email verification | **DONE** — `EmailVerificationToken` (sha256-hashed); resend + verify endpoints; 24h TTL; per-user resend throttle |
| 3 | Forgot + reset password | **DONE** — `PasswordResetToken` (sha256-hashed); 30min TTL; reset revokes ALL refresh tokens + clears lockout; password policy |
| 4 | Encrypted off-box backups | **DONE** — `backup-db-encrypted.sh` + `restore-db-encrypted.sh`; AES-256-CBC + PBKDF2 200k; optional S3 upload |
| 5 | Soft delete | **DONE** — `deletedAt` on Expense/Income/Wallet/Budget/Debt/SavingGoal/PersonalGoal/Task/Habit; finance reverses wallet on delete; restore endpoints for finance entities |
| 6 | Timezone-aware daily bounds | **DONE** — new `getUserDayBounds(date, tz)` helper; applied to reports.daily + dashboard.summary task windows (TIMESTAMP columns) |

## Quality gate

- `npm run typecheck` (api + mobile + shared) — **clean**
- `npm test` (api) — **41 suites / 217 tests pass** (190 baseline + 27 new round-14 tests covering lockout, token util, verification, reset, day-bounds, soft delete)
- 1 Prisma migration: `20260425170000_round_14_auth_privacy` (applied locally)
- i18n parity: **1352 ⇄ 1352** (added `auth.forgotPassword`, `auth.resetPassword`, `auth.verifyEmail`, 5 new error codes)
- No raw token / password / verification link logged anywhere
- No regression on round-11 (request-id), round-12 (queue + AI ledger), round-13 (finance correctness, audit trail) features

## Files changed

### New (apps/api)

```
prisma/migrations/20260425170000_round_14_auth_privacy/migration.sql

src/common/datetime/day-bounds.ts
src/common/datetime/day-bounds.spec.ts

src/modules/auth-security/security-audit.service.ts
src/modules/auth-security/email-provider.ts
src/modules/auth-security/auth-token.util.ts
src/modules/auth-security/auth-token.util.spec.ts
src/modules/auth-security/email-verification.service.ts
src/modules/auth-security/email-verification.service.spec.ts
src/modules/auth-security/password-reset.service.ts
src/modules/auth-security/password-reset.service.spec.ts
src/modules/auth-security/auth-security.controller.ts
src/modules/auth-security/auth-security.module.ts

src/modules/auth/auth.service.spec.ts
```

### Modified (apps/api)

```
prisma/schema.prisma
  + User.failedLoginCount, lastFailedLoginAt, lockedUntil, emailVerifiedAt
  + EmailVerificationToken, PasswordResetToken, SecurityAuditLog,
    SecurityEventType enum
  + deletedAt on Expense/Income/Wallet/Budget/Debt/SavingGoal/PersonalGoal/Task/Habit
  + (userId, deletedAt) compound index on each

src/app.module.ts
  + AuthSecurityModule (global)

src/modules/auth/auth.service.ts
  + per-account lockout flow + DUMMY_HASH timing defense
  + LOGIN_FAILED / ACCOUNT_LOCKED / LOGIN_SUCCESS_AFTER_FAILURE audit
  + dependency on SecurityAuditService

src/modules/expenses/{expenses.service.ts,expenses.controller.ts}
  + soft delete + restore (reverses wallet on both)

src/modules/incomes/{incomes.service.ts,incomes.controller.ts}
  + soft delete + restore

src/modules/wallets/{wallets.service.ts,wallets.controller.ts}
  + soft delete + restore

src/modules/budgets/budgets.service.ts
  + soft delete + deletedAt:null filter on usage aggregate

src/modules/debts/debts.service.ts
  + soft delete

src/modules/saving-goals/saving-goals.service.ts
  + soft delete

src/modules/tasks/tasks.service.ts
  + soft delete

src/modules/habits/habits.service.ts
  + soft delete

src/modules/goals/goals.service.ts
  + soft delete

src/modules/dashboard/dashboard.service.ts
  + deletedAt:null filter on every finance/task/habit aggregator
  + tz-aware window for task.dueDate (TIMESTAMP column)

src/modules/reports/reports.service.ts
  + deletedAt:null on every aggregator
  + tz-aware tzWindow for task.dueDate in daily()

src/modules/widgets/widget-summary.service.ts
  + deletedAt:null on tasks + finance aggregators

src/modules/expenses/expenses.service.spec.ts
  + soft-delete test, restore test, mock supports deletedAt
```

### New (apps/mobile)

```
src/screens/auth/ForgotPasswordScreen.tsx
src/screens/auth/ResetPasswordScreen.tsx
```

### Modified (apps/mobile)

```
src/navigation/AuthNavigator.tsx     + ForgotPassword + ResetPassword routes
src/navigation/types.ts              + AuthStackParamList entries
src/screens/auth/LoginScreen.tsx     + "Forgot password?" link
src/services/api/auth.api.ts         + resendVerification / verifyEmail / forgotPassword / resetPassword
src/i18n/locales/en.json             + 13 new keys
src/i18n/locales/vi.json             + 13 new keys
```

### New (scripts + docs)

```
scripts/backup-db-encrypted.sh
scripts/restore-db-encrypted.sh

docs/AUTH_SECURITY.md
docs/ENCRYPTED_BACKUPS.md
docs/BACKUP_RESTORE_DRILL.md
docs/ROUND_14_AUTH_PRIVACY_HARDENING.md
```

## Operational notes

- Production deploy must run `prisma migrate deploy` — adds 7 columns + 3
  tables + 9 compound indexes. All defaults (`failedLoginCount = 0`,
  `deletedAt = null`) are safe on existing rows.
- Console email provider is the default. Set `SMTP_HOST` (+ SMTP_PORT / etc)
  to switch to the SmtpEmailProvider — but note that the SMTP transport is
  a **skeleton** (throws `not implemented`); wire `nodemailer` before
  flipping the env var. See `docs/AUTH_SECURITY.md` for the env contract.
- Backup script needs `pg_dump`, `gzip`, `openssl`, and (for S3 upload) the
  `aws` CLI in the cron user's PATH. Validated by the script before any
  destructive step.
- Soft delete is **transparent to existing API consumers** — list/get
  responses look identical; only the absence of the deleted row signals the
  state change. The new `POST /api/{expenses,incomes,wallets}/:id/restore`
  endpoints let mobile undo a delete within the audit trail's retention.

## Remaining risks (round-15 backlog)

- **SMTP transport** — wire `nodemailer` (or swap to a transactional email
  API like Postmark / SES). Console provider is fine for pilot but blocks
  public launch.
- **WAL archiving** — `pg_dump` snapshots are point-in-snapshot; intra-day
  data loss is up to 24h. Configure `archive_command` + base-backup +
  point-in-time recovery for sub-hour RPO.
- **Hard-delete (GDPR purge) tooling** — soft-deleted rows still hold user
  data. Add an admin job to permanently purge rows where
  `deletedAt < now() - INTERVAL '90 days'` AND the user has a pending GDPR
  delete request.
- **Email verification gating** — endpoints exist; UX banner is documented
  but not yet rendered. Mobile follow-up: surface a non-blocking banner +
  optionally gate AI usage when `emailVerifiedAt IS NULL`.
- **OTel SDK** — env hooks declared in round 12; SDK wiring still pending.
