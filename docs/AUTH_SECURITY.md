# Auth Security

This doc covers the auth-security primitives shipped in Round 14.

## Per-account login lockout

Implemented in `AuthService.login` (`apps/api/src/modules/auth/auth.service.ts`).

- Threshold: **5 failed attempts inside a 15-minute window** locks the account
  for **15 minutes**.
- Window is sliding: `failedLoginCount` resets to 1 if the prior failure was
  outside the window.
- A successful login resets `failedLoginCount` and `lockedUntil`.
- Locked-account attempts return `errorCode: ACCOUNT_TEMPORARILY_LOCKED` +
  `retryAfterSec` in the response body.

### No-enumeration timing

The login path always runs a bcrypt compare (against either the user's real
hash or `DUMMY_HASH`) so a "wrong email" response has the same wall-clock
latency as a "wrong password" response. Combined with identical error
envelopes, this defeats email-enumeration attacks via timing.

### Audit trail

Every auth-relevant event is appended to `security_audit_logs` via
`SecurityAuditService.record()`:

- `LOGIN_FAILED` (with `metadata: { reason }` for unknown_email vs
  account_disabled vs wrong_password)
- `ACCOUNT_LOCKED`
- `LOGIN_SUCCESS_AFTER_FAILURE` (only when the user had pending failures)
- `PASSWORD_RESET_REQUESTED` / `PASSWORD_RESET_COMPLETED`
- `EMAIL_VERIFICATION_REQUESTED` / `EMAIL_VERIFICATION_COMPLETED`

The log row stores `userId` (when matched), lower-cased `emailHint`, IP, UA,
and a small JSON `metadata`. **Never** the password, never the raw token.

## Email verification

Endpoints (apps/api/src/modules/auth-security/auth-security.controller.ts):

- `POST /api/auth/resend-verification` — body: `{ email }`. Always returns
  202 (no enumeration).
- `POST /api/auth/verify-email` — body: `{ token }`. Sets
  `User.emailVerifiedAt` + marks the token used.

Token model: `EmailVerificationToken` with `tokenHash` (sha256 hex) and
`expiresAt` (24h TTL by default). Per-user resend throttle: at most one new
token every 60s.

## Forgot password / reset

Endpoints:

- `POST /api/auth/forgot-password` — body: `{ email }`. 202 always.
- `POST /api/auth/reset-password` — body: `{ token, password }`. Inside one
  transaction: validates token + policy → bcrypts new password → updates
  `User.passwordHash` → marks token used → revokes every refresh token of
  the user (forces re-login on every device) → clears lockout state.

Token TTL: 30 minutes. Per-user resend throttle: 60s.

Password policy: 8–128 chars, at least one letter and one digit (Zod schema
on the controller + duplicate check in `PasswordResetService.reset` so a
direct service call still gets the policy).

## EmailProvider abstraction

`EmailProvider` (`apps/api/src/modules/auth-security/email-provider.ts`)
is the transport interface. Two implementations ship today:

- `ConsoleEmailProvider` — default. Logs only the recipient, subject, and
  first 120 chars of the body so even verbose dev logs never leak the link.
- `SmtpEmailProvider` — production. Round-17 wired the nodemailer transport
  with pool=1, 10s socket/connect timeout, redacted logs (no body, no
  password). Selected by env `EMAIL_PROVIDER=smtp`.

Required env to switch to SMTP in production:
```
EMAIL_PROVIDER=smtp
SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER, SMTP_PASS, SMTP_FROM
APP_PUBLIC_URL              # used to build the verify/reset link
```

Production env validation (`apps/api/src/config/env.validation.ts`)
**refuses to start** when `EMAIL_PROVIDER=smtp` and any of those are
missing. Full operational details in `docs/EMAIL_DELIVERY.md`.

The console provider is acceptable for local dev. For staging + production,
flip to `EMAIL_PROVIDER=smtp` and wire a transactional provider (any SMTP
endpoint works — Postmark, SES, Mailgun, self-hosted).

## Mobile UX

Round 14 added the screens (`apps/mobile/src/screens/auth/`):

- `ForgotPasswordScreen` (deep-linked from Login → "Forgot password?")
- `ResetPasswordScreen` (token can come from `route.params.token` for deep
  links; otherwise the user pastes it from the email)

The verify-email banner contract is in `apps/mobile/src/i18n/locales/*.json`
under `auth.verifyEmail.*`; renderer integration is left to the next mobile
round.
