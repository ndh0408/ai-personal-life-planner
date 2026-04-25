-- CreateEnum
CREATE TYPE "SensitiveDataType" AS ENUM ('SCHEDULE', 'TASKS', 'HABITS', 'MEALS', 'HEALTH', 'FINANCE', 'GOALS', 'CALENDAR', 'LOCATION', 'HEALTH_FITNESS');

-- CreateEnum
CREATE TYPE "AiMemoryType" AS ENUM ('PREFERENCE', 'PATTERN', 'GOAL', 'ROUTINE', 'WARNING', 'OTHER');

-- AlterTable
ALTER TABLE "privacy_settings" ADD COLUMN     "useGoalsForAI" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "useHabitsForAI" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "useMealsForAI" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "useTasksForAI" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "sensitive_access_logs" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "dataType" "SensitiveDataType" NOT NULL,
    "purpose" TEXT NOT NULL,
    "accessedBy" TEXT NOT NULL,
    "sourceFeature" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sensitive_access_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recommendation_evidences" (
    "id" TEXT NOT NULL,
    "recommendationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "dataType" "SensitiveDataType" NOT NULL,
    "summary" TEXT NOT NULL,
    "locale" TEXT NOT NULL DEFAULT 'vi',
    "weight" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "recommendation_evidences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_personalization_memories" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "memoryType" "AiMemoryType" NOT NULL,
    "content" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_personalization_memories_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "sensitive_access_logs_userId_createdAt_idx" ON "sensitive_access_logs"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "sensitive_access_logs_userId_dataType_idx" ON "sensitive_access_logs"("userId", "dataType");

-- CreateIndex
CREATE INDEX "recommendation_evidences_recommendationId_idx" ON "recommendation_evidences"("recommendationId");

-- CreateIndex
CREATE INDEX "recommendation_evidences_userId_createdAt_idx" ON "recommendation_evidences"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "ai_personalization_memories_userId_isActive_idx" ON "ai_personalization_memories"("userId", "isActive");

-- CreateIndex
CREATE INDEX "ai_personalization_memories_userId_memoryType_idx" ON "ai_personalization_memories"("userId", "memoryType");

-- AddForeignKey
ALTER TABLE "sensitive_access_logs" ADD CONSTRAINT "sensitive_access_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recommendation_evidences" ADD CONSTRAINT "recommendation_evidences_recommendationId_fkey" FOREIGN KEY ("recommendationId") REFERENCES "ai_recommendations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recommendation_evidences" ADD CONSTRAINT "recommendation_evidences_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_personalization_memories" ADD CONSTRAINT "ai_personalization_memories_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
