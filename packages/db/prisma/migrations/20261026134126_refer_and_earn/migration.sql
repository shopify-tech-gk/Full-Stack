-- CreateEnum
CREATE TYPE "orders"."ReferralRewardStatus" AS ENUM ('CREDITED', 'REVERSED');

-- AlterEnum
ALTER TYPE "payments"."WalletTxnType" ADD VALUE 'REFERRAL_REWARD';

-- AlterTable
ALTER TABLE "auth"."user" ADD COLUMN     "referral_code" TEXT,
ADD COLUMN     "referred_at" TIMESTAMP(3),
ADD COLUMN     "referred_by_id" TEXT;

-- CreateTable
CREATE TABLE "orders"."referral_reward" (
    "id" TEXT NOT NULL,
    "referrer_id" TEXT NOT NULL,
    "buyer_id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "order_item_id" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "status" "orders"."ReferralRewardStatus" NOT NULL DEFAULT 'CREDITED',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "referral_reward_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "referral_reward_order_item_id_key" ON "orders"."referral_reward"("order_item_id");

-- CreateIndex
CREATE INDEX "referral_reward_referrer_id_created_at_idx" ON "orders"."referral_reward"("referrer_id", "created_at");

-- CreateIndex
CREATE INDEX "referral_reward_order_id_idx" ON "orders"."referral_reward"("order_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_referral_code_key" ON "auth"."user"("referral_code");

-- CreateIndex
CREATE INDEX "user_referred_by_id_idx" ON "auth"."user"("referred_by_id");

