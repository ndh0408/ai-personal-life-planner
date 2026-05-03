-- Round 41: subscription / entitlements row per user. Tier + status are
-- text + CHECK so the shared @lifeos/taxonomy enum stays the source of
-- truth without a separate Postgres enum migration. Provider-specific
-- IDs are nullable; we set them when the user first transacts.

CREATE TABLE "Subscription" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "tier" TEXT NOT NULL DEFAULT 'FREE',
  "status" TEXT NOT NULL DEFAULT 'NONE',
  "provider" TEXT NOT NULL DEFAULT 'none',
  "providerCustomerId" TEXT,
  "providerSubscriptionId" TEXT,
  "currentPeriodEnd" TIMESTAMP(3),
  "autoRenew" BOOLEAN NOT NULL DEFAULT false,
  "lifetimePurchasedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Subscription_userId_key" ON "Subscription"("userId");
CREATE INDEX "Subscription_tier_idx" ON "Subscription"("tier");
CREATE INDEX "Subscription_status_idx" ON "Subscription"("status");

ALTER TABLE "Subscription"
  ADD CONSTRAINT "Subscription_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Subscription"
  ADD CONSTRAINT "Subscription_tier_check"
  CHECK ("tier" IN ('FREE', 'PLUS', 'PRO', 'LIFETIME'));

ALTER TABLE "Subscription"
  ADD CONSTRAINT "Subscription_status_check"
  CHECK ("status" IN ('NONE', 'TRIAL', 'ACTIVE', 'GRACE', 'EXPIRED', 'CANCELLED'));

ALTER TABLE "Subscription"
  ADD CONSTRAINT "Subscription_provider_check"
  CHECK ("provider" IN ('appstore', 'playstore', 'stripe', 'promo', 'lifetime', 'none'));
