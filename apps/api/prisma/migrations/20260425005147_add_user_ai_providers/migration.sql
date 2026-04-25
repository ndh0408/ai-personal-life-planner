-- CreateEnum
CREATE TYPE "UserAiProviderType" AS ENUM ('NVIDIA', 'OPENAI', 'GEMINI', 'ANTHROPIC', 'OPENROUTER', 'CUSTOM_OPENAI_COMPATIBLE');

-- CreateEnum
CREATE TYPE "UserAiProviderTestStatus" AS ENUM ('SUCCESS', 'FAILED');

-- CreateTable
CREATE TABLE "user_ai_providers" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" "UserAiProviderType" NOT NULL,
    "name" TEXT NOT NULL,
    "baseUrl" TEXT,
    "encryptedApiKey" TEXT NOT NULL,
    "apiKeyLast4" TEXT NOT NULL,
    "defaultChatModel" TEXT,
    "defaultPlannerModel" TEXT,
    "defaultFinanceModel" TEXT,
    "defaultMealModel" TEXT,
    "defaultHealthModel" TEXT,
    "defaultReportModel" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "lastTestedAt" TIMESTAMP(3),
    "lastTestStatus" "UserAiProviderTestStatus",
    "lastTestError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_ai_providers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_ai_preferences" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "useOwnApiKey" BOOLEAN NOT NULL DEFAULT false,
    "fallbackToGlobalProvider" BOOLEAN NOT NULL DEFAULT true,
    "defaultProviderId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_ai_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "user_ai_providers_userId_idx" ON "user_ai_providers"("userId");

-- CreateIndex
CREATE INDEX "user_ai_providers_provider_idx" ON "user_ai_providers"("provider");

-- CreateIndex
CREATE UNIQUE INDEX "user_ai_providers_userId_name_key" ON "user_ai_providers"("userId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "user_ai_preferences_userId_key" ON "user_ai_preferences"("userId");

-- AddForeignKey
ALTER TABLE "user_ai_providers" ADD CONSTRAINT "user_ai_providers_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_ai_preferences" ADD CONSTRAINT "user_ai_preferences_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
