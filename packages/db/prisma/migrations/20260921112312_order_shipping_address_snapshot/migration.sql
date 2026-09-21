-- AlterTable
ALTER TABLE "orders"."order" ADD COLUMN     "ship_city" TEXT,
ADD COLUMN     "ship_country" TEXT,
ADD COLUMN     "ship_full_name" TEXT,
ADD COLUMN     "ship_landmark" TEXT,
ADD COLUMN     "ship_line1" TEXT,
ADD COLUMN     "ship_line2" TEXT,
ADD COLUMN     "ship_phone" TEXT,
ADD COLUMN     "ship_pincode" TEXT,
ADD COLUMN     "ship_state" TEXT,
ADD COLUMN     "shipping_address_id" TEXT;
