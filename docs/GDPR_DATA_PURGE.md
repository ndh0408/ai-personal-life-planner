# GDPR Data Purge — Operator Runbook

Round-18 added an admin-only data purge endpoint for handling user-data
deletion requests (GDPR Art. 17, CCPA, equivalent). This doc covers the
process, the data-retention policy, and the safeguards.

> **Audience:** Compliance + Backend on-call.
> **Sister docs:** `docs/AUTH_SECURITY.md` (admin role), Privacy Center
> docs (self-serve account deletion).

## Data-retention policy at purge time

| Category | Action | Rationale |
|--|--|--|
| User profile, email, displayName, avatar | **DELETE** | PII the user is asking to erase |
| Schedules, tasks, habits, mood/sleep/health logs | **DELETE** | User-owned content |
| Wallets, incomes, expenses, budgets, debts, saving goals | **DELETE** | User-owned finance data |
| AI messages, AI recommendations, AI memory | **DELETE** | User-owned + may contain PII |
| Notifications, devices, push tokens | **DELETE** | User-owned |
| Connected accounts (OAuth tokens) | **DELETE** | User credentials |
| User AI providers (BYOK encrypted keys) | **DELETE** | User credentials |
| **FinanceAuditLog** | **DELETE (cascade)** | GDPR favours erase-more-retain-less |
| **SecurityAuditLog** | **ANONYMISE** (`userId=NULL`, `emailHint=NULL`) | Cross-user forensics need the trail; identity is what we erase |

The choice to delete vs anonymise is auditable: the round-18 service
emits a `SecurityAuditLog` with `metadata.action='GDPR_PURGE_INITIATED'`
BEFORE the delete + `metadata.action='GDPR_PURGE_COMPLETED'` AFTER, both
under the acting admin's id. So even after the target user is gone, an
auditor can query "what purges did admin X perform?".

## Safeguards (enforced by `DataPurgeService`)

1. **Confirmation string required** — the operator must echo
   `"I UNDERSTAND THIS IS IRREVERSIBLE"` exactly. Typos refuse with
   `errorCode: PURGE_CONFIRMATION_REQUIRED`.
2. **No self-purge** — `targetUserId === actingAdminId` refuses with
   `PURGE_SELF_FORBIDDEN`. Use the self-serve account-deletion endpoint
   (`POST /api/privacy/delete-account-request`) for your own account.
3. **No admin purge via API** — `target.role === 'ADMIN'` refuses with
   `PURGE_ADMIN_FORBIDDEN`. Demote the admin role in psql first, then
   purge.
4. **Dry-run by default** — every operational playbook calls dry-run
   first to see the row counts that will be touched.
5. **Throttled at 5/min/IP** — purges should be rare; bursts signal an
   automation we don't expect.
6. **`AdminGuard` re-fetches role from DB** — JWT carries only `sub`;
   the role is checked against the live row so a freshly-demoted ex-admin
   can't act on a stale token.

## The endpoint

```
POST /api/admin/users/:id/purge-data
Authorization: Bearer <admin JWT>
Content-Type: application/json

{
  "confirmation": "I UNDERSTAND THIS IS IRREVERSIBLE",
  "dryRun": true
}
```

Successful dry-run response:

```json
{
  "success": true,
  "message": "Dry-run complete",
  "data": {
    "dryRun": true,
    "targetUserId": "...",
    "counts": {
      "schedules": 1,
      "tasks": 7,
      "habits": 3,
      "wallets": 2,
      "incomes": 12,
      "expenses": 158,
      "budgets": 4,
      "debts": 1,
      "savingGoals": 2,
      "personalGoals": 5,
      "aiMessages": 423,
      "aiRecommendations": 19,
      "notifLogs": 87,
      "connectedAccounts": 1,
      "userAiProviders": 1,
      "financeAuditLogsAnonymised": 200,
      "securityAuditLogsAnonymised": 6
    }
  }
}
```

(Note: round-18 deletes finance audit logs via cascade rather than
anonymising — the field name is kept for symmetry with the security
audit log path.)

## Operational playbook

```bash
# 0. Receive a verified GDPR delete request via your support channel.
#    Verify the requester owns the email (out of scope for this doc).

# 1. Identify the target user.
psql ... -c "SELECT id, email, role, status FROM users WHERE email = $1;"

# 2. If role=ADMIN, demote first:
psql ... -c "UPDATE users SET role='USER' WHERE id=$1;"

# 3. Dry-run.
ADMIN_TOKEN="..."
TARGET="..."
curl -X POST https://api.example.com/api/admin/users/$TARGET/purge-data \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"confirmation":"I UNDERSTAND THIS IS IRREVERSIBLE","dryRun":true}'

# 4. Compare the row counts with what you expected. If anything looks
#    surprising (e.g. 0 expenses for a known long-time user), STOP and
#    investigate — the target may not be who you think.

# 5. Real purge.
curl -X POST https://api.example.com/api/admin/users/$TARGET/purge-data \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"confirmation":"I UNDERSTAND THIS IS IRREVERSIBLE"}'

# 6. Verify the user row is gone.
psql ... -c "SELECT id FROM users WHERE id=$1;"   # → 0 rows

# 7. Document in your compliance log: timestamp, target id, admin id,
#    request reference number.
```

## What about backups?

This is the gnarly bit of GDPR. Encrypted backups taken BEFORE the purge
still contain the user's data. Two options:

1. **Wait out the retention window.** Round-16's tiered retention is
   daily=14d, weekly=8w, monthly=12m, so monthly backups can hold the data
   for up to a year. Document the SLA in your privacy policy ("we erase
   on request; backup copies expire within 12 months").
2. **Cycle backups manually.** Take a fresh post-purge backup, then
   delete the older monthly archives that contained the user. Heavy on
   ops; usually overkill unless legally required.

Pick option 1 unless your jurisdiction's regulator requires option 2.

## What about analytics / aggregations?

If you've materialised aggregates (e.g. `FinancialSnapshot.totalIncome`)
that were derived from the purged user's data, those rows go too via
cascade. If you've exported aggregates to a BI tool, that's outside this
service's scope — the operator must purge those separately and document
the procedure.

## What this is NOT

- An "undo my last 7 days" button. The purge is hard delete.
- A self-serve flow. That's `POST /api/privacy/delete-account-request`
  in the Privacy module.
- A way to anonymise a user while keeping their content visible to
  others. (LifeOS is single-tenant per user — there's no shared content.)

## Round-19 backlog

- A cron job that auto-purges users whose `delete-account-request` is
  more than 30 days old (consent + grace period workflow).
- A signed export of the user's data BEFORE purge so they have their
  history if they want it (GDPR Art. 20 — data portability is a separate
  endpoint today).
