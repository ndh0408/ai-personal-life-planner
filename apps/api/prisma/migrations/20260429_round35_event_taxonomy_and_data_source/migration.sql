-- Round 35: passive intelligence schema additions.
--
-- 1. DataSource enum on every datum that can be passively logged
--    (sleep, mood, meal). MANUAL keeps existing rows behaving the same;
--    DEVICE / INFERRED let the sync job + inference fallback tag rows
--    without colliding with user-typed entries.
-- 2. SleepLog gains deviceRecordId so the sync job can dedupe Health
--    Connect / HealthKit samples on retry.
-- 3. New cursor + heart-rate + activity tables — small, append-only,
--    indexed by (userId, time).

CREATE TYPE "DataSource" AS ENUM ('MANUAL', 'DEVICE', 'INFERRED');

ALTER TABLE "SleepLog"
  ADD COLUMN IF NOT EXISTS "source"         "DataSource" NOT NULL DEFAULT 'MANUAL',
  ADD COLUMN IF NOT EXISTS "deviceRecordId" TEXT;

CREATE INDEX IF NOT EXISTS "SleepLog_userId_source_sleepAt_idx"
  ON "SleepLog" ("userId", "source", "sleepAt");

ALTER TABLE "MoodLog"
  ADD COLUMN IF NOT EXISTS "source" "DataSource" NOT NULL DEFAULT 'MANUAL';

ALTER TABLE "MealLog"
  ADD COLUMN IF NOT EXISTS "source" "DataSource" NOT NULL DEFAULT 'MANUAL';

CREATE TABLE IF NOT EXISTS "DeviceSyncCursor" (
  "id"           TEXT PRIMARY KEY,
  "userId"       TEXT NOT NULL,
  "source"       TEXT NOT NULL,
  "lastSyncedAt" TIMESTAMP(3) NOT NULL,
  "meta"         JSONB,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT NOW(),
  "updatedAt"    TIMESTAMP(3) NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS "DeviceSyncCursor_userId_source_key"
  ON "DeviceSyncCursor" ("userId", "source");
CREATE INDEX IF NOT EXISTS "DeviceSyncCursor_userId_idx"
  ON "DeviceSyncCursor" ("userId");

CREATE TABLE IF NOT EXISTS "HeartRateSample" (
  "id"             TEXT PRIMARY KEY,
  "userId"         TEXT NOT NULL,
  "bucketStart"    TIMESTAMP(3) NOT NULL,
  "avgBpm"         INTEGER NOT NULL,
  "maxBpm"         INTEGER NOT NULL,
  "source"         "DataSource" NOT NULL DEFAULT 'DEVICE',
  "deviceRecordId" TEXT,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS "HeartRateSample_userId_bucketStart_key"
  ON "HeartRateSample" ("userId", "bucketStart");
CREATE INDEX IF NOT EXISTS "HeartRateSample_userId_bucketStart_idx"
  ON "HeartRateSample" ("userId", "bucketStart");

CREATE TABLE IF NOT EXISTS "ActivitySample" (
  "id"          TEXT PRIMARY KEY,
  "userId"      TEXT NOT NULL,
  "bucketStart" TIMESTAMP(3) NOT NULL,
  "steps"       INTEGER NOT NULL DEFAULT 0,
  "appMinutes"  INTEGER NOT NULL DEFAULT 0,
  "source"      "DataSource" NOT NULL DEFAULT 'INFERRED',
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS "ActivitySample_userId_bucketStart_key"
  ON "ActivitySample" ("userId", "bucketStart");
CREATE INDEX IF NOT EXISTS "ActivitySample_userId_bucketStart_idx"
  ON "ActivitySample" ("userId", "bucketStart");
