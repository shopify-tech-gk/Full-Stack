-- AlterTable
ALTER TABLE "notifications"."support_ticket" ADD COLUMN     "admin_reply" TEXT,
ADD COLUMN     "replied_at" TIMESTAMP(3);
