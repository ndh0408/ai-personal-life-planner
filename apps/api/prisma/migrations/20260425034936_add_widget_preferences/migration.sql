-- CreateEnum
CREATE TYPE "WidgetPrivacyMode" AS ENUM ('FULL', 'HIDE_SENSITIVE', 'MINIMAL');

-- CreateTable
CREATE TABLE "widget_preferences" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "showTasks" BOOLEAN NOT NULL DEFAULT true,
    "showRecommendations" BOOLEAN NOT NULL DEFAULT true,
    "showHealthData" BOOLEAN NOT NULL DEFAULT true,
    "showFinance" BOOLEAN NOT NULL DEFAULT true,
    "showFinanceAmounts" BOOLEAN NOT NULL DEFAULT false,
    "privacyMode" "WidgetPrivacyMode" NOT NULL DEFAULT 'HIDE_SENSITIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "widget_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "widget_preferences_userId_key" ON "widget_preferences"("userId");

-- AddForeignKey
ALTER TABLE "widget_preferences" ADD CONSTRAINT "widget_preferences_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
