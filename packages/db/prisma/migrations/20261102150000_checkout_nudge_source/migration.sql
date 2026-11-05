-- AlterTable
ALTER TABLE "notifications"."checkout_nudge" ADD COLUMN     "sku_ids" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "source" TEXT NOT NULL DEFAULT 'CART';
