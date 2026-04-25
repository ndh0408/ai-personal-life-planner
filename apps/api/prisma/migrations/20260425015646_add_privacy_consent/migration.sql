-- CreateEnum
CREATE TYPE "UserConsentType" AS ENUM ('TOS', 'PRIVACY_POLICY', 'AI_PROCESSING', 'PERSONALIZATION', 'DIAGNOSTICS', 'NOTIFICATIONS', 'CALENDAR', 'LOCATION', 'HEALTH_FITNESS', 'MICROPHONE', 'CAMERA', 'PHOTOS');

-- CreateTable
CREATE TABLE "privacy_settings" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "personalizationEnabled" BOOLEAN NOT NULL DEFAULT true,
    "useScheduleForAI" BOOLEAN NOT NULL DEFAULT true,
    "useFinanceForAI" BOOLEAN NOT NULL DEFAULT true,
    "useHealthForAI" BOOLEAN NOT NULL DEFAULT true,
    "useMealForAI" BOOLEAN NOT NULL DEFAULT true,
    "useCalendarContext" BOOLEAN NOT NULL DEFAULT false,
    "useLocationContext" BOOLEAN NOT NULL DEFAULT false,
    "useHealthFitnessContext" BOOLEAN NOT NULL DEFAULT false,
    "voiceInputEnabled" BOOLEAN NOT NULL DEFAULT false,
    "proactiveRecommendations" BOOLEAN NOT NULL DEFAULT true,
    "anonymizedDiagnostics" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "privacy_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_consents" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "consentType" "UserConsentType" NOT NULL,
    "granted" BOOLEAN NOT NULL,
    "version" TEXT NOT NULL,
    "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),
    "metadata" JSONB,

    CONSTRAINT "user_consents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "privacy_settings_userId_key" ON "privacy_settings"("userId");

-- CreateIndex
CREATE INDEX "user_consents_userId_consentType_idx" ON "user_consents"("userId", "consentType");

-- CreateIndex
CREATE INDEX "user_consents_userId_grantedAt_idx" ON "user_consents"("userId", "grantedAt");

-- AddForeignKey
ALTER TABLE "privacy_settings" ADD CONSTRAINT "privacy_settings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_consents" ADD CONSTRAINT "user_consents_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
