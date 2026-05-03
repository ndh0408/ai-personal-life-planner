-- Round 40: macro privacy tier on PrivacySetting.
-- CLOUD = default; HYBRID/LOCAL require client-managed E2EE keys.
-- Storing as text + check constraint instead of a Postgres enum so the
-- shared @lifeos/taxonomy enum is the single source of truth.

ALTER TABLE "PrivacySetting"
  ADD COLUMN "tier" TEXT NOT NULL DEFAULT 'CLOUD',
  ADD COLUMN "e2eeKeyFingerprint" TEXT,
  ADD COLUMN "onDeviceLlmReady" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "PrivacySetting"
  ADD CONSTRAINT "PrivacySetting_tier_check"
  CHECK ("tier" IN ('CLOUD', 'HYBRID', 'LOCAL'));
