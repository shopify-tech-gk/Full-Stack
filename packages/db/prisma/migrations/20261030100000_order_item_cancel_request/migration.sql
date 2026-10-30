-- AlterTable
ALTER TABLE "orders"."order_cancel_request" ADD COLUMN     "order_item_id" TEXT;

-- CreateIndex
CREATE INDEX "order_cancel_request_order_item_id_idx" ON "orders"."order_cancel_request"("order_item_id");
