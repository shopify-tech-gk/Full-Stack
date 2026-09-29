-- CreateEnum
CREATE TYPE "orders"."CancelRequestStatus" AS ENUM ('REQUESTED', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "notifications"."SupportMessageStatus" AS ENUM ('NEW', 'IN_PROGRESS', 'RESOLVED');

-- CreateTable
CREATE TABLE "cart"."wishlist_item" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "sku_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "wishlist_item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "orders"."order_cancel_request" (
    "id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "comment" TEXT,
    "status" "orders"."CancelRequestStatus" NOT NULL DEFAULT 'REQUESTED',
    "resolution_note" TEXT,
    "resolved_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "order_cancel_request_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "orders"."order_notify_preference" (
    "id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "whatsapp" BOOLEAN NOT NULL DEFAULT true,
    "sms" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "order_notify_preference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications"."support_message" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "message" TEXT NOT NULL,
    "status" "notifications"."SupportMessageStatus" NOT NULL DEFAULT 'NEW',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "support_message_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "wishlist_item_user_id_idx" ON "cart"."wishlist_item"("user_id");

-- CreateIndex
CREATE INDEX "wishlist_item_sku_id_idx" ON "cart"."wishlist_item"("sku_id");

-- CreateIndex
CREATE INDEX "order_cancel_request_order_id_idx" ON "orders"."order_cancel_request"("order_id");

-- CreateIndex
CREATE INDEX "order_cancel_request_user_id_idx" ON "orders"."order_cancel_request"("user_id");

-- CreateIndex
CREATE INDEX "order_cancel_request_status_idx" ON "orders"."order_cancel_request"("status");

-- CreateIndex
CREATE INDEX "order_notify_preference_order_id_idx" ON "orders"."order_notify_preference"("order_id");

-- CreateIndex
CREATE INDEX "order_notify_preference_user_id_idx" ON "orders"."order_notify_preference"("user_id");

-- CreateIndex
CREATE INDEX "support_message_status_idx" ON "notifications"."support_message"("status");

-- CreateIndex
CREATE INDEX "support_message_created_at_idx" ON "notifications"."support_message"("created_at");

-- AddForeignKey
ALTER TABLE "orders"."order_cancel_request" ADD CONSTRAINT "order_cancel_request_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"."order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders"."order_notify_preference" ADD CONSTRAINT "order_notify_preference_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"."order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
