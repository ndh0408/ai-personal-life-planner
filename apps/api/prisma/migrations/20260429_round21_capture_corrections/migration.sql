-- Round 21: Smart Capture parse provenance + correction memory.
--
-- The QuickCapture row stops being a thin "we wrote a thing" audit and
-- becomes the durable record of how a sentence was understood, what was
-- written from it, and what (if anything) the user changed before
-- confirming. CaptureCorrection feeds those edits back into the LLM as
-- few-shot examples so misparses self-correct over time.

CREATE TYPE "CaptureParseSource" AS ENUM ('RULE', 'LLM', 'HYBRID', 'MANUAL');

ALTER TABLE "QuickCapture"
  ADD COLUMN IF NOT EXISTS "parseSource"       "CaptureParseSource",
  ADD COLUMN IF NOT EXISTS "parseConfidence"   DECIMAL(5,4),
  ADD COLUMN IF NOT EXISTS "parseNeedsReview"  BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "parsedKind"        TEXT,
  ADD COLUMN IF NOT EXISTS "parsedPayload"     JSONB,
  ADD COLUMN IF NOT EXISTS "finalKind"         TEXT,
  ADD COLUMN IF NOT EXISTS "finalPayload"      JSONB,
  ADD COLUMN IF NOT EXISTS "appliedEntityType" TEXT,
  ADD COLUMN IF NOT EXISTS "appliedEntityId"   TEXT,
  ADD COLUMN IF NOT EXISTS "appliedAt"         TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "undoneAt"          TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "undoReason"        TEXT,
  ADD COLUMN IF NOT EXISTS "correctionCount"   INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "reviewedAt"        TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "QuickCapture_userId_createdAt_idx"
  ON "QuickCapture" ("userId", "createdAt" DESC);

CREATE INDEX IF NOT EXISTS "QuickCapture_userId_appliedAt_idx"
  ON "QuickCapture" ("userId", "appliedAt" DESC);

CREATE INDEX IF NOT EXISTS "QuickCapture_userId_parseNeedsReview_createdAt_idx"
  ON "QuickCapture" ("userId", "parseNeedsReview", "createdAt" DESC);

CREATE TABLE IF NOT EXISTS "CaptureCorrection" (
  "id"                 TEXT PRIMARY KEY,
  "userId"             TEXT NOT NULL,
  "quickCaptureId"     TEXT NOT NULL REFERENCES "QuickCapture"("id") ON DELETE CASCADE,
  "rawText"            TEXT NOT NULL,
  "originalSource"     "CaptureParseSource" NOT NULL,
  "originalKind"       TEXT,
  "originalConfidence" DECIMAL(5,4),
  "originalPayload"    JSONB,
  "correctedKind"      TEXT,
  "correctedPayload"   JSONB,
  "confirmed"          BOOLEAN NOT NULL DEFAULT true,
  "createdAt"          TIMESTAMP(3) NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "CaptureCorrection_userId_createdAt_idx"
  ON "CaptureCorrection" ("userId", "createdAt" DESC);

CREATE INDEX IF NOT EXISTS "CaptureCorrection_quickCaptureId_idx"
  ON "CaptureCorrection" ("quickCaptureId");

-- A user must never accidentally end up with two default wallets — the
-- "default wallet" lookup is a single findFirst on isDefault=true and we
-- can't have it return non-deterministically.
CREATE UNIQUE INDEX IF NOT EXISTS "Wallet_userId_one_default_idx"
  ON "Wallet" ("userId")
  WHERE "isDefault" = true AND "deletedAt" IS NULL;
