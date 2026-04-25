# Email Delivery — LifeOS AI

Round-17 wired the SMTP transport for verification + reset emails. This doc
covers the env contract, the template registry, and how the failure modes
are handled.

## Provider selection

`EMAIL_PROVIDER` env (validated by `apps/api/src/config/env.validation.ts`):

| Value | Behaviour | When to use |
|--|--|--|
| `console` | Logs `to=u***@host subject="…" preview="…"` only | Local dev, jest, smoke tests |
| `smtp` | Real send via nodemailer | Production / staging |

Production env validation **refuses to start** when `EMAIL_PROVIDER=smtp`
and any of `SMTP_HOST` / `SMTP_USER` / `SMTP_PASS` / `SMTP_FROM` /
`APP_PUBLIC_URL` is missing. This catches the operator who forgot half the
SMTP env at boot, not on the first user action.

## Env contract

```
EMAIL_PROVIDER=smtp                 # console | smtp
SMTP_HOST=smtp.example.com
SMTP_PORT=587                       # 465 for SMTPS, 587 for STARTTLS
SMTP_SECURE=false                   # true → use TLS on connect (port 465)
SMTP_USER=apikey                    # provider-specific (Postmark = literal "apikey")
SMTP_PASS=<secret>
SMTP_FROM="LifeOS AI <noreply@example.com>"
APP_PUBLIC_URL=https://app.example.com   # used to build verify/reset links
```

## Templates

`EmailTemplateService` (`apps/api/src/modules/auth-security/email-template.service.ts`)
ships three templates per locale:

| Key | Subject | Variables |
|--|--|--|
| `verify-email` | "Verify your LifeOS email" / "Xác minh email LifeOS" | `name`, `link`, `ttlHours` |
| `reset-password` | "Reset your LifeOS password" / "Đặt lại mật khẩu LifeOS" | `name`, `link`, `ttlMinutes` |
| `security-alert` | "LifeOS security alert" / "Cảnh báo bảo mật LifeOS" | `name`, `event`, `when` |

Locale comes from `UserProfile.locale` (vi or en). Missing locale defaults
to `vi`. Missing variables render as empty strings (we never crash on a
missing field).

Templates are plain text with `{{var}}` placeholders + a derived HTML body
(escaped + line-break → `<br>`). No template engine pulled in for one use
case.

## Logging contract (privacy)

The SMTP provider logs **only** these fields per send:

- `to=u***@example.com` (local-part redacted)
- `subject="..."`
- on failure: error class + first 200 chars of the error message (multi-line
  server responses truncated so SMTP `530 5.7.0 Auth …` exchanges can't
  echo credentials)

The provider NEVER logs:
- Full `text` / `html` body (contains the verification or reset URL)
- The raw token (it lives in the URL path, never in metadata)
- `SMTP_PASS`
- `SMTP_USER` (logged only as part of the redacted "ready" line at boot)

## Failure handling

When SMTP fails AFTER we've already persisted the verification or reset
token in Postgres, the caller (`EmailVerificationService.resend`,
`PasswordResetService.forgot`):

1. Logs a warn line with the error class only (no body).
2. **Does not throw** — we don't want a 5xx that leaks the email exists,
   and the user can hit "resend" to retry.

This means a complete SMTP outage causes user-facing degradation
("verification email never arrived") but does NOT cause API errors. Pair
with the alerting in `docs/PRODUCTION_DASHBOARDS.md` (round-17 backlog
for an `lifeos_email_send_failed_total` counter).

## Token never leaks to logs

- `generateAuthToken()` returns `{ raw, hash }` — only the hash is stored
  in the DB.
- The raw token only appears in the constructed URL passed to
  `EmailProvider.send()`.
- The provider's log-line preview is `text.split('\n').slice(0,2)` (subject
  line + greeting), which is BEFORE the line that contains the URL.

Verified by spec: `email-verification.service.spec.ts` asserts the stored
row has a 64-char hex `tokenHash` and no `token`/`raw` field.

## Switching transports

To swap nodemailer for a transactional API (Postmark, SES, Resend):

1. Implement a new class that satisfies the `EmailProvider` interface
   (`apps/api/src/modules/auth-security/email-provider.ts`).
2. Add it to `AuthSecurityModule.providers`.
3. Add a new `EMAIL_PROVIDER` enum value in `env.validation.ts` and update
   the factory to dispatch.

The interface is one method (`send(email: Email): Promise<void>`); a
Postmark adapter is ~30 lines.

## Local development

```
EMAIL_PROVIDER=console      # default; nothing to install
APP_PUBLIC_URL=http://localhost:3000
```

The console provider's log line includes a 120-char preview of the body so
you can see a "verify-email" was rendered, but you'll need to grab the
verification URL another way (e.g. directly from the
`email_verification_tokens` table — the raw token is NOT stored there, but
you can craft a new one via the `/auth/resend-verification` endpoint and
read the URL out of the API logs of the receiving service in dev).

For test (`NODE_ENV=test`), the spec files inject a stub `EmailProvider`
that captures sent emails into an in-memory array.

## Operational warnings

- **Don't bump `maxConnections`** above 1 unless you're sending >10 mails/s
  sustained. SMTP TLS handshake cost is high relative to send time, so the
  pool of one keeps a warm connection without opening N sockets.
- **Don't enable `SMTP_SECURE=true` on port 587.** That combination
  attempts to do TLS on connect, which port 587 expects to do via
  STARTTLS instead — the handshake will fail. Use `SMTP_SECURE=false`
  (default) for 587 and `true` for 465.
- **Don't send marketing email through this transport.** This is for
  transactional emails only. If/when you add marketing, wire it through a
  separate provider with its own env namespace and unsubscribe pipeline.
