-- AlterTable
ALTER TABLE "notifications"."inbox_message" ADD COLUMN     "link" TEXT,
ADD COLUMN     "web_link" TEXT;

-- AlterTable
ALTER TABLE "notifications"."product_request" ADD COLUMN     "notified_at" TIMESTAMP(3),
ADD COLUMN     "restock_label" TEXT,
ADD COLUMN     "restock_link" TEXT,
ADD COLUMN     "restock_web_link" TEXT;
