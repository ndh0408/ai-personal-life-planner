-- CreateEnum
CREATE TYPE "AiUsagePlan" AS ENUM ('FREE', 'PRO', 'ADMIN');

-- CreateEnum
CREATE TYPE "AiFeature" AS ENUM ('CHAT', 'GENERATE_SCHEDULE', 'RESCHEDULE', 'SUGGEST_MEALS', 'ANALYZE_FINANCE', 'DAILY_REVIEW', 'WEEKLY_INSIGHT', 'ASSISTANT_MONITOR', 'QUICK_CAPTURE', 'HEALTH_SCREEN');

-- AlterTable
ALTER TABLE "notification_logs" ADD COLUMN     "attempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "idempotencyKey" TEXT;

-- CreateTable
CREATE TABLE "ai_usage_logs" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "feature" "AiFeature" NOT NULL,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "requestId" TEXT,
    "inputTokens" INTEGER,
    "outputTokens" INTEGER,
    "totalTokens" INTEGER,
    "estimatedCostMicroUsd" INTEGER,
    "success" BOOLEAN NOT NULL,
    "errorCode" TEXT,
    "latencyMs" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_usage_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_usage_quotas" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "plan" "AiUsagePlan" NOT NULL DEFAULT 'FREE',
    "dailyChatLimit" INTEGER NOT NULL DEFAULT 40,
    "dailyScheduleLimit" INTEGER NOT NULL DEFAULT 10,
    "dailyFinanceAnalysisLimit" INTEGER NOT NULL DEFAULT 10,
    "dailyMealSuggestionLimit" INTEGER NOT NULL DEFAULT 10,
    "dailyAssistantMonitoringLimit" INTEGER NOT NULL DEFAULT 20,
    "dailyReportLimit" INTEGER NOT NULL DEFAULT 20,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_usage_quotas_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ai_usage_logs_userId_createdAt_idx" ON "ai_usage_logs"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "ai_usage_logs_userId_feature_createdAt_idx" ON "ai_usage_logs"("userId", "feature", "createdAt");

-- CreateIndex
CREATE INDEX "ai_usage_logs_createdAt_idx" ON "ai_usage_logs"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ai_usage_quotas_userId_key" ON "ai_usage_quotas"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "notification_logs_userId_idempotencyKey_key" ON "notification_logs"("userId", "idempotencyKey");

-- AddForeignKey
ALTER TABLE "ai_usage_logs" ADD CONSTRAINT "ai_usage_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_usage_quotas" ADD CONSTRAINT "ai_usage_quotas_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

