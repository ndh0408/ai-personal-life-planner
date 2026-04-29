-- AlterTable
ALTER TABLE "UserProfile" ADD COLUMN     "allergies" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "budgetMonthly" DECIMAL(18,2),
ADD COLUMN     "dislikes" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "monthlyGoal" TEXT,
ADD COLUMN     "workPattern" TEXT;

-- CreateTable
CREATE TABLE "UserBehaviorSummary" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "wakeHistogram" JSONB NOT NULL DEFAULT '[]',
    "sleepHistogram" JSONB NOT NULL DEFAULT '[]',
    "avgSleepByWeekday" JSONB NOT NULL DEFAULT '[]',
    "peakFocus" JSONB,
    "topExpenseCategories" JSONB NOT NULL DEFAULT '[]',
    "recentMealTitles" JSONB NOT NULL DEFAULT '[]',
    "moodSleepCorrelation" DOUBLE PRECISION,
    "taskCompletionByPrio" JSONB NOT NULL DEFAULT '{}',
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "eventsAtCompute" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "UserBehaviorSummary_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EventLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssistantMemory" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "fact" TEXT NOT NULL,
    "weight" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "kind" TEXT NOT NULL,
    "sourceConvId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AssistantMemory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UserBehaviorSummary_userId_key" ON "UserBehaviorSummary"("userId");

-- CreateIndex
CREATE INDEX "UserBehaviorSummary_userId_idx" ON "UserBehaviorSummary"("userId");

-- CreateIndex
CREATE INDEX "EventLog_userId_createdAt_idx" ON "EventLog"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "AssistantMemory_userId_weight_idx" ON "AssistantMemory"("userId", "weight");

-- AddForeignKey
ALTER TABLE "UserBehaviorSummary" ADD CONSTRAINT "UserBehaviorSummary_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventLog" ADD CONSTRAINT "EventLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssistantMemory" ADD CONSTRAINT "AssistantMemory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
