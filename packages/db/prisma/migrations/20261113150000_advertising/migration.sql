-- v1.19 Advertising: ad campaigns + uploaded ad media (sellers schema), and the wallet AD_PAYMENT entry type.
-- CreateEnum
CREATE TYPE "sellers"."AdKind" AS ENUM ('IMAGE', 'VIDEO');

-- CreateEnum
CREATE TYPE "sellers"."AdStatus" AS ENUM ('PENDING_REVIEW', 'APPROVED', 'PAID', 'REJECTED', 'CANCELLED', 'REMOVED');

-- AlterEnum
ALTER TYPE "payments"."WalletTxnType" ADD VALUE 'AD_PAYMENT';

-- CreateTable
CREATE TABLE "sellers"."ad_campaign" (
    "id" TEXT NOT NULL,
    "reference_code" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "kind" "sellers"."AdKind" NOT NULL,
    "advertiser_name" TEXT NOT NULL,
    "headline" TEXT NOT NULL,
    "caption" TEXT,
    "link_url" TEXT,
    "media" JSONB NOT NULL,
    "starts_at" TIMESTAMP(3) NOT NULL,
    "ends_at" TIMESTAMP(3) NOT NULL,
    "days" INTEGER NOT NULL,
    "price_per_day" DECIMAL(10,2) NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "status" "sellers"."AdStatus" NOT NULL DEFAULT 'PENDING_REVIEW',
    "reject_reason" TEXT,
    "reviewed_at" TIMESTAMP(3),
    "paid_at" TIMESTAMP(3),
    "cancelled_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ad_campaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sellers"."ad_media" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "file_name" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "bytes" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ad_media_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ad_campaign_reference_code_key" ON "sellers"."ad_campaign"("reference_code");

-- CreateIndex
CREATE INDEX "ad_campaign_kind_status_starts_at_idx" ON "sellers"."ad_campaign"("kind", "status", "starts_at");

-- CreateIndex
CREATE INDEX "ad_campaign_user_id_created_at_idx" ON "sellers"."ad_campaign"("user_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "ad_media_file_name_key" ON "sellers"."ad_media"("file_name");

-- CreateIndex
CREATE INDEX "ad_media_user_id_idx" ON "sellers"."ad_media"("user_id");

