-- CreateEnum
CREATE TYPE "SuggestedActionType" AS ENUM ('ADD_TASK', 'ADD_EXPENSE', 'ADD_INCOME', 'ADD_MEAL_LOG', 'ADD_SLEEP_LOG', 'ADD_MOOD_LOG', 'CREATE_REMINDER', 'GENERATE_SCHEDULE', 'RESCHEDULE_TODAY', 'SAVE_MEMORY', 'ASK_FOLLOWUP');

-- CreateEnum
CREATE TYPE "SuggestedActionStatus" AS ENUM ('PENDING', 'CONFIRMED', 'REJECTED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "VoiceCaptureSource" AS ENUM ('PUSH_TO_TALK', 'QUICK_NOTE', 'OS_SHORTCUT', 'TEXT_FALLBACK');

-- CreateEnum
CREATE TYPE "HealthIntegrationProvider" AS ENUM ('NONE', 'HEALTHKIT', 'HEALTH_CONNECT');

-- CreateTable
CREATE TABLE "smart_checkin_settings" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "morningCheckinEnabled" BOOLEAN NOT NULL DEFAULT true,
    "mealCheckinEnabled" BOOLEAN NOT NULL DEFAULT true,
    "eveningReviewEnabled" BOOLEAN NOT NULL DEFAULT true,
    "sleepReminderEnabled" BOOLEAN NOT NULL DEFAULT true,
    "financeCheckinEnabled" BOOLEAN NOT NULL DEFAULT true,
    "morningTime" TEXT NOT NULL DEFAULT '07:30',
    "eveningTime" TEXT NOT NULL DEFAULT '21:00',
    "sleepReminderTime" TEXT NOT NULL DEFAULT '22:30',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "smart_checkin_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "voice_captures" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "source" "VoiceCaptureSource" NOT NULL DEFAULT 'PUSH_TO_TALK',
    "locale" TEXT NOT NULL DEFAULT 'vi',
    "transcript" TEXT NOT NULL,
    "parsedJson" JSONB,
    "appliedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "voice_captures_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "suggested_actions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "voiceCaptureId" TEXT,
    "type" "SuggestedActionType" NOT NULL,
    "title" TEXT NOT NULL,
    "locale" TEXT NOT NULL DEFAULT 'vi',
    "confidence" DOUBLE PRECISION,
    "payload" JSONB NOT NULL,
    "status" "SuggestedActionStatus" NOT NULL DEFAULT 'PENDING',
    "expiresAt" TIMESTAMP(3),
    "appliedRefId" TEXT,
    "appliedRefKind" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "suggested_actions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "health_integration_settings" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" "HealthIntegrationProvider" NOT NULL DEFAULT 'NONE',
    "readSleep" BOOLEAN NOT NULL DEFAULT false,
    "readSteps" BOOLEAN NOT NULL DEFAULT false,
    "readExercise" BOOLEAN NOT NULL DEFAULT false,
    "readHeartRate" BOOLEAN NOT NULL DEFAULT false,
    "readWeight" BOOLEAN NOT NULL DEFAULT false,
    "lastSyncedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "health_integration_settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "smart_checkin_settings_userId_key" ON "smart_checkin_settings"("userId");

-- CreateIndex
CREATE INDEX "voice_captures_userId_createdAt_idx" ON "voice_captures"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "suggested_actions_userId_status_idx" ON "suggested_actions"("userId", "status");

-- CreateIndex
CREATE INDEX "suggested_actions_userId_createdAt_idx" ON "suggested_actions"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "health_integration_settings_userId_key" ON "health_integration_settings"("userId");

-- AddForeignKey
ALTER TABLE "smart_checkin_settings" ADD CONSTRAINT "smart_checkin_settings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "voice_captures" ADD CONSTRAINT "voice_captures_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "suggested_actions" ADD CONSTRAINT "suggested_actions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "suggested_actions" ADD CONSTRAINT "suggested_actions_voiceCaptureId_fkey" FOREIGN KEY ("voiceCaptureId") REFERENCES "voice_captures"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "health_integration_settings" ADD CONSTRAINT "health_integration_settings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
