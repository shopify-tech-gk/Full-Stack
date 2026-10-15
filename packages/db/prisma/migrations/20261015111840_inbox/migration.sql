-- CreateEnum
CREATE TYPE "notifications"."InboxKind" AS ENUM ('ORDER', 'REFUND', 'RETURN', 'SUPPORT', 'OFFER', 'ACCOUNT');

-- AlterEnum
ALTER TYPE "notifications"."NotificationChannel" ADD VALUE 'INBOX';

-- CreateTable
CREATE TABLE "notifications"."inbox_message" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "kind" "notifications"."InboxKind" NOT NULL,
    "template_key" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "order_id" TEXT,
    "order_number" TEXT,
    "ticket_id" TEXT,
    "image_url" TEXT,
    "read_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "inbox_message_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "inbox_message_user_id_created_at_idx" ON "notifications"."inbox_message"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "inbox_message_user_id_read_at_idx" ON "notifications"."inbox_message"("user_id", "read_at");

-- Hand-added (v1.15): partial index for the unread badge, and access for the owning service role.
CREATE INDEX "inbox_message_user_unread_idx" ON "notifications"."inbox_message" ("user_id") WHERE "read_at" IS NULL AND "deleted_at" IS NULL;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "notifications"."inbox_message" TO "notifications_svc";
