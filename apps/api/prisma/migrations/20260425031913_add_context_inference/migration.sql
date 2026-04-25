-- CreateEnum
CREATE TYPE "ContextSignalType" AS ENUM ('SLEEP_DURATION', 'SLEEP_TIME_NEAR', 'ENERGY_LOW', 'STRESS_HIGH', 'TASK_PENDING_LATE', 'TASK_OVERDUE', 'TASK_DEFERRED_REPEAT', 'HABIT_MISS', 'HABIT_BROKEN_STREAK', 'MEAL_OVERDUE', 'EXPENSE_VELOCITY_HIGH', 'BUDGET_USAGE_HIGH', 'CALENDAR_EARLY_TOMORROW', 'END_OF_DAY_NO_REVIEW');

-- CreateEnum
CREATE TYPE "ContextInferenceType" AS ENUM ('POSSIBLE_SLEEPINESS', 'WORKLOAD_OVERLOAD', 'MEAL_MAY_BE_SKIPPED', 'BUDGET_RISK', 'TASK_PROCRASTINATION_RISK', 'HABIT_DROP_RISK', 'LOW_ENERGY_DAY', 'NEED_REVIEW_DAY');

-- CreateEnum
CREATE TYPE "ContextInferenceStatus" AS ENUM ('NEW', 'VIEWED', 'DISMISSED', 'APPLIED');

-- CreateEnum
CREATE TYPE "UserPatternType" AS ENUM ('USUAL_SLEEP_TIME', 'USUAL_WAKE_TIME', 'USUAL_MEAL_TIME_BREAKFAST', 'USUAL_MEAL_TIME_LUNCH', 'USUAL_MEAL_TIME_DINNER', 'USUAL_HABIT_TIME', 'USUAL_PRODUCTIVE_HOURS', 'COMMON_OVERLOAD_DAYS', 'COMMON_SKIPPED_TASK_CATEGORY', 'AVG_DAILY_EXPENSE');

-- CreateTable
CREATE TABLE "context_signals" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "ContextSignalType" NOT NULL,
    "value" JSONB NOT NULL,
    "source" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "context_signals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "context_inferences" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "ContextInferenceType" NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "evidence" JSONB NOT NULL,
    "suggestedAction" JSONB,
    "status" "ContextInferenceStatus" NOT NULL DEFAULT 'NEW',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "context_inferences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_patterns" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "patternType" "UserPatternType" NOT NULL,
    "value" JSONB NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "lastObservedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_patterns_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "context_signals_userId_type_occurredAt_idx" ON "context_signals"("userId", "type", "occurredAt");

-- CreateIndex
CREATE INDEX "context_signals_userId_occurredAt_idx" ON "context_signals"("userId", "occurredAt");

-- CreateIndex
CREATE INDEX "context_inferences_userId_status_createdAt_idx" ON "context_inferences"("userId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "context_inferences_userId_type_createdAt_idx" ON "context_inferences"("userId", "type", "createdAt");

-- CreateIndex
CREATE INDEX "user_patterns_userId_idx" ON "user_patterns"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "user_patterns_userId_patternType_key" ON "user_patterns"("userId", "patternType");

-- AddForeignKey
ALTER TABLE "context_signals" ADD CONSTRAINT "context_signals_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "context_inferences" ADD CONSTRAINT "context_inferences_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_patterns" ADD CONSTRAINT "user_patterns_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
