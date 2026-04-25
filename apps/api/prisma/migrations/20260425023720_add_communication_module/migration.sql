-- CreateEnum
CREATE TYPE "ConnectedAccountProvider" AS ENUM ('GMAIL', 'OUTLOOK', 'IMAP');

-- CreateEnum
CREATE TYPE "EmailCategory" AS ENUM ('PERSONAL', 'WORK', 'FINANCE', 'BILL', 'EVENT', 'PROMOTION', 'OTHER');

-- CreateEnum
CREATE TYPE "EmailReminderStatus" AS ENUM ('PENDING', 'SENT', 'DISMISSED', 'DONE');

-- CreateEnum
CREATE TYPE "MessageReminderStatus" AS ENUM ('PENDING', 'SENT', 'DISMISSED', 'DONE');

-- CreateEnum
CREATE TYPE "MessageReminderSource" AS ENUM ('MANUAL', 'AI_SUGGESTED', 'NOTIFICATION_IMPORT');

-- CreateEnum
CREATE TYPE "AiCompanionMemoryType" AS ENUM ('PREFERENCE', 'HABIT', 'GOAL', 'RELATIONSHIP', 'WORK_STYLE', 'COMMUNICATION', 'HEALTH_CONTEXT', 'FINANCE_CONTEXT', 'OTHER');

-- CreateEnum
CREATE TYPE "AiCompanionMemorySource" AS ENUM ('CHAT', 'VOICE_NOTE', 'EMAIL', 'MANUAL_CHECKIN', 'USER_CONFIRMATION');

-- CreateTable
CREATE TABLE "communication_settings" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "emailAssistantEnabled" BOOLEAN NOT NULL DEFAULT false,
    "emailMetadataSync" BOOLEAN NOT NULL DEFAULT true,
    "emailSnippetSync" BOOLEAN NOT NULL DEFAULT false,
    "emailFullContentAnalysis" BOOLEAN NOT NULL DEFAULT false,
    "followUpRemindersEnabled" BOOLEAN NOT NULL DEFAULT true,
    "messageReminderEnabled" BOOLEAN NOT NULL DEFAULT true,
    "androidNotificationImportEnabled" BOOLEAN NOT NULL DEFAULT false,
    "aiMemoryEnabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "communication_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "memory_consents" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "allowMemory" BOOLEAN NOT NULL DEFAULT true,
    "allowEmailForAI" BOOLEAN NOT NULL DEFAULT false,
    "allowCommunicationContextForAI" BOOLEAN NOT NULL DEFAULT false,
    "allowVoiceNotesForAI" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "memory_consents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "connected_accounts" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" "ConnectedAccountProvider" NOT NULL,
    "email" TEXT NOT NULL,
    "displayName" TEXT,
    "encryptedAccessToken" TEXT NOT NULL,
    "encryptedRefreshToken" TEXT,
    "tokenExpiresAt" TIMESTAMP(3),
    "scopes" JSONB NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastSyncedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "connected_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_items" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "connectedAccountId" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "threadId" TEXT,
    "fromName" TEXT,
    "fromEmail" TEXT,
    "subject" TEXT NOT NULL,
    "snippet" TEXT,
    "receivedAt" TIMESTAMP(3) NOT NULL,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "isImportant" BOOLEAN NOT NULL DEFAULT false,
    "needsReply" BOOLEAN NOT NULL DEFAULT false,
    "hasDeadline" BOOLEAN NOT NULL DEFAULT false,
    "detectedDeadlineAt" TIMESTAMP(3),
    "category" "EmailCategory",
    "aiSummary" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "email_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_reminders" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "emailItemId" TEXT,
    "title" TEXT NOT NULL,
    "note" TEXT,
    "remindAt" TIMESTAMP(3) NOT NULL,
    "status" "EmailReminderStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "email_reminders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "message_reminders" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "contactName" TEXT,
    "platform" TEXT,
    "title" TEXT NOT NULL,
    "note" TEXT,
    "remindAt" TIMESTAMP(3) NOT NULL,
    "status" "MessageReminderStatus" NOT NULL DEFAULT 'PENDING',
    "source" "MessageReminderSource" NOT NULL DEFAULT 'MANUAL',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "message_reminders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_companion_memories" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "memoryType" "AiCompanionMemoryType" NOT NULL,
    "content" TEXT NOT NULL,
    "source" "AiCompanionMemorySource" NOT NULL,
    "confidence" DOUBLE PRECISION,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastUsedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_companion_memories_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "communication_settings_userId_key" ON "communication_settings"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "memory_consents_userId_key" ON "memory_consents"("userId");

-- CreateIndex
CREATE INDEX "connected_accounts_userId_idx" ON "connected_accounts"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "connected_accounts_userId_provider_email_key" ON "connected_accounts"("userId", "provider", "email");

-- CreateIndex
CREATE INDEX "email_items_userId_receivedAt_idx" ON "email_items"("userId", "receivedAt");

-- CreateIndex
CREATE INDEX "email_items_userId_isImportant_idx" ON "email_items"("userId", "isImportant");

-- CreateIndex
CREATE INDEX "email_items_userId_needsReply_idx" ON "email_items"("userId", "needsReply");

-- CreateIndex
CREATE INDEX "email_items_userId_hasDeadline_idx" ON "email_items"("userId", "hasDeadline");

-- CreateIndex
CREATE INDEX "email_items_userId_category_idx" ON "email_items"("userId", "category");

-- CreateIndex
CREATE UNIQUE INDEX "email_items_connectedAccountId_externalId_key" ON "email_items"("connectedAccountId", "externalId");

-- CreateIndex
CREATE INDEX "email_reminders_userId_status_idx" ON "email_reminders"("userId", "status");

-- CreateIndex
CREATE INDEX "email_reminders_userId_remindAt_idx" ON "email_reminders"("userId", "remindAt");

-- CreateIndex
CREATE INDEX "message_reminders_userId_status_idx" ON "message_reminders"("userId", "status");

-- CreateIndex
CREATE INDEX "message_reminders_userId_remindAt_idx" ON "message_reminders"("userId", "remindAt");

-- CreateIndex
CREATE INDEX "ai_companion_memories_userId_isActive_idx" ON "ai_companion_memories"("userId", "isActive");

-- CreateIndex
CREATE INDEX "ai_companion_memories_userId_memoryType_idx" ON "ai_companion_memories"("userId", "memoryType");

-- AddForeignKey
ALTER TABLE "communication_settings" ADD CONSTRAINT "communication_settings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "memory_consents" ADD CONSTRAINT "memory_consents_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "connected_accounts" ADD CONSTRAINT "connected_accounts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_items" ADD CONSTRAINT "email_items_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_items" ADD CONSTRAINT "email_items_connectedAccountId_fkey" FOREIGN KEY ("connectedAccountId") REFERENCES "connected_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_reminders" ADD CONSTRAINT "email_reminders_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_reminders" ADD CONSTRAINT "email_reminders_emailItemId_fkey" FOREIGN KEY ("emailItemId") REFERENCES "email_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "message_reminders" ADD CONSTRAINT "message_reminders_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_companion_memories" ADD CONSTRAINT "ai_companion_memories_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
