-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "cart";

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "catalog";

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "inventory";

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "orders";

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "payments";

-- CreateEnum
CREATE TYPE "catalog"."ProductStatus" AS ENUM ('DRAFT', 'ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "inventory"."ReservationStatus" AS ENUM ('HELD', 'COMMITTED', 'RELEASED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "cart"."CartStatus" AS ENUM ('ACTIVE', 'CONVERTED', 'ABANDONED');

-- CreateEnum
CREATE TYPE "orders"."OrderStatus" AS ENUM ('PENDING_PAYMENT', 'CONFIRMED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "orders"."OrderItemStatus" AS ENUM ('PENDING', 'CONFIRMED', 'PACKED', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'RETURNED');

-- CreateEnum
CREATE TYPE "payments"."PaymentStatus" AS ENUM ('CREATED', 'CAPTURED', 'FAILED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "payments"."RefundStatus" AS ENUM ('PENDING', 'PROCESSED', 'FAILED');

-- CreateTable
CREATE TABLE "catalog"."category" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "parent_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "catalog"."product" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "seller_id" TEXT NOT NULL,
    "category_id" TEXT NOT NULL,
    "attributes" JSONB NOT NULL,
    "status" "catalog"."ProductStatus" NOT NULL DEFAULT 'DRAFT',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "catalog"."sku" (
    "id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "sku_code" TEXT NOT NULL,
    "mrp" DECIMAL(12,2) NOT NULL,
    "selling_price" DECIMAL(12,2) NOT NULL,
    "attributes" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "sku_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "catalog"."product_image" (
    "id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "product_image_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory"."stock_level" (
    "id" TEXT NOT NULL,
    "sku_id" TEXT NOT NULL,
    "available" INTEGER NOT NULL DEFAULT 0,
    "reserved" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "stock_level_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory"."reservation" (
    "id" TEXT NOT NULL,
    "sku_id" TEXT NOT NULL,
    "order_id" TEXT,
    "quantity" INTEGER NOT NULL,
    "status" "inventory"."ReservationStatus" NOT NULL DEFAULT 'HELD',
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "reservation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cart"."cart" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "status" "cart"."CartStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "cart_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cart"."cart_item" (
    "id" TEXT NOT NULL,
    "cart_id" TEXT NOT NULL,
    "sku_id" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "price_snapshot" DECIMAL(12,2) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "cart_item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "orders"."order" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "order_number" TEXT NOT NULL,
    "status" "orders"."OrderStatus" NOT NULL DEFAULT 'PENDING_PAYMENT',
    "subtotal" DECIMAL(12,2) NOT NULL,
    "shipping_total" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    "grand_total" DECIMAL(12,2) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "orders"."order_item" (
    "id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "sku_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "seller_id" TEXT NOT NULL,
    "title_snapshot" TEXT NOT NULL,
    "unit_price" DECIMAL(12,2) NOT NULL,
    "quantity" INTEGER NOT NULL,
    "line_total" DECIMAL(12,2) NOT NULL,
    "seller_status" "orders"."OrderItemStatus" NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "order_item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "orders"."order_status_history" (
    "id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "from_status" "orders"."OrderStatus",
    "to_status" "orders"."OrderStatus" NOT NULL,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "order_status_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments"."payment" (
    "id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "status" "payments"."PaymentStatus" NOT NULL DEFAULT 'CREATED',
    "razorpay_order_id" TEXT,
    "razorpay_payment_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments"."refund" (
    "id" TEXT NOT NULL,
    "payment_id" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "reason" TEXT,
    "status" "payments"."RefundStatus" NOT NULL DEFAULT 'PENDING',
    "razorpay_refund_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "refund_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments"."payment_webhook_event" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "processed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "payment_webhook_event_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "category_slug_idx" ON "catalog"."category"("slug");

-- CreateIndex
CREATE INDEX "category_parent_id_idx" ON "catalog"."category"("parent_id");

-- CreateIndex
CREATE INDEX "product_seller_id_idx" ON "catalog"."product"("seller_id");

-- CreateIndex
CREATE INDEX "product_category_id_idx" ON "catalog"."product"("category_id");

-- CreateIndex
CREATE INDEX "product_status_idx" ON "catalog"."product"("status");

-- CreateIndex
CREATE INDEX "product_slug_idx" ON "catalog"."product"("slug");

-- CreateIndex
CREATE INDEX "sku_product_id_idx" ON "catalog"."sku"("product_id");

-- CreateIndex
CREATE INDEX "sku_sku_code_idx" ON "catalog"."sku"("sku_code");

-- CreateIndex
CREATE INDEX "product_image_product_id_idx" ON "catalog"."product_image"("product_id");

-- CreateIndex
CREATE INDEX "stock_level_sku_id_idx" ON "inventory"."stock_level"("sku_id");

-- CreateIndex
CREATE INDEX "reservation_sku_id_idx" ON "inventory"."reservation"("sku_id");

-- CreateIndex
CREATE INDEX "reservation_order_id_idx" ON "inventory"."reservation"("order_id");

-- CreateIndex
CREATE INDEX "reservation_status_idx" ON "inventory"."reservation"("status");

-- CreateIndex
CREATE INDEX "cart_user_id_idx" ON "cart"."cart"("user_id");

-- CreateIndex
CREATE INDEX "cart_item_cart_id_idx" ON "cart"."cart_item"("cart_id");

-- CreateIndex
CREATE INDEX "cart_item_sku_id_idx" ON "cart"."cart_item"("sku_id");

-- CreateIndex
CREATE INDEX "order_user_id_idx" ON "orders"."order"("user_id");

-- CreateIndex
CREATE INDEX "order_status_idx" ON "orders"."order"("status");

-- CreateIndex
CREATE INDEX "order_item_order_id_idx" ON "orders"."order_item"("order_id");

-- CreateIndex
CREATE INDEX "order_item_seller_id_idx" ON "orders"."order_item"("seller_id");

-- CreateIndex
CREATE INDEX "order_item_sku_id_idx" ON "orders"."order_item"("sku_id");

-- CreateIndex
CREATE INDEX "order_item_seller_status_idx" ON "orders"."order_item"("seller_status");

-- CreateIndex
CREATE INDEX "order_status_history_order_id_idx" ON "orders"."order_status_history"("order_id");

-- CreateIndex
CREATE INDEX "payment_order_id_idx" ON "payments"."payment"("order_id");

-- CreateIndex
CREATE INDEX "payment_status_idx" ON "payments"."payment"("status");

-- CreateIndex
CREATE INDEX "refund_payment_id_idx" ON "payments"."refund"("payment_id");

-- CreateIndex
CREATE INDEX "refund_status_idx" ON "payments"."refund"("status");

-- CreateIndex
CREATE INDEX "payment_webhook_event_event_id_idx" ON "payments"."payment_webhook_event"("event_id");

-- AddForeignKey
ALTER TABLE "catalog"."category" ADD CONSTRAINT "category_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "catalog"."category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "catalog"."product" ADD CONSTRAINT "product_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "catalog"."category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "catalog"."sku" ADD CONSTRAINT "sku_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "catalog"."product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "catalog"."product_image" ADD CONSTRAINT "product_image_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "catalog"."product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cart"."cart_item" ADD CONSTRAINT "cart_item_cart_id_fkey" FOREIGN KEY ("cart_id") REFERENCES "cart"."cart"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders"."order_item" ADD CONSTRAINT "order_item_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"."order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders"."order_status_history" ADD CONSTRAINT "order_status_history_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"."order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments"."refund" ADD CONSTRAINT "refund_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "payments"."payment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Hand-edited addition (platform-wide soft-delete + uniqueness rule):
-- declarative @unique is not used on soft-deletable columns, since re-creating a
-- row with a previously "deleted" value would otherwise violate a plain UNIQUE
-- constraint. Partial unique indexes enforce uniqueness only among active rows.

-- PartialUniqueIndex: Category.slug active-only
CREATE UNIQUE INDEX "category_slug_active_key" ON "catalog"."category"("slug") WHERE "deleted_at" IS NULL;

-- PartialUniqueIndex: Product.slug active-only
CREATE UNIQUE INDEX "product_slug_active_key" ON "catalog"."product"("slug") WHERE "deleted_at" IS NULL;

-- PartialUniqueIndex: Sku.sku_code active-only
CREATE UNIQUE INDEX "sku_sku_code_active_key" ON "catalog"."sku"("sku_code") WHERE "deleted_at" IS NULL;

-- PartialUniqueIndex: exactly one active StockLevel row per SKU
CREATE UNIQUE INDEX "stock_level_sku_id_active_key" ON "inventory"."stock_level"("sku_id") WHERE "deleted_at" IS NULL;

-- PartialUniqueIndex: Order.order_number active-only (human-facing id)
CREATE UNIQUE INDEX "order_order_number_active_key" ON "orders"."order"("order_number") WHERE "deleted_at" IS NULL;

-- PartialUniqueIndex: Payment.razorpay_order_id active-only, only enforced when present
CREATE UNIQUE INDEX "payment_razorpay_order_id_active_key" ON "payments"."payment"("razorpay_order_id") WHERE "razorpay_order_id" IS NOT NULL AND "deleted_at" IS NULL;

-- PartialUniqueIndex: Payment.razorpay_payment_id active-only, only enforced when present
CREATE UNIQUE INDEX "payment_razorpay_payment_id_active_key" ON "payments"."payment"("razorpay_payment_id") WHERE "razorpay_payment_id" IS NOT NULL AND "deleted_at" IS NULL;

-- PartialUniqueIndex: Refund.razorpay_refund_id active-only, only enforced when present
CREATE UNIQUE INDEX "refund_razorpay_refund_id_active_key" ON "payments"."refund"("razorpay_refund_id") WHERE "razorpay_refund_id" IS NOT NULL AND "deleted_at" IS NULL;

-- PartialUniqueIndex: PaymentWebhookEvent.event_id active-only (idempotency key)
CREATE UNIQUE INDEX "payment_webhook_event_event_id_active_key" ON "payments"."payment_webhook_event"("event_id") WHERE "deleted_at" IS NULL;

-- ============================================================================
-- PLACEHOLDER: per-schema database ROLES and GRANTs
-- ----------------------------------------------------------------------------
-- Per-schema scoped Postgres roles (e.g. "catalog_service", "inventory_service",
-- "cart_service", "orders_service", "payments_service", each limited to its own
-- schema) are intentionally NOT created in this migration, for the same reason
-- as the admin and auth/sellers migrations: we're adding schemas one at a time,
-- and creating roles/GRANTs per-chapter would mean rewriting the same
-- statements repeatedly. Roles/GRANTs will be added in one consolidated
-- migration once all schemas listed in the datasource block exist.
-- ============================================================================

