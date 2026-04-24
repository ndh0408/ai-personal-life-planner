/*
  Warnings:

  - Changed the type of `type` on the `ai_recommendations` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- CreateEnum
CREATE TYPE "WalletType" AS ENUM ('CASH', 'BANK', 'EWALLET', 'SAVINGS', 'OTHER');

-- CreateEnum
CREATE TYPE "NeedLevel" AS ENUM ('NEED', 'WANT', 'WASTE', 'INVESTMENT', 'SAVING');

-- CreateEnum
CREATE TYPE "BudgetPeriod" AS ENUM ('WEEKLY', 'MONTHLY');

-- CreateEnum
CREATE TYPE "DebtType" AS ENUM ('I_OWE', 'OWED_TO_ME');

-- CreateEnum
CREATE TYPE "DebtStatus" AS ENUM ('ACTIVE', 'PAID', 'CANCELLED');

-- CreateEnum
CREATE TYPE "SavingGoalStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "GoalCategory" AS ENUM ('HEALTH', 'FINANCE', 'CAREER', 'STUDY', 'RELATIONSHIP', 'PERSONAL', 'OTHER');

-- CreateEnum
CREATE TYPE "PersonalGoalStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'PAUSED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "MilestoneStatus" AS ENUM ('TODO', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "AIRecommendationType" AS ENUM ('SCHEDULE', 'TASK', 'HABIT', 'MEAL', 'SLEEP', 'HEALTH', 'FINANCE', 'BUDGET', 'GOAL', 'GENERAL');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "MainGoal" ADD VALUE 'FINANCIAL_STABILITY';
ALTER TYPE "MainGoal" ADD VALUE 'CAREER_GROWTH';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ScheduleItemType" ADD VALUE 'FINANCE';
ALTER TYPE "ScheduleItemType" ADD VALUE 'HEALTH';
ALTER TYPE "ScheduleItemType" ADD VALUE 'PERSONAL';

-- AlterTable: migrate "type" from free-form text to AIRecommendationType enum.
-- Old seed used lowercase strings (e.g. 'sleep', 'task'); uppercase them in
-- place so the USING cast succeeds against the new enum. Unknown values fall
-- back to GENERAL so the migration never fails on bad data.
UPDATE "ai_recommendations"
SET "type" = CASE
  WHEN UPPER("type") IN ('SCHEDULE','TASK','HABIT','MEAL','SLEEP','HEALTH','FINANCE','BUDGET','GOAL','GENERAL')
    THEN UPPER("type")
  ELSE 'GENERAL'
END;
ALTER TABLE "ai_recommendations"
  ALTER COLUMN "type" TYPE "AIRecommendationType"
  USING "type"::text::"AIRecommendationType";

-- AlterTable
ALTER TABLE "notification_settings" ADD COLUMN     "assistantNudge" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "budgetAlert" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "financeReminder" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "goalReminder" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "user_profiles" ADD COLUMN     "currency" TEXT NOT NULL DEFAULT 'VND',
ADD COLUMN     "monthlySalary" DECIMAL(18,2),
ADD COLUMN     "salaryDay" INTEGER;

-- CreateTable
CREATE TABLE "meal_logs" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "mealType" "MealType" NOT NULL,
    "title" TEXT NOT NULL,
    "note" TEXT,
    "estimatedCalories" INTEGER,
    "cost" DECIMAL(18,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "meal_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "health_metrics" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "weightKg" DOUBLE PRECISION,
    "waterIntakeMl" INTEGER,
    "steps" INTEGER,
    "exerciseMinutes" INTEGER,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "health_metrics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wallets" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "WalletType" NOT NULL,
    "balance" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'VND',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "wallets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "incomes" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "walletId" TEXT,
    "title" TEXT NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "category" TEXT,
    "source" TEXT,
    "incomeDate" DATE NOT NULL,
    "isRecurring" BOOLEAN NOT NULL DEFAULT false,
    "recurringRule" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "incomes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "expenses" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "walletId" TEXT,
    "title" TEXT NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "category" TEXT NOT NULL,
    "expenseDate" DATE NOT NULL,
    "paymentMethod" TEXT,
    "needLevel" "NeedLevel",
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "expenses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "budgets" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "period" "BudgetPeriod" NOT NULL DEFAULT 'MONTHLY',
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "alertThresholdPercent" INTEGER NOT NULL DEFAULT 80,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "budgets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "debts" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "DebtType" NOT NULL,
    "personName" TEXT,
    "title" TEXT NOT NULL,
    "totalAmount" DECIMAL(18,2) NOT NULL,
    "paidAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "dueDate" DATE,
    "status" "DebtStatus" NOT NULL DEFAULT 'ACTIVE',
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "debts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "saving_goals" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "targetAmount" DECIMAL(18,2) NOT NULL,
    "currentAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "targetDate" DATE,
    "priority" "Priority" NOT NULL DEFAULT 'MEDIUM',
    "status" "SavingGoalStatus" NOT NULL DEFAULT 'ACTIVE',
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "saving_goals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "financial_snapshots" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "totalIncome" DECIMAL(18,2) NOT NULL,
    "totalExpense" DECIMAL(18,2) NOT NULL,
    "totalSaving" DECIMAL(18,2) NOT NULL,
    "debtRemaining" DECIMAL(18,2) NOT NULL,
    "budgetUsagePercent" DECIMAL(6,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "financial_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "personal_goals" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "category" "GoalCategory" NOT NULL,
    "targetValue" DOUBLE PRECISION,
    "currentValue" DOUBLE PRECISION,
    "unit" TEXT,
    "deadline" DATE,
    "priority" "Priority" NOT NULL DEFAULT 'MEDIUM',
    "status" "PersonalGoalStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "personal_goals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "goal_milestones" (
    "id" TEXT NOT NULL,
    "goalId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "targetDate" DATE,
    "completedAt" TIMESTAMP(3),
    "status" "MilestoneStatus" NOT NULL DEFAULT 'TODO',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "goal_milestones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "daily_reviews" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "summary" TEXT NOT NULL,
    "wins" JSONB,
    "issues" JSONB,
    "suggestions" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "daily_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "weekly_reviews" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "weekStart" DATE NOT NULL,
    "summary" TEXT NOT NULL,
    "scheduleInsight" TEXT,
    "taskInsight" TEXT,
    "habitInsight" TEXT,
    "healthInsight" TEXT,
    "mealInsight" TEXT,
    "financeInsight" TEXT,
    "goalInsight" TEXT,
    "suggestions" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "weekly_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "meal_logs_userId_date_idx" ON "meal_logs"("userId", "date");

-- CreateIndex
CREATE INDEX "meal_logs_userId_mealType_idx" ON "meal_logs"("userId", "mealType");

-- CreateIndex
CREATE INDEX "health_metrics_userId_date_idx" ON "health_metrics"("userId", "date");

-- CreateIndex
CREATE INDEX "wallets_userId_isActive_idx" ON "wallets"("userId", "isActive");

-- CreateIndex
CREATE INDEX "wallets_userId_type_idx" ON "wallets"("userId", "type");

-- CreateIndex
CREATE INDEX "incomes_userId_incomeDate_idx" ON "incomes"("userId", "incomeDate");

-- CreateIndex
CREATE INDEX "incomes_userId_category_idx" ON "incomes"("userId", "category");

-- CreateIndex
CREATE INDEX "incomes_walletId_idx" ON "incomes"("walletId");

-- CreateIndex
CREATE INDEX "expenses_userId_expenseDate_idx" ON "expenses"("userId", "expenseDate");

-- CreateIndex
CREATE INDEX "expenses_userId_category_idx" ON "expenses"("userId", "category");

-- CreateIndex
CREATE INDEX "expenses_userId_needLevel_idx" ON "expenses"("userId", "needLevel");

-- CreateIndex
CREATE INDEX "expenses_walletId_idx" ON "expenses"("walletId");

-- CreateIndex
CREATE INDEX "budgets_userId_category_idx" ON "budgets"("userId", "category");

-- CreateIndex
CREATE INDEX "budgets_userId_startDate_endDate_idx" ON "budgets"("userId", "startDate", "endDate");

-- CreateIndex
CREATE INDEX "debts_userId_status_idx" ON "debts"("userId", "status");

-- CreateIndex
CREATE INDEX "debts_userId_type_idx" ON "debts"("userId", "type");

-- CreateIndex
CREATE INDEX "debts_userId_dueDate_idx" ON "debts"("userId", "dueDate");

-- CreateIndex
CREATE INDEX "saving_goals_userId_status_idx" ON "saving_goals"("userId", "status");

-- CreateIndex
CREATE INDEX "saving_goals_userId_priority_idx" ON "saving_goals"("userId", "priority");

-- CreateIndex
CREATE INDEX "financial_snapshots_month_idx" ON "financial_snapshots"("month");

-- CreateIndex
CREATE UNIQUE INDEX "financial_snapshots_userId_month_key" ON "financial_snapshots"("userId", "month");

-- CreateIndex
CREATE INDEX "personal_goals_userId_status_idx" ON "personal_goals"("userId", "status");

-- CreateIndex
CREATE INDEX "personal_goals_userId_category_idx" ON "personal_goals"("userId", "category");

-- CreateIndex
CREATE INDEX "personal_goals_userId_priority_idx" ON "personal_goals"("userId", "priority");

-- CreateIndex
CREATE INDEX "goal_milestones_goalId_status_idx" ON "goal_milestones"("goalId", "status");

-- CreateIndex
CREATE INDEX "goal_milestones_userId_status_idx" ON "goal_milestones"("userId", "status");

-- CreateIndex
CREATE INDEX "daily_reviews_date_idx" ON "daily_reviews"("date");

-- CreateIndex
CREATE UNIQUE INDEX "daily_reviews_userId_date_key" ON "daily_reviews"("userId", "date");

-- CreateIndex
CREATE INDEX "weekly_reviews_weekStart_idx" ON "weekly_reviews"("weekStart");

-- CreateIndex
CREATE UNIQUE INDEX "weekly_reviews_userId_weekStart_key" ON "weekly_reviews"("userId", "weekStart");

-- Note: ai_recommendations_userId_type_idx already exists from the init
-- migration (the column type changed from String to enum but the index name
-- stayed the same, so Postgres kept it automatically).

-- CreateIndex
CREATE INDEX "tasks_userId_category_idx" ON "tasks"("userId", "category");

-- AddForeignKey
ALTER TABLE "meal_logs" ADD CONSTRAINT "meal_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "health_metrics" ADD CONSTRAINT "health_metrics_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wallets" ADD CONSTRAINT "wallets_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incomes" ADD CONSTRAINT "incomes_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incomes" ADD CONSTRAINT "incomes_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "wallets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "wallets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "budgets" ADD CONSTRAINT "budgets_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "debts" ADD CONSTRAINT "debts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saving_goals" ADD CONSTRAINT "saving_goals_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_snapshots" ADD CONSTRAINT "financial_snapshots_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "personal_goals" ADD CONSTRAINT "personal_goals_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goal_milestones" ADD CONSTRAINT "goal_milestones_goalId_fkey" FOREIGN KEY ("goalId") REFERENCES "personal_goals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goal_milestones" ADD CONSTRAINT "goal_milestones_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_reviews" ADD CONSTRAINT "daily_reviews_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "weekly_reviews" ADD CONSTRAINT "weekly_reviews_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
