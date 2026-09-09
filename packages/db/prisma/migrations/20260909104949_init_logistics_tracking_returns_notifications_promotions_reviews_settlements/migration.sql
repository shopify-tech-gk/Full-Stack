-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "logistics";

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "notifications";

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "promotions";

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "returns";

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "reviews";

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "settlements";

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "tracking";

-- CreateEnum
CREATE TYPE "logistics"."ShipmentStatus" AS ENUM ('CREATED', 'PICKED_UP', 'IN_TRANSIT', 'DELIVERED', 'RTO', 'CANCELLED');

-- CreateEnum
CREATE TYPE "returns"."ReturnStatus" AS ENUM ('REQUESTED', 'APPROVED', 'REJECTED', 'PICKED_UP', 'REFUNDED');

-- CreateEnum
CREATE TYPE "notifications"."NotificationChannel" AS ENUM ('EMAIL', 'SMS', 'PUSH', 'WHATSAPP');

-- CreateEnum
CREATE TYPE "notifications"."NotificationStatus" AS ENUM ('QUEUED', 'SENT', 'FAILED');

-- CreateEnum
CREATE TYPE "promotions"."DiscountType" AS ENUM ('PERCENT', 'FLAT');

-- CreateEnum
CREATE TYPE "reviews"."ReviewStatus" AS ENUM ('PENDING', 'PUBLISHED', 'REJECTED');

-- CreateEnum
CREATE TYPE "settlements"."SettlementStatus" AS ENUM ('PENDING', 'PROCESSING', 'PAID', 'FAILED');

-- CreateTable
CREATE TABLE "logistics"."shipment" (
    "id" TEXT NOT NULL,
    "order_item_id" TEXT NOT NULL,
    "carrier" TEXT,
    "awb_number" TEXT,
    "status" "logistics"."ShipmentStatus" NOT NULL DEFAULT 'CREATED',
    "shiprocket_order_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "shipment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tracking"."tracking_event" (
    "id" TEXT NOT NULL,
    "shipment_id" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "location" TEXT,
    "occurred_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "tracking_event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "returns"."return_request" (
    "id" TEXT NOT NULL,
    "order_item_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "returns"."ReturnStatus" NOT NULL DEFAULT 'REQUESTED',
    "refund_amount" DECIMAL(12,2),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "return_request_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications"."notification_log" (
    "id" TEXT NOT NULL,
    "user_id" TEXT,
    "channel" "notifications"."NotificationChannel" NOT NULL,
    "template" TEXT NOT NULL,
    "status" "notifications"."NotificationStatus" NOT NULL DEFAULT 'QUEUED',
    "payload" JSONB NOT NULL,
    "sent_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "notification_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "promotions"."coupon" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "discount_type" "promotions"."DiscountType" NOT NULL,
    "discount_value" DECIMAL(12,2) NOT NULL,
    "max_discount" DECIMAL(12,2),
    "min_order_value" DECIMAL(12,2),
    "usage_limit" INTEGER,
    "used_count" INTEGER NOT NULL DEFAULT 0,
    "starts_at" TIMESTAMP(3),
    "ends_at" TIMESTAMP(3),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "coupon_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reviews"."review" (
    "id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "order_item_id" TEXT,
    "rating" INTEGER NOT NULL,
    "title" TEXT,
    "body" TEXT,
    "status" "reviews"."ReviewStatus" NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "review_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "settlements"."settlement" (
    "id" TEXT NOT NULL,
    "seller_id" TEXT NOT NULL,
    "period_start" TIMESTAMP(3) NOT NULL,
    "period_end" TIMESTAMP(3) NOT NULL,
    "gross_amount" DECIMAL(12,2) NOT NULL,
    "commission_amount" DECIMAL(12,2) NOT NULL,
    "tcs_amount" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    "tds_amount" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    "net_payable" DECIMAL(12,2) NOT NULL,
    "status" "settlements"."SettlementStatus" NOT NULL DEFAULT 'PENDING',
    "razorpay_payout_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "settlement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "settlements"."settlement_line" (
    "id" TEXT NOT NULL,
    "settlement_id" TEXT NOT NULL,
    "order_item_id" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "settlement_line_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "shipment_order_item_id_idx" ON "logistics"."shipment"("order_item_id");

-- CreateIndex
CREATE INDEX "shipment_awb_number_idx" ON "logistics"."shipment"("awb_number");

-- CreateIndex
CREATE INDEX "shipment_status_idx" ON "logistics"."shipment"("status");

-- CreateIndex
CREATE INDEX "tracking_event_shipment_id_idx" ON "tracking"."tracking_event"("shipment_id");

-- CreateIndex
CREATE INDEX "tracking_event_occurred_at_idx" ON "tracking"."tracking_event"("occurred_at");

-- CreateIndex
CREATE INDEX "return_request_order_item_id_idx" ON "returns"."return_request"("order_item_id");

-- CreateIndex
CREATE INDEX "return_request_user_id_idx" ON "returns"."return_request"("user_id");

-- CreateIndex
CREATE INDEX "return_request_status_idx" ON "returns"."return_request"("status");

-- CreateIndex
CREATE INDEX "notification_log_user_id_idx" ON "notifications"."notification_log"("user_id");

-- CreateIndex
CREATE INDEX "notification_log_channel_idx" ON "notifications"."notification_log"("channel");

-- CreateIndex
CREATE INDEX "notification_log_status_idx" ON "notifications"."notification_log"("status");

-- CreateIndex
CREATE INDEX "coupon_code_idx" ON "promotions"."coupon"("code");

-- CreateIndex
CREATE INDEX "coupon_is_active_idx" ON "promotions"."coupon"("is_active");

-- CreateIndex
CREATE INDEX "review_product_id_idx" ON "reviews"."review"("product_id");

-- CreateIndex
CREATE INDEX "review_user_id_idx" ON "reviews"."review"("user_id");

-- CreateIndex
CREATE INDEX "review_status_idx" ON "reviews"."review"("status");

-- CreateIndex
CREATE INDEX "settlement_seller_id_idx" ON "settlements"."settlement"("seller_id");

-- CreateIndex
CREATE INDEX "settlement_status_idx" ON "settlements"."settlement"("status");

-- CreateIndex
CREATE INDEX "settlement_line_settlement_id_idx" ON "settlements"."settlement_line"("settlement_id");

-- CreateIndex
CREATE INDEX "settlement_line_order_item_id_idx" ON "settlements"."settlement_line"("order_item_id");

-- AddForeignKey
ALTER TABLE "settlements"."settlement_line" ADD CONSTRAINT "settlement_line_settlement_id_fkey" FOREIGN KEY ("settlement_id") REFERENCES "settlements"."settlement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Hand-edited addition (platform-wide soft-delete + uniqueness rule):
-- declarative @unique is not used on soft-deletable columns, since re-creating a
-- row with a previously "deleted" value would otherwise violate a plain UNIQUE
-- constraint. Partial unique indexes enforce uniqueness only among active rows.

-- PartialUniqueIndex: Shipment.awb_number active-only, only enforced when present
CREATE UNIQUE INDEX "shipment_awb_number_active_key" ON "logistics"."shipment"("awb_number") WHERE "awb_number" IS NOT NULL AND "deleted_at" IS NULL;

-- PartialUniqueIndex: Coupon.code active-only
CREATE UNIQUE INDEX "coupon_code_active_key" ON "promotions"."coupon"("code") WHERE "deleted_at" IS NULL;

-- PartialUniqueIndex: Settlement.razorpay_payout_id active-only, only enforced when present
CREATE UNIQUE INDEX "settlement_razorpay_payout_id_active_key" ON "settlements"."settlement"("razorpay_payout_id") WHERE "razorpay_payout_id" IS NOT NULL AND "deleted_at" IS NULL;

-- Hand-edited addition: rating must be between 1 and 5 (Prisma has no
-- declarative CHECK constraint support).
ALTER TABLE "reviews"."review" ADD CONSTRAINT "review_rating_range_check" CHECK ("rating" BETWEEN 1 AND 5);

-- ============================================================================
-- PLACEHOLDER: per-schema database ROLES and GRANTs
-- ----------------------------------------------------------------------------
-- Per-schema scoped Postgres roles (e.g. "logistics_service", "tracking_service",
-- "returns_service", "notifications_service", "promotions_service",
-- "reviews_service", "settlements_service", each limited to its own schema) are
-- intentionally NOT created in this migration, for the same reason as every
-- prior migration: we're adding schemas one at a time, and creating
-- roles/GRANTs per-chapter would mean rewriting the same statements
-- repeatedly. Roles/GRANTs will be added in one consolidated migration
-- once all schemas listed in the datasource block exist (prompt 2.5).
-- ============================================================================

