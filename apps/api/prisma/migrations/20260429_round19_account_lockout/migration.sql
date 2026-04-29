-- Round 19: per-account brute-force defence.
-- IP-based throttling alone is insufficient against credential stuffing /
-- password spraying (OWASP). Track failures on the User row so a successful
-- login can reset the counter and an attacker can't bypass throttling by
-- rotating IPs.

ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "failedLoginCount"  INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "lastFailedLoginAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "lockUntil"         TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "lastLoginAt"       TIMESTAMP(3);
