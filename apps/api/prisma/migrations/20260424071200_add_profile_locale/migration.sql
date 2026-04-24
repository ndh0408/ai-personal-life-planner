-- AlterTable: add locale to user_profiles (default "vi" for i18n backend)
ALTER TABLE "user_profiles" ADD COLUMN "locale" TEXT NOT NULL DEFAULT 'vi';
