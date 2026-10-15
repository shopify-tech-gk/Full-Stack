-- CreateEnum
CREATE TYPE "promotions"."CouponRedemptionStatus" AS ENUM ('RESERVED', 'USED', 'RELEASED');

-- AlterTable
ALTER TABLE "orders"."order" ADD COLUMN     "coupon_code" TEXT,
ADD COLUMN     "discount_total" DECIMAL(12,2) NOT NULL DEFAULT 0.00;

-- AlterTable
ALTER TABLE "orders"."order_item" ADD COLUMN     "discount" DECIMAL(12,2) NOT NULL DEFAULT 0.00;

-- AlterTable
ALTER TABLE "promotions"."coupon" ADD COLUMN     "description" VARCHAR(300),
ADD COLUMN     "is_public" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "per_user_limit" INTEGER DEFAULT 1,
ADD COLUMN     "title" VARCHAR(80);

-- CreateTable
CREATE TABLE "promotions"."coupon_redemption" (
    "id" TEXT NOT NULL,
    "coupon_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "order_id" TEXT,
    "discount" DECIMAL(12,2) NOT NULL,
    "status" "promotions"."CouponRedemptionStatus" NOT NULL DEFAULT 'RESERVED',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "coupon_redemption_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "coupon_redemption_coupon_id_user_id_idx" ON "promotions"."coupon_redemption"("coupon_id", "user_id");

-- CreateIndex
CREATE INDEX "coupon_redemption_order_id_idx" ON "promotions"."coupon_redemption"("order_id");

-- AddForeignKey
ALTER TABLE "promotions"."coupon_redemption" ADD CONSTRAINT "coupon_redemption_coupon_id_fkey" FOREIGN KEY ("coupon_id") REFERENCES "promotions"."coupon"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Hand-added: sanity checks and least-privilege grants (new table -> explicit grant).
ALTER TABLE "promotions"."coupon"
  ADD CONSTRAINT "coupon_discount_value_positive" CHECK ("discount_value" > 0),
  ADD CONSTRAINT "coupon_percent_max_100" CHECK ("discount_type" <> 'PERCENT' OR "discount_value" <= 100),
  ADD CONSTRAINT "coupon_used_within_limit" CHECK ("usage_limit" IS NULL OR "used_count" <= "usage_limit");
ALTER TABLE "promotions"."coupon_redemption"
  ADD CONSTRAINT "coupon_redemption_discount_nonneg" CHECK ("discount" >= 0);
ALTER TABLE "orders"."order"
  ADD CONSTRAINT "order_discount_total_nonneg" CHECK ("discount_total" >= 0);
ALTER TABLE "orders"."order_item"
  ADD CONSTRAINT "order_item_discount_within_line" CHECK ("discount" >= 0 AND "discount" <= "line_total");
-- Only one live order per redemption.
CREATE UNIQUE INDEX "coupon_redemption_order_live_key"
  ON "promotions"."coupon_redemption" ("order_id")
  WHERE "order_id" IS NOT NULL AND "status" <> 'RELEASED';

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "promotions"."coupon_redemption" TO "promotions_svc";
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "promotions"."coupon" TO "promotions_svc";
