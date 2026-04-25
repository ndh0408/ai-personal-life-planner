-- CreateEnum
CREATE TYPE "FinanceEntityType" AS ENUM ('WALLET', 'INCOME', 'EXPENSE', 'BUDGET', 'DEBT', 'SAVING_GOAL', 'DEBT_PAYMENT', 'SAVING_CONTRIBUTION');

-- CreateEnum
CREATE TYPE "FinanceAction" AS ENUM ('CREATE', 'UPDATE', 'DELETE', 'PAY', 'CONTRIBUTE');

-- AlterTable
ALTER TABLE "budgets" ADD COLUMN     "currency" TEXT NOT NULL DEFAULT 'VND';

-- AlterTable
ALTER TABLE "debts" ADD COLUMN     "currency" TEXT NOT NULL DEFAULT 'VND';

-- AlterTable
ALTER TABLE "expenses" ADD COLUMN     "currency" TEXT NOT NULL DEFAULT 'VND';

-- AlterTable
ALTER TABLE "incomes" ADD COLUMN     "currency" TEXT NOT NULL DEFAULT 'VND';

-- AlterTable
ALTER TABLE "saving_goals" ADD COLUMN     "currency" TEXT NOT NULL DEFAULT 'VND';

-- CreateTable
CREATE TABLE "finance_audit_logs" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "entityType" "FinanceEntityType" NOT NULL,
    "entityId" TEXT NOT NULL,
    "action" "FinanceAction" NOT NULL,
    "before" JSONB,
    "after" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "finance_audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "finance_idempotency_keys" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "entityType" "FinanceEntityType" NOT NULL,
    "entityId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "finance_idempotency_keys_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "finance_audit_logs_userId_createdAt_idx" ON "finance_audit_logs"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "finance_audit_logs_userId_entityType_entityId_idx" ON "finance_audit_logs"("userId", "entityType", "entityId");

-- CreateIndex
CREATE INDEX "finance_idempotency_keys_userId_createdAt_idx" ON "finance_idempotency_keys"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "finance_idempotency_keys_userId_scope_key_key" ON "finance_idempotency_keys"("userId", "scope", "key");

-- CreateIndex
CREATE INDEX "expenses_userId_currency_expenseDate_idx" ON "expenses"("userId", "currency", "expenseDate");

-- CreateIndex
CREATE INDEX "incomes_userId_currency_incomeDate_idx" ON "incomes"("userId", "currency", "incomeDate");

-- AddForeignKey
ALTER TABLE "finance_audit_logs" ADD CONSTRAINT "finance_audit_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finance_idempotency_keys" ADD CONSTRAINT "finance_idempotency_keys_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

