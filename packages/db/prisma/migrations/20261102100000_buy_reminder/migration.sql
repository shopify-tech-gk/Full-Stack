-- CreateEnum
CREATE TYPE "notifications"."BuyReminderStatus" AS ENUM ('SCHEDULED', 'SENT', 'CANCELLED');

-- CreateEnum
CREATE TYPE "notifications"."BuyReminderRepeat" AS ENUM ('NONE', 'WEEKLY', 'MONTHLY');

-- CreateTable
CREATE TABLE "notifications"."buy_reminder" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "sku_id" TEXT,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "image_url" TEXT,
    "price_at_set" DECIMAL(12,2),
    "note" TEXT,
    "remind_at" TIMESTAMP(3) NOT NULL,
    "repeat" "notifications"."BuyReminderRepeat" NOT NULL DEFAULT 'NONE',
    "status" "notifications"."BuyReminderStatus" NOT NULL DEFAULT 'SCHEDULED',
    "sent_count" INTEGER NOT NULL DEFAULT 0,
    "last_sent_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "buy_reminder_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "buy_reminder_status_remind_at_idx" ON "notifications"."buy_reminder"("status", "remind_at");

-- CreateIndex
CREATE INDEX "buy_reminder_user_id_status_idx" ON "notifications"."buy_reminder"("user_id", "status");
