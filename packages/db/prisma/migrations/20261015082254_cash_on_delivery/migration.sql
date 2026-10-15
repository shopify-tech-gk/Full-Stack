-- CreateEnum
CREATE TYPE "orders"."OrderPaymentMethod" AS ENUM ('ONLINE', 'COD');

-- CreateEnum
CREATE TYPE "payments"."PaymentMethod" AS ENUM ('ONLINE', 'COD');

-- AlterTable
ALTER TABLE "orders"."order" ADD COLUMN     "payment_method" "orders"."OrderPaymentMethod" NOT NULL DEFAULT 'ONLINE';

-- AlterTable
ALTER TABLE "payments"."payment" ADD COLUMN     "method" "payments"."PaymentMethod" NOT NULL DEFAULT 'ONLINE';

-- Hand-added: at most ONE live Cash-on-Delivery payment per order (a double-tapped "Place order"
-- can't create two cash-to-collect rows). FAILED rows (a COD order later voided) don't count.
CREATE UNIQUE INDEX "payment_cod_one_live_per_order"
  ON "payments"."payment" ("order_id")
  WHERE "method" = 'COD' AND "status" IN ('CREATED', 'CAPTURED') AND "deleted_at" IS NULL;
